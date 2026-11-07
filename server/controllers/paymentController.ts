import { Request, Response } from "express";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import User from "../models/User.js";
import { HttpError, sendError } from "../utils/http.js";
import { toPaise } from "../utils/pricing.js";
import { markCheckoutPaid } from "../utils/orderHelpers.js";
import { notify } from "../utils/notify.js";
import {
  createRazorpayOrder,
  razorpayConfigured,
  razorpayKeyId,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../utils/razorpay.js";

// A checkout can hold several orders (one per shop) but is paid with ONE
// Razorpay order, so the amount is the sum of the orders' totals.
const checkoutPaise = (orders: any[]) =>
  orders.reduce((sum, o) => sum + toPaise(o.totalAmount), 0);

/**
 * Creates (or reuses) the Razorpay order for a checkout and returns what the
 * app needs to open the Razorpay sheet.
 */
export const createCheckoutPayment = async (orders: any[], user: any) => {
  const amount = checkoutPaise(orders);
  if (amount < 100) throw new HttpError(400, "Amount is too small for online payment");

  let razorpayOrderId: string | undefined = orders.find((o) => o.razorpayOrderId)?.razorpayOrderId;
  if (!razorpayOrderId) {
    const created = await createRazorpayOrder(amount, orders[0].checkoutId, {
      checkoutId: orders[0].checkoutId,
    });
    razorpayOrderId = created.id;
    await Order.updateMany(
      { _id: { $in: orders.map((o) => o._id) } },
      { razorpayOrderId },
    );
  }

  return {
    keyId: razorpayKeyId(),
    razorpayOrderId,
    amount, // paise
    currency: "INR",
    checkoutId: orders[0].checkoutId,
    orderIds: orders.map((o) => o._id),
    prefill: {
      name: user?.name,
      email: user?.email,
      contact: orders[0].shippingAddress?.phone,
    },
  };
};

/**
 * Idempotent "this Razorpay order was paid". Safe to call from the verify
 * endpoint AND the webhook - whichever arrives first wins.
 */
const settleCheckoutPayment = async (
  razorpayOrderId: string,
  payment: { razorpayPaymentId?: string; razorpaySignature?: string },
) => {
  const unpaid: any[] = await Order.find({
    razorpayOrderId,
    paymentStatus: { $ne: "paid" },
  }).select("_id shop orderNumber orderStatus user");

  if (unpaid.length) {
    await markCheckoutPaid(razorpayOrderId, payment);

    // Money arrived for orders that were already expired/cancelled: keep the
    // payment on the record so it shows up under "paid but cancelled" in the
    // reconciliation report and an admin can refund it.
    const lateIds = unpaid.filter((o) => o.orderStatus === "cancelled").map((o) => o._id);
    if (lateIds.length) {
      await Order.updateMany(
        { _id: { $in: lateIds } },
        {
          paymentStatus: "paid",
          paidAt: new Date(),
          ...(payment.razorpayPaymentId && { razorpayPaymentId: payment.razorpayPaymentId }),
        },
      );
      const admins = await User.find({ role: "admin" }).select("_id");
      await notify(
        admins.map((a) => a._id),
        {
          type: "payment",
          title: "Refund needed: payment received for a cancelled order",
          body: unpaid.filter((o) => o.orderStatus === "cancelled").map((o) => o.orderNumber).join(", "),
          data: { orderIds: lateIds },
        },
      );
    }

    // Shops are told only now that the order is actually paid
    const live = unpaid.filter((o) => o.orderStatus !== "cancelled");
    const shops: any[] = await Shop.find({
      _id: { $in: live.map((o) => o.shop).filter(Boolean) },
    }).select("owner");
    const ownerByShop = new Map(shops.map((s) => [s._id.toString(), s.owner]));
    for (const order of live) {
      const owner = order.shop && ownerByShop.get(order.shop.toString());
      if (owner) {
        await notify(owner, {
          type: "order",
          title: "New order received",
          body: order.orderNumber,
          data: { orderId: order._id },
        });
      }
    }
    await notify(unpaid[0].user, {
      type: "payment",
      title: "Payment received",
      body: unpaid.map((o) => o.orderNumber).join(", "),
      data: { orderIds: unpaid.map((o) => o._id) },
    });
  }

  return Order.find({ razorpayOrderId });
};

// Start (or restart) payment for a checkout whose payment didn't complete.
// POST /api/payments/create   body: { checkoutId }
export const createPayment = async (req: Request, res: Response) => {
  try {
    if (!razorpayConfigured()) {
      return res
        .status(503)
        .json({ success: false, message: "Online payments are not configured" });
    }
    const { checkoutId } = req.body;
    if (!checkoutId) {
      return res.status(400).json({ success: false, message: "checkoutId is required" });
    }

    const orders: any[] = await Order.find({
      checkoutId: String(checkoutId),
      user: req.user._id,
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      orderStatus: { $ne: "cancelled" },
    });
    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "Nothing to pay - the order may already be paid or have expired",
      });
    }

    const payment = await createCheckoutPayment(orders, req.user);
    res.json({ success: true, payment });
  } catch (error) {
    sendError(res, error, "Failed to start payment");
  }
};

// Called by the app after the Razorpay sheet succeeds.
// POST /api/payments/verify
//   body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
      });
    }

    const mine = await Order.exists({ razorpayOrderId: razorpay_order_id, user: req.user._id });
    if (!mine) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }

    const orders = await settleCheckoutPayment(razorpay_order_id, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    sendError(res, error, "Failed to verify payment");
  }
};

// Razorpay -> server. Mounted with express.raw() BEFORE express.json().
// POST /api/razorpay/webhook
export const razorpayWebhook = async (req: Request, res: Response) => {
  const signature = req.header("x-razorpay-signature");
  const raw = req.body;
  if (!Buffer.isBuffer(raw) || !signature || !verifyWebhookSignature(raw, signature)) {
    return res.status(400).send("Invalid signature");
  }

  try {
    const event = JSON.parse(raw.toString("utf8"));
    const payment = event?.payload?.payment?.entity;
    const razorpayOrderId: string | undefined =
      payment?.order_id ?? event?.payload?.order?.entity?.id;

    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        if (!razorpayOrderId || !payment?.id) break;
        const orders: any[] = await Order.find({ razorpayOrderId }).select("totalAmount");
        // never trust an event whose amount doesn't match what we charged
        if (!orders.length || payment.amount !== checkoutPaise(orders)) {
          console.error("Razorpay webhook amount mismatch/unknown order:", razorpayOrderId, payment.amount);
          break;
        }
        await settleCheckoutPayment(razorpayOrderId, { razorpayPaymentId: payment.id });
        break;
      }

      case "payment.failed": {
        // order stays pending so the customer can retry (see /api/payments/create)
        const one: any = razorpayOrderId && (await Order.findOne({ razorpayOrderId }).select("user orderNumber checkoutId"));
        if (one) {
          await notify(one.user, {
            type: "payment",
            title: "Payment failed",
            body: "Your payment didn't go through. You can retry from your orders.",
            data: { checkoutId: one.checkoutId },
          });
        }
        break;
      }

      case "refund.processed": {
        const refund = event?.payload?.refund?.entity;
        const paid = event?.payload?.payment?.entity ?? { id: refund?.payment_id, amount: refund?.amount };
        // only a FULL refund can be mapped onto the orders of a checkout
        if (refund?.payment_id && paid?.amount === refund?.amount) {
          await Order.updateMany(
            { razorpayPaymentId: refund.payment_id },
            { paymentStatus: "refunded" },
          );
        } else if (refund?.payment_id) {
          console.warn("Partial refund needs manual reconciliation:", refund.payment_id);
        }
        break;
      }

      default:
        break; // other events are acknowledged and ignored
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error);
    // 500 makes Razorpay retry later
    res.status(500).send("Webhook processing failed");
  }
};

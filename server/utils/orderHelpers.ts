import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Delivery from "../models/Delivery.js";
import { IOrder, OrderStatus } from "../types/index.js";
import { HttpError } from "./http.js";

export const generateOrderNumber = () =>
  "ORD-" +
  Date.now().toString(36).toUpperCase() +
  "-" +
  Math.random().toString(36).slice(2, 6).toUpperCase();

export const generateCheckoutId = () =>
  "CHK-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

type StockLine = { product: any; quantity: number };

export const restoreStockLines = async (lines: StockLine[]) => {
  await Promise.all(
    lines.map((l) =>
      Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } }),
    ),
  );
};

/**
 * Atomically decrements stock for every line. If any line can't be satisfied,
 * everything already reserved is rolled back.
 */
export const reserveStock = async (
  lines: StockLine[],
): Promise<{ ok: true } | { ok: false; productId: any }> => {
  const reserved: StockLine[] = [];
  for (const line of lines) {
    const result = await Product.updateOne(
      { _id: line.product, isActive: true, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
    );
    if (result.modifiedCount !== 1) {
      await restoreStockLines(reserved);
      return { ok: false, productId: line.product };
    }
    reserved.push(line);
  }
  return { ok: true };
};

/** Idempotent: restores stock for an order at most once. */
export const restoreOrderStock = async (orderId: any) => {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, stockRestored: { $ne: true } },
    { stockRestored: true },
    { new: true },
  );
  if (!order) return false;
  await restoreStockLines(order.items.map((i) => ({ product: i.product, quantity: i.quantity })));
  return true;
};

/**
 * Idempotent "payment succeeded" transition for ONE order.
 */
export const markOrderPaid = async (
  orderId: any,
  payment: { razorpayPaymentId?: string; razorpaySignature?: string } = {},
): Promise<IOrder | null> => {
  return Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: "paid" }, orderStatus: { $ne: "cancelled" } },
    {
      paymentStatus: "paid",
      paidAt: new Date(),
      ...(payment.razorpayPaymentId && { razorpayPaymentId: payment.razorpayPaymentId }),
      ...(payment.razorpaySignature && { razorpaySignature: payment.razorpaySignature }),
    },
    { new: true },
  );
};

/**
 * Razorpay pays for a whole checkout (which can contain one order per shop)
 * with ONE Razorpay order. Call this from the verify endpoint and the webhook.
 */
export const markCheckoutPaid = async (
  razorpayOrderId: string,
  payment: { razorpayPaymentId?: string; razorpaySignature?: string } = {},
) => {
  await Order.updateMany(
    { razorpayOrderId, paymentStatus: { $ne: "paid" }, orderStatus: { $ne: "cancelled" } },
    {
      paymentStatus: "paid",
      paidAt: new Date(),
      ...(payment.razorpayPaymentId && { razorpayPaymentId: payment.razorpayPaymentId }),
      ...(payment.razorpaySignature && { razorpaySignature: payment.razorpaySignature }),
    },
  );
  return Order.find({ razorpayOrderId });
};

// Which status changes each kind of actor may make
const TRANSITIONS: Record<string, Record<string, OrderStatus[]>> = {
  shop: {
    placed: ["processing", "cancelled"],
    processing: ["cancelled"],
  },
  admin: {
    placed: ["processing", "shipping", "delivered", "cancelled"],
    processing: ["shipping", "delivered", "cancelled"],
    shipping: ["delivered", "cancelled"],
  },
  system: {
    // driver actions (set by the delivery workflow)
    placed: ["shipping", "delivered"],
    processing: ["shipping", "delivered"],
    shipping: ["delivered"],
  },
};

/**
 * Single place that moves an order to a new status and applies side effects
 * (timestamps, COD collection, stock restore on cancel). Does not notify.
 */
export const transitionOrder = async (
  order: any,
  next: OrderStatus,
  actor: "shop" | "admin" | "system",
) => {
  if (next === order.orderStatus) return order;
  const allowed = TRANSITIONS[actor][order.orderStatus] || [];
  if (!allowed.includes(next)) {
    throw new HttpError(
      400,
      `Order can't move from "${order.orderStatus}" to "${next}"`,
    );
  }

  order.orderStatus = next;

  if (next === "delivered") {
    order.deliveredAt = new Date();
    // cash is collected on delivery
    if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
      order.paymentStatus = "paid";
      order.paidAt = new Date();
    }
  }
  if (next === "cancelled") {
    order.cancelledAt = new Date();
    // an active delivery for a cancelled order is cancelled too
    await Delivery.updateOne(
      { order: order._id, status: { $in: ["assigned", "accepted", "picked_up", "on_the_way"] } },
      { status: "cancelled", $push: { timeline: { status: "cancelled", at: new Date(), note: "Order cancelled" } } },
    );
  }

  await order.save();
  if (next === "cancelled") await restoreOrderStock(order._id);
  return order;
};

/** Adds `delivery` (status, driver name/phone/location) to plain order objects. */
export const attachDeliveries = async (orders: any[]) => {
  if (!orders.length) return [];
  const deliveries: any[] = await Delivery.find({
    order: { $in: orders.map((o) => o._id) },
  }).populate("driver", "fullName phone vehicleType vehicleNumber currentLocation");
  const byOrder = new Map(deliveries.map((d) => [d.order.toString(), d]));
  return orders.map((o) => {
    const obj = typeof o.toObject === "function" ? o.toObject() : o;
    return { ...obj, delivery: byOrder.get(o._id.toString()) ?? null };
  });
};

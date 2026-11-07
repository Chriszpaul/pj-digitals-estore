import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import Settlement from "../models/Settlement.js";
import { round2, sendError } from "../utils/http.js";
import { logActivity } from "../utils/activity.js";
import { notify } from "../utils/notify.js";
import { restoreOrderStock } from "../utils/orderHelpers.js";

const TZ = "Asia/Kolkata";

const dateRange = (req: Request, defaultDays = 30) => {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  // a bare date like 2026-11-07 as `to` should include that whole day
  if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) {
    to.setUTCHours(23, 59, 59, 999);
  }
  return { from, to };
};

const paging = (req: Request, defLimit = 20) => ({
  page: Math.max(1, Number(req.query.page) || 1),
  limit: Math.min(100, Math.max(1, Number(req.query.limit) || defLimit)),
});

// ===================== REPORTS =====================

// GET /api/admin/reports/sales?from=&to=&groupBy=day|month&shop=
export const salesReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = dateRange(req);
    const format = req.query.groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";
    const match: any = {
      orderStatus: { $ne: "cancelled" },
      createdAt: { $gte: from, $lte: to },
    };
    if (req.query.shop) match.shop = new mongoose.Types.ObjectId(String(req.query.shop));

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format, date: "$createdAt", timezone: TZ } },
          orders: { $sum: 1 },
          gross: { $sum: "$totalAmount" },
          collected: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] } },
          codOrders: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cod"] }, 1, 0] } },
          onlineOrders: { $sum: { $cond: [{ $eq: ["$paymentMethod", "razorpay"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totals = rows.reduce(
      (t, r) => ({
        orders: t.orders + r.orders,
        gross: round2(t.gross + r.gross),
        collected: round2(t.collected + r.collected),
      }),
      { orders: 0, gross: 0, collected: 0 },
    );

    res.json({
      success: true,
      data: {
        from,
        to,
        totals,
        rows: rows.map(({ _id, ...r }) => ({ period: _id, ...r })),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build sales report");
  }
};

// GET /api/admin/reports/shops?from=&to=
export const shopsReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = dateRange(req);
    const rows = await Order.aggregate([
      { $match: { shop: { $ne: null }, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$shop",
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
          sales: {
            $sum: { $cond: [{ $ne: ["$orderStatus", "cancelled"] }, "$subtotal", 0] },
          },
        },
      },
      { $sort: { sales: -1 } },
    ]);

    const shops = await Shop.find({ _id: { $in: rows.map((r) => r._id) } }).select("name location");
    const byId = new Map(shops.map((s: any) => [s._id.toString(), s]));

    res.json({
      success: true,
      data: {
        from,
        to,
        rows: rows.map((r) => {
          const s: any = byId.get(r._id.toString());
          return { shopId: r._id, shopName: s?.name, location: s?.location, ...r, _id: undefined };
        }),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build shop report");
  }
};

// GET /api/admin/payments?status=&method=&from=&to=&page=&limit=
export const listPayments = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);
    const { from, to } = dateRange(req, 90);
    const query: any = { createdAt: { $gte: from, $lte: to } };
    if (req.query.status) query.paymentStatus = String(req.query.status);
    if (req.query.method) query.paymentMethod = String(req.query.method);

    const [total, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .select(
          "orderNumber checkoutId user shop paymentMethod paymentOption paymentStatus totalAmount currency razorpayOrderId razorpayPaymentId paidAt orderStatus createdAt",
        )
        .populate("user", "name email")
        .populate("shop", "name")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data: orders, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch payments");
  }
};

// GET /api/admin/reports/reconciliation?from=&to=
// Money in vs. orders, plus the records that need a human to look at them.
export const reconciliation = async (req: Request, res: Response) => {
  try {
    const { from, to } = dateRange(req, 30);
    const range = { createdAt: { $gte: from, $lte: to } };
    const stuckBefore = new Date(Date.now() - 30 * 60 * 1000);
    const sample = "orderNumber totalAmount paymentMethod paymentStatus orderStatus createdAt";

    const [byMethod, missingPaymentId, stuckOnline, paidButCancelled, unsettled] = await Promise.all([
      Order.aggregate([
        { $match: range },
        {
          $group: {
            _id: { method: "$paymentMethod", status: "$paymentStatus" },
            orders: { $sum: 1 },
            amount: { $sum: "$totalAmount" },
          },
        },
      ]),
      // paid online but we never stored a Razorpay payment id
      Order.find({ ...range, paymentMethod: "razorpay", paymentStatus: "paid", razorpayPaymentId: { $exists: false } })
        .select(sample)
        .limit(50),
      // online orders still unpaid after 30 minutes - stock is being held
      Order.find({
        paymentMethod: "razorpay",
        paymentStatus: "pending",
        orderStatus: { $ne: "cancelled" },
        createdAt: { $lt: stuckBefore },
      })
        .select(sample)
        .limit(50),
      // customer paid but the order was cancelled -> refund due
      Order.find({ ...range, paymentStatus: "paid", orderStatus: "cancelled" }).select(sample).limit(50),
      // delivered + paid but not yet in any settlement
      Order.aggregate([
        { $match: { orderStatus: "delivered", paymentStatus: "paid", settlement: { $exists: false }, shop: { $ne: null } } },
        { $group: { _id: "$shop", orders: { $sum: 1 }, amount: { $sum: "$subtotal" } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        from,
        to,
        byMethodAndStatus: byMethod.map((r) => ({
          method: r._id.method,
          status: r._id.status,
          orders: r.orders,
          amount: round2(r.amount),
        })),
        issues: {
          paidOnlineWithoutPaymentId: missingPaymentId,
          unpaidOnlineOlderThan30Min: stuckOnline,
          paidButCancelled_refundDue: paidButCancelled,
        },
        unsettledByShop: unsettled.map((u) => ({ shopId: u._id, orders: u.orders, amount: round2(u.amount) })),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build reconciliation report");
  }
};

// POST /api/admin/orders/expire-unpaid   body: { minutes? = 30 }
// Cancels online orders that were never paid and gives their stock back.
// Call it from a cron (e.g. Vercel Cron) every few minutes.
export const expireUnpaidOrders = async (req: Request, res: Response) => {
  try {
    const minutes = Math.max(5, Number(req.body.minutes) || 30);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const orders: any[] = await Order.find({
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      orderStatus: { $in: ["placed", "processing"] },
      createdAt: { $lt: cutoff },
    }).limit(200);

    for (const order of orders) {
      order.orderStatus = "cancelled";
      order.paymentStatus = "failed";
      order.cancelledAt = new Date();
      await order.save();
      await restoreOrderStock(order._id);
      await notify(order.user, {
        type: "payment",
        title: "Order cancelled - payment not completed",
        body: order.orderNumber,
        data: { orderId: order._id },
      });
    }
    await logActivity(req, "orders.expired_unpaid", "Order", undefined, { count: orders.length, minutes });
    res.json({ success: true, expired: orders.length });
  } catch (error) {
    sendError(res, error, "Failed to expire unpaid orders");
  }
};

// ===================== SETTLEMENTS / PAYOUTS =====================

// POST /api/admin/settlements   body: { shopId, to?, commissionRate? }
// Bundles all DELIVERED + PAID, not-yet-settled orders of a shop into a payout.
export const createSettlement = async (req: Request, res: Response) => {
  try {
    const { shopId, to } = req.body;
    const shop: any = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    const rate =
      req.body.commissionRate !== undefined
        ? Number(req.body.commissionRate)
        : Number(process.env.COMMISSION_RATE ?? 0);
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
      return res
        .status(400)
        .json({ success: false, message: "commissionRate must be between 0 and 1 (e.g. 0.05)" });
    }

    const query: any = {
      shop: shop._id,
      orderStatus: "delivered",
      paymentStatus: "paid",
      settlement: { $exists: false },
    };
    if (to) query.deliveredAt = { $lte: new Date(to) };

    const orders: any[] = await Order.find(query).select("subtotal paymentMethod deliveredAt");
    if (orders.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No unsettled delivered orders for this shop" });
    }

    const grossSales = round2(orders.reduce((s, o) => s + o.subtotal, 0));
    const codAmount = round2(orders.filter((o) => o.paymentMethod === "cod").reduce((s, o) => s + o.subtotal, 0));
    const commission = round2(grossSales * rate);
    const dates = orders.map((o) => o.deliveredAt?.getTime()).filter(Boolean) as number[];

    const settlement: any = await Settlement.create({
      shop: shop._id,
      periodFrom: dates.length ? new Date(Math.min(...dates)) : undefined,
      periodTo: dates.length ? new Date(Math.max(...dates)) : undefined,
      orders: orders.map((o) => o._id),
      ordersCount: orders.length,
      grossSales,
      commissionRate: rate,
      commission,
      netPayable: round2(grossSales - commission),
      codAmount,
      onlineAmount: round2(grossSales - codAmount),
      createdBy: req.user._id,
    });

    // claim the orders; if another settlement grabbed some meanwhile, undo
    const claimed = await Order.updateMany(
      { _id: { $in: settlement.orders }, settlement: { $exists: false } },
      { settlement: settlement._id },
    );
    if (claimed.modifiedCount !== orders.length) {
      await Order.updateMany({ settlement: settlement._id }, { $unset: { settlement: 1 } });
      await settlement.deleteOne();
      return res
        .status(409)
        .json({ success: false, message: "Orders changed while settling - please retry" });
    }

    await logActivity(req, "settlement.created", "Settlement", settlement._id, {
      shopId: shop._id,
      netPayable: settlement.netPayable,
    });
    res.status(201).json({ success: true, data: settlement });
  } catch (error) {
    sendError(res, error, "Failed to create settlement");
  }
};

// GET /api/admin/settlements?shop=&status=&page=&limit=
export const listSettlements = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);
    const query: any = {};
    if (req.query.shop) query.shop = String(req.query.shop);
    if (req.query.status) query.status = String(req.query.status);

    const [total, data] = await Promise.all([
      Settlement.countDocuments(query),
      Settlement.find(query)
        .select("-orders")
        .populate("shop", "name location")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch settlements");
  }
};

// GET /api/admin/settlements/:id
export const getSettlement = async (req: Request, res: Response) => {
  try {
    const data = await Settlement.findById(req.params.id)
      .populate("shop", "name location phone")
      .populate("orders", "orderNumber subtotal paymentMethod deliveredAt");
    if (!data) return res.status(404).json({ success: false, message: "Settlement not found" });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Failed to fetch settlement");
  }
};

// PUT /api/admin/settlements/:id   body: { status: "paid", reference?, notes? }
export const updateSettlement = async (req: Request, res: Response) => {
  try {
    const settlement: any = await Settlement.findById(req.params.id);
    if (!settlement) return res.status(404).json({ success: false, message: "Settlement not found" });
    if (settlement.status === "paid") {
      return res.status(400).json({ success: false, message: "Settlement is already paid" });
    }
    if (req.body.status !== "paid") {
      return res.status(400).json({ success: false, message: "status must be paid" });
    }
    settlement.status = "paid";
    settlement.paidAt = new Date();
    if (req.body.reference !== undefined) settlement.reference = req.body.reference;
    if (req.body.notes !== undefined) settlement.notes = req.body.notes;
    await settlement.save();

    const shop: any = await Shop.findById(settlement.shop).select("owner");
    if (shop) {
      await notify(shop.owner, {
        type: "payment",
        title: "Payout sent",
        body: `₹${settlement.netPayable} for ${settlement.ordersCount} orders`,
        data: { settlementId: settlement._id },
      });
    }
    await logActivity(req, "settlement.paid", "Settlement", settlement._id, { reference: req.body.reference });
    res.json({ success: true, data: settlement });
  } catch (error) {
    sendError(res, error, "Failed to update settlement");
  }
};

import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import Settlement from "../models/Settlement.js";
import { HttpError, round2, sendError } from "../utils/http.js";
import PayoutRequest from "../models/PayoutRequest.js";
import { getSettings } from "../utils/settings.js";
import { payoutLabel, toCsv, unsettledFor } from "../utils/payouts.js";
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

// GET /api/admin/payouts/preview?shopId=&to=&commissionRate=
// What a settlement would contain right now, without creating it.
export const previewSettlement = async (req: Request, res: Response) => {
  try {
    const shop: any = await Shop.findById(req.query.shopId);
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });
    const u = await unsettledFor(shop, { to: req.query.to, rate: req.query.commissionRate });
    const { orders, ...figures } = u;
    res.json({
      success: true,
      data: { ...figures, payout: shop.payout || null, payoutLabel: payoutLabel(shop.payout), orders },
    });
  } catch (error) {
    sendError(res, error, "Failed to preview settlement");
  }
};

// GET /api/admin/payouts/summary
// Per-shop money owed + totals: the "who do we owe" screen.
export const payoutsSummary = async (_req: Request, res: Response) => {
  try {
    const rows: any[] = await Order.aggregate([
      { $match: { orderStatus: "delivered", paymentStatus: "paid", settlement: { $exists: false }, shop: { $exists: true } } },
      { $group: { _id: "$shop", orders: { $sum: 1 }, gross: { $sum: "$subtotal" }, oldest: { $min: "$deliveredAt" } } },
    ]);
    const shops: any[] = await Shop.find({ _id: { $in: rows.map((r) => r._id) } }).select("name location commissionRate payout");
    const byId = new Map(shops.map((s) => [s._id.toString(), s]));
    const settings = await getSettings();
    const owed = rows
      .map((r) => {
        const shop = byId.get(r._id.toString());
        const rate = shop?.commissionRate ?? settings.commissionRate;
        return {
          shopId: r._id,
          name: shop?.name,
          location: shop?.location,
          hasPayoutAccount: !!shop?.payout?.method,
          rate,
          orders: r.orders,
          gross: round2(r.gross),
          commission: round2(r.gross * rate),
          net: round2(r.gross - r.gross * rate),
          oldest: r.oldest,
        };
      })
      .sort((a, b) => b.net - a.net);

    const [pendingSettlements, paidSettlements, openRequests] = await Promise.all([
      Settlement.aggregate([{ $match: { status: "pending" } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$netPayable" } } }]),
      Settlement.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$netPayable" }, commission: { $sum: "$commission" } } }]),
      PayoutRequest.countDocuments({ status: "open" }),
    ]);
    res.json({
      success: true,
      data: {
        owed,
        totals: {
          unsettledNet: round2(owed.reduce((t, r) => t + r.net, 0)),
          unsettledCommission: round2(owed.reduce((t, r) => t + r.commission, 0)),
          pendingToPay: round2(pendingSettlements[0]?.amount ?? 0),
          pendingCount: pendingSettlements[0]?.n ?? 0,
          paidOut: round2(paidSettlements[0]?.amount ?? 0),
          commissionEarned: round2(paidSettlements[0]?.commission ?? 0),
          openRequests,
        },
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build payout summary");
  }
};

// Creates one settlement for a shop. Returns null when there is nothing to settle.
const settleShop = async (shop: any, req: Request, opts: { to?: any; rate?: any; adjustment?: number; adjustmentNote?: string; notes?: string }) => {
  const u = await unsettledFor(shop, opts);
  if (u.ordersCount === 0) return null;
  const adjustment = round2(Number(opts.adjustment) || 0);
  const settlement: any = await Settlement.create({
    shop: shop._id,
    periodFrom: u.periodFrom,
    periodTo: u.periodTo,
    orders: u.orders.map((o) => o._id),
    ordersCount: u.ordersCount,
    grossSales: u.grossSales,
    commissionRate: u.rate,
    commission: u.commission,
    adjustment,
    adjustmentNote: opts.adjustmentNote,
    netPayable: round2(u.net + adjustment),
    payoutSnapshot: payoutLabel(shop.payout),
    codAmount: u.codAmount,
    onlineAmount: u.onlineAmount,
    notes: opts.notes,
    createdBy: req.user._id,
  });
  // claim the orders; if another settlement grabbed some meanwhile, undo
  const claimed = await Order.updateMany(
    { _id: { $in: settlement.orders }, settlement: { $exists: false } },
    { settlement: settlement._id },
  );
  if (claimed.modifiedCount !== u.ordersCount) {
    await Order.updateMany({ settlement: settlement._id }, { $unset: { settlement: 1 } });
    await settlement.deleteOne();
    throw new HttpError(409, "Orders changed while settling - please retry");
  }
  // close any open payout request from this shop
  await PayoutRequest.updateMany(
    { shop: shop._id, status: "open" },
    { status: "fulfilled", settlement: settlement._id, resolvedAt: new Date(), resolutionNote: "Settlement created" },
  );
  await logActivity(req, "settlement.created", "Settlement", settlement._id, { shopId: shop._id, netPayable: settlement.netPayable });
  return settlement;
};

// POST /api/admin/settlements   body: { shopId, to?, commissionRate?, adjustment?, adjustmentNote?, notes? }
// Bundles all DELIVERED + PAID, not-yet-settled orders of a shop into a payout.
// Commission: body override > the shop's own rate > the platform default.
export const createSettlement = async (req: Request, res: Response) => {
  try {
    const shop: any = await Shop.findById(req.body.shopId);
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });
    if (req.body.commissionRate !== undefined && req.body.commissionRate !== "") {
      const r = Number(req.body.commissionRate);
      if (!Number.isFinite(r) || r < 0 || r >= 1) {
        return res.status(400).json({ success: false, message: "commissionRate must be between 0 and 1 (e.g. 0.05)" });
      }
    }
    const settlement = await settleShop(shop, req, req.body);
    if (!settlement) return res.status(400).json({ success: false, message: "No unsettled delivered orders for this shop" });
    res.status(201).json({ success: true, data: settlement });
  } catch (error) {
    sendError(res, error, "Failed to create settlement");
  }
};

// POST /api/admin/settlements/bulk   body: { shopIds?: [], to? }   (default: every shop with money owed)
export const createSettlementsBulk = async (req: Request, res: Response) => {
  try {
    let ids: any[] = Array.isArray(req.body.shopIds) ? req.body.shopIds : [];
    if (!ids.length) {
      ids = await Order.distinct("shop", { orderStatus: "delivered", paymentStatus: "paid", settlement: { $exists: false }, shop: { $exists: true } });
    }
    const created: any[] = [];
    const failed: any[] = [];
    for (const id of ids) {
      try {
        const shop: any = await Shop.findById(id);
        if (!shop) continue;
        const s = await settleShop(shop, req, { to: req.body.to });
        if (s) created.push({ shop: shop.name, settlementId: s._id, netPayable: s.netPayable });
      } catch (e: any) {
        failed.push({ shopId: id, message: e.message });
      }
    }
    res.status(201).json({ success: true, created, failed, total: round2(created.reduce((t, c) => t + c.netPayable, 0)) });
  } catch (error) {
    sendError(res, error, "Failed to create settlements");
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

// PUT /api/admin/settlements/:id
// body: { status?: "paid" | "void", reference?, notes?, adjustment?, adjustmentNote?, reason? }
//  - pending settlements can be corrected (adjustment) before paying
//  - "void" cancels a pending settlement and frees its orders to be settled again
export const updateSettlement = async (req: Request, res: Response) => {
  try {
    const settlement: any = await Settlement.findById(req.params.id);
    if (!settlement) return res.status(404).json({ success: false, message: "Settlement not found" });
    if (settlement.status !== "pending") {
      return res.status(400).json({ success: false, message: `Settlement is already ${settlement.status}` });
    }
    const { status } = req.body;
    if (status !== undefined && !["paid", "void"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be paid or void" });
    }

    if (req.body.adjustment !== undefined) {
      const adj = Number(req.body.adjustment);
      if (!Number.isFinite(adj)) return res.status(400).json({ success: false, message: "adjustment must be a number" });
      settlement.adjustment = round2(adj);
      settlement.netPayable = round2(settlement.grossSales - settlement.commission + settlement.adjustment);
    }
    if (req.body.adjustmentNote !== undefined) settlement.adjustmentNote = req.body.adjustmentNote;
    if (req.body.reference !== undefined) settlement.reference = req.body.reference;
    if (req.body.notes !== undefined) settlement.notes = req.body.notes;

    if (status === "void") {
      settlement.status = "void";
      if (req.body.reason) settlement.notes = [settlement.notes, `Voided: ${req.body.reason}`].filter(Boolean).join(" | ");
      await Order.updateMany({ settlement: settlement._id }, { $unset: { settlement: 1 } });
    } else if (status === "paid") {
      if (settlement.netPayable < 0) {
        return res.status(400).json({ success: false, message: "Net payable is negative - adjust it or void this settlement" });
      }
      settlement.status = "paid";
      settlement.paidAt = new Date();
    }
    await settlement.save();

    if (status) {
      const shop: any = await Shop.findById(settlement.shop).select("owner");
      if (shop && status === "paid") {
        await notify(shop.owner, {
          type: "payment",
          title: "Payout sent",
          body: `₹${settlement.netPayable} for ${settlement.ordersCount} orders${settlement.reference ? ` · ref ${settlement.reference}` : ""}`,
          data: { settlementId: settlement._id },
        });
      }
    }
    await logActivity(req, `settlement.${status || "edited"}`, "Settlement", settlement._id, { reference: req.body.reference, adjustment: settlement.adjustment });
    res.json({ success: true, data: settlement });
  } catch (error) {
    sendError(res, error, "Failed to update settlement");
  }
};

// GET /api/admin/settlements/export.csv?shop=&status=
export const exportSettlements = async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.query.shop) query.shop = String(req.query.shop);
    if (req.query.status) query.status = String(req.query.status);
    const list: any[] = await Settlement.find(query).populate("shop", "name location").sort("-createdAt").limit(5000);
    const csv = toCsv(
      list.map((s) => ({
        id: s._id,
        shop: s.shop?.name,
        location: s.shop?.location,
        status: s.status,
        orders: s.ordersCount,
        gross: s.grossSales,
        commissionRate: s.commissionRate,
        commission: s.commission,
        adjustment: s.adjustment,
        netPayable: s.netPayable,
        sendTo: s.payoutSnapshot,
        reference: s.reference,
        createdAt: s.createdAt,
        paidAt: s.paidAt,
      })),
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="settlements.csv"');
    res.send(csv);
  } catch (error) {
    sendError(res, error, "Failed to export settlements");
  }
};

// ===================== PAYOUT REQUESTS (raised by shops) =====================

// GET /api/admin/payout-requests?status=
export const listPayoutRequests = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);
    const query: any = {};
    if (req.query.status) query.status = String(req.query.status);
    const [total, data] = await Promise.all([
      PayoutRequest.countDocuments(query),
      PayoutRequest.find(query).populate("shop", "name location payout").sort("-createdAt").skip((page - 1) * limit).limit(limit),
    ]);
    res.json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch payout requests");
  }
};

// PUT /api/admin/payout-requests/:id   body: { status: "rejected", note }   (fulfil = create a settlement)
export const resolvePayoutRequest = async (req: Request, res: Response) => {
  try {
    const pr: any = await PayoutRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ success: false, message: "Request not found" });
    if (pr.status !== "open") return res.status(400).json({ success: false, message: `Already ${pr.status}` });
    if (req.body.status !== "rejected") return res.status(400).json({ success: false, message: "status must be rejected (to fulfil, create the settlement)" });
    if (!String(req.body.note || "").trim()) return res.status(400).json({ success: false, message: "Please give a reason" });
    pr.status = "rejected";
    pr.resolutionNote = String(req.body.note).trim();
    pr.resolvedAt = new Date();
    await pr.save();
    const shop: any = await Shop.findById(pr.shop).select("owner");
    if (shop) await notify(shop.owner, { type: "payment", title: "Payout request declined", body: pr.resolutionNote, data: { payoutRequestId: pr._id } });
    await logActivity(req, "payout_request.rejected", "PayoutRequest", pr._id);
    res.json({ success: true, data: pr });
  } catch (error) {
    sendError(res, error, "Failed to update request");
  }
};


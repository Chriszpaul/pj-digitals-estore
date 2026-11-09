import { Request, Response } from "express";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import Settlement from "../models/Settlement.js";
import PayoutRequest from "../models/PayoutRequest.js";
import Delivery from "../models/Delivery.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import DriverSettlement from "../models/DriverSettlement.js";
import { PAYOUT_METHODS } from "../types/index.js";
import { escapeRegex, round2, sendError } from "../utils/http.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { logActivity } from "../utils/activity.js";
import { getSettings } from "../utils/settings.js";
import { toCsv, unsettledFor } from "../utils/payouts.js";

const paging = (req: Request, defLimit = 20) => ({
  page: Math.max(1, Number(req.query.page) || 1),
  limit: Math.min(100, Math.max(1, Number(req.query.limit) || defLimit)),
});

// Validates a payout account body: { method: "upi"|"bank", upiId | accountHolder+accountNumber+ifsc, bankName? }
export const cleanPayoutAccount = (b: any) => {
  if (!b || !(PAYOUT_METHODS as readonly string[]).includes(b.method)) {
    throw Object.assign(new Error(`method must be one of: ${PAYOUT_METHODS.join(", ")}`), { status: 400 });
  }
  if (b.method === "upi") {
    const upiId = String(b.upiId || "").trim();
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) throw Object.assign(new Error("Enter a valid UPI id, e.g. name@okbank"), { status: 400 });
    return { method: "upi", upiId };
  }
  const accountHolder = String(b.accountHolder || "").trim();
  const accountNumber = String(b.accountNumber || "").replace(/\s/g, "");
  const ifsc = String(b.ifsc || "").trim().toUpperCase();
  if (!accountHolder) throw Object.assign(new Error("accountHolder is required"), { status: 400 });
  if (!/^\d{6,18}$/.test(accountNumber)) throw Object.assign(new Error("Enter a valid account number"), { status: 400 });
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw Object.assign(new Error("Enter a valid IFSC code"), { status: 400 });
  return { method: "bank", accountHolder, accountNumber, ifsc, bankName: b.bankName ? String(b.bankName).trim() : undefined };
};

const maskAccount = (p: any) =>
  p && p.accountNumber ? { ...(p.toObject ? p.toObject() : p), accountNumber: `••••${String(p.accountNumber).slice(-4)}` } : p;

// ===================== SHOP SIDE =====================

// GET /api/shop/payouts  -> everything the "Payouts" screen needs
export const getShopPayouts = async (req: Request, res: Response) => {
  try {
    const shop: any = req.shop;
    const u = await unsettledFor(shop);
    const [pending, paid, lifetime, requests, awaitingDelivery] = await Promise.all([
      Settlement.aggregate([{ $match: { shop: shop._id, status: "pending" } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$netPayable" } } }]),
      Settlement.aggregate([{ $match: { shop: shop._id, status: "paid" } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$netPayable" }, commission: { $sum: "$commission" } } }]),
      Order.aggregate([
        { $match: { shop: shop._id, orderStatus: "delivered", paymentStatus: "paid" } },
        { $group: { _id: null, gross: { $sum: "$subtotal" }, orders: { $sum: 1 } } },
      ]),
      PayoutRequest.find({ shop: shop._id }).sort("-createdAt").limit(10),
      Order.aggregate([
        { $match: { shop: shop._id, orderStatus: { $in: ["placed", "processing", "shipping"] }, $or: [{ paymentStatus: "paid" }, { paymentMethod: "cod" }] } },
        { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$subtotal" } } },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        commissionRate: u.rate,
        commissionIsCustom: shop.commissionRate !== undefined && shop.commissionRate !== null,
        unsettled: {
          orders: u.ordersCount,
          grossSales: u.grossSales,
          commission: u.commission,
          net: u.net,
          codAmount: u.codAmount,
          onlineAmount: u.onlineAmount,
          since: u.periodFrom,
        },
        awaitingDelivery: { orders: awaitingDelivery[0]?.n ?? 0, amount: round2(awaitingDelivery[0]?.amount ?? 0) },
        pendingPayout: { count: pending[0]?.n ?? 0, amount: round2(pending[0]?.amount ?? 0) },
        paidOut: { count: paid[0]?.n ?? 0, amount: round2(paid[0]?.amount ?? 0), commissionPaid: round2(paid[0]?.commission ?? 0) },
        lifetime: { orders: lifetime[0]?.orders ?? 0, grossSales: round2(lifetime[0]?.gross ?? 0) },
        payoutAccount: maskAccount(shop.payout) || null,
        requests,
        canRequest: u.ordersCount > 0 && !requests.some((r: any) => r.status === "open"),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch payouts");
  }
};

// PUT /api/shop/payout-account
export const setShopPayoutAccount = async (req: Request, res: Response) => {
  try {
    const shop: any = req.shop;
    shop.payout = cleanPayoutAccount(req.body);
    await shop.save();
    await logActivity(req, "shop.payout_account_updated", "Shop", shop._id);
    res.json({ success: true, data: maskAccount(shop.payout) });
  } catch (error) {
    sendError(res, error, "Failed to save payout account");
  }
};

// GET /api/shop/settlements/:id   (with its orders)
export const getShopSettlement = async (req: Request, res: Response) => {
  try {
    const data = await Settlement.findOne({ _id: req.params.id, shop: req.shop._id }).populate(
      "orders",
      "orderNumber subtotal paymentMethod deliveredAt",
    );
    if (!data) return res.status(404).json({ success: false, message: "Settlement not found" });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Failed to fetch settlement");
  }
};

// GET /api/shop/settlements/export.csv
export const exportShopSettlements = async (req: Request, res: Response) => {
  try {
    const list: any[] = await Settlement.find({ shop: req.shop._id }).sort("-createdAt").limit(2000);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="my-payouts.csv"');
    res.send(
      toCsv(
        list.map((s) => ({
          date: s.createdAt,
          status: s.status,
          orders: s.ordersCount,
          gross: s.grossSales,
          commission: s.commission,
          adjustment: s.adjustment,
          netPayable: s.netPayable,
          reference: s.reference,
          paidAt: s.paidAt,
        })),
      ),
    );
  } catch (error) {
    sendError(res, error, "Failed to export");
  }
};

// POST /api/shop/payout-requests   body: { note? }
export const createPayoutRequest = async (req: Request, res: Response) => {
  try {
    const shop: any = req.shop;
    if (!shop.payout?.method) {
      return res.status(400).json({ success: false, message: "Add your payout account (UPI or bank) first" });
    }
    if (await PayoutRequest.exists({ shop: shop._id, status: "open" })) {
      return res.status(409).json({ success: false, message: "You already have an open payout request" });
    }
    const u = await unsettledFor(shop);
    if (!u.ordersCount) return res.status(400).json({ success: false, message: "Nothing to pay out yet" });
    const pr = await PayoutRequest.create({
      shop: shop._id,
      requestedBy: req.user._id,
      ordersCount: u.ordersCount,
      grossSales: u.grossSales,
      estimatedNet: u.net,
      note: req.body.note ? String(req.body.note).slice(0, 300) : undefined,
    });
    await notifyAdmins({
      type: "payment",
      title: "Payout requested",
      body: `${shop.name}: about ₹${u.net} for ${u.ordersCount} orders`,
      data: { shopId: shop._id, payoutRequestId: pr._id },
    });
    res.status(201).json({ success: true, data: pr });
  } catch (error) {
    sendError(res, error, "Failed to create payout request");
  }
};

// ===================== DRIVER SIDE =====================

// GET /api/delivery/earnings?from=&to=
export const getDriverEarnings = async (req: Request, res: Response) => {
  try {
    const driver: any = req.driver;
    const match: any = { driver: driver._id, status: "delivered" };
    if (req.query.from || req.query.to) {
      match.deliveredAt = {};
      if (req.query.from) match.deliveredAt.$gte = new Date(String(req.query.from));
      if (req.query.to) match.deliveredAt.$lte = new Date(String(req.query.to));
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const sum = async (extra: any) => {
      const r: any[] = await Delivery.aggregate([
        { $match: { ...match, ...extra } },
        { $group: { _id: null, n: { $sum: 1 }, fees: { $sum: "$driverFee" }, cod: { $sum: "$codAmount" } } },
      ]);
      return { deliveries: r[0]?.n ?? 0, earnings: round2(r[0]?.fees ?? 0), codCollected: round2(r[0]?.cod ?? 0) };
    };
    const [all, unsettled, today, week, settlements] = await Promise.all([
      sum({}),
      sum({ driverSettlement: { $exists: false } }),
      sum({ deliveredAt: { $gte: startOfDay } }),
      sum({ deliveredAt: { $gte: weekAgo } }),
      DriverSettlement.find({ driver: driver._id }).select("-deliveries").sort("-createdAt").limit(20),
    ]);
    const settings = await getSettings();
    res.json({
      success: true,
      data: {
        feePerDelivery: settings.driverFee,
        today,
        last7Days: week,
        total: all,
        // what is still to be settled: fees owed to you minus the cash you are holding
        unsettled: { ...unsettled, net: round2(unsettled.earnings - unsettled.codCollected) },
        settlements,
        payoutAccount: maskAccount(driver.payout) || null,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch earnings");
  }
};

// PUT /api/delivery/payout-account
export const setDriverPayoutAccount = async (req: Request, res: Response) => {
  try {
    const driver: any = req.driver;
    const { bankName, ...rest } = cleanPayoutAccount(req.body) as any;
    driver.payout = rest;
    await driver.save();
    await logActivity(req, "driver.payout_account_updated", "DeliveryPartner", driver._id);
    res.json({ success: true, data: maskAccount(driver.payout) });
  } catch (error) {
    sendError(res, error, "Failed to save payout account");
  }
};

// ===================== ADMIN: DRIVER PAYOUTS =====================

const driverUnsettled = async (driverId: any) => {
  const list: any[] = await Delivery.find({ driver: driverId, status: "delivered", driverSettlement: { $exists: false } }).select(
    "order driverFee codAmount deliveredAt",
  );
  const earnings = round2(list.reduce((s, d) => s + (d.driverFee || 0), 0));
  const codCollected = round2(list.reduce((s, d) => s + (d.codAmount || 0), 0));
  return { list, earnings, codCollected, net: round2(earnings - codCollected) };
};

// GET /api/admin/driver-payouts/summary
export const driverPayoutsSummary = async (_req: Request, res: Response) => {
  try {
    const rows: any[] = await Delivery.aggregate([
      { $match: { status: "delivered", driverSettlement: { $exists: false }, driver: { $exists: true } } },
      { $group: { _id: "$driver", deliveries: { $sum: 1 }, earnings: { $sum: "$driverFee" }, cod: { $sum: "$codAmount" }, oldest: { $min: "$deliveredAt" } } },
    ]);
    const drivers: any[] = await DeliveryPartner.find({ _id: { $in: rows.map((r) => r._id) } }).select("fullName phone payout");
    const byId = new Map(drivers.map((d) => [d._id.toString(), d]));
    const data = rows
      .map((r) => ({
        driverId: r._id,
        name: byId.get(r._id.toString())?.fullName,
        phone: byId.get(r._id.toString())?.phone,
        hasPayoutAccount: !!byId.get(r._id.toString())?.payout?.method,
        deliveries: r.deliveries,
        earnings: round2(r.earnings),
        codHeld: round2(r.cod),
        // > 0 we pay the driver; < 0 the driver must hand cash over
        net: round2(r.earnings - r.cod),
        oldest: r.oldest,
      }))
      .sort((a, b) => a.net - b.net);
    res.json({
      success: true,
      data,
      totals: {
        owedToDrivers: round2(data.filter((d) => d.net > 0).reduce((t, d) => t + d.net, 0)),
        cashToCollect: round2(data.filter((d) => d.net < 0).reduce((t, d) => t - d.net, 0)),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build driver payouts");
  }
};

// GET /api/admin/driver-payouts/preview?driverId=
export const previewDriverSettlement = async (req: Request, res: Response) => {
  try {
    const driver: any = await DeliveryPartner.findById(req.query.driverId);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
    const u = await driverUnsettled(driver._id);
    res.json({
      success: true,
      data: { driver: { _id: driver._id, fullName: driver.fullName, phone: driver.phone, payout: driver.payout || null }, deliveries: u.list.length, earnings: u.earnings, codCollected: u.codCollected, net: u.net },
    });
  } catch (error) {
    sendError(res, error, "Failed to preview");
  }
};

// POST /api/admin/driver-payouts   body: { driverId, adjustment?, adjustmentNote?, reference?, notes? }
// Settles every delivered, unsettled job of the driver: fees owed minus cash they collected.
export const createDriverSettlement = async (req: Request, res: Response) => {
  try {
    const driver: any = await DeliveryPartner.findById(req.body.driverId);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
    const u = await driverUnsettled(driver._id);
    if (!u.list.length) return res.status(400).json({ success: false, message: "Nothing to settle for this driver" });
    const adjustment = round2(Number(req.body.adjustment) || 0);
    const doc: any = await DriverSettlement.create({
      driver: driver._id,
      deliveries: u.list.map((d) => d._id),
      deliveriesCount: u.list.length,
      earnings: u.earnings,
      codCollected: u.codCollected,
      adjustment,
      adjustmentNote: req.body.adjustmentNote,
      net: round2(u.earnings + adjustment - u.codCollected),
      reference: req.body.reference,
      notes: req.body.notes,
      createdBy: req.user._id,
    });
    const claimed = await Delivery.updateMany(
      { _id: { $in: doc.deliveries }, driverSettlement: { $exists: false } },
      { driverSettlement: doc._id },
    );
    if (claimed.modifiedCount !== u.list.length) {
      await Delivery.updateMany({ driverSettlement: doc._id }, { $unset: { driverSettlement: 1 } });
      await doc.deleteOne();
      return res.status(409).json({ success: false, message: "Deliveries changed while settling - please retry" });
    }
    await notify(driver.user, {
      type: "payment",
      title: doc.net >= 0 ? "Earnings paid" : "Cash remittance recorded",
      body: doc.net >= 0 ? `₹${doc.net} for ${doc.deliveriesCount} deliveries` : `You handed over ₹${Math.abs(doc.net)}`,
      data: { driverSettlementId: doc._id },
    });
    await logActivity(req, "driver_settlement.created", "DriverSettlement", doc._id, { driver: driver._id, net: doc.net });
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    sendError(res, error, "Failed to settle driver");
  }
};

// GET /api/admin/driver-payouts?driver=&page=
export const listDriverSettlements = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);
    const query: any = {};
    if (req.query.driver) query.driver = String(req.query.driver);
    const [total, data] = await Promise.all([
      DriverSettlement.countDocuments(query),
      DriverSettlement.find(query).select("-deliveries").populate("driver", "fullName phone").sort("-createdAt").skip((page - 1) * limit).limit(limit),
    ]);
    res.json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch driver settlements");
  }
};

// GET /api/admin/driver-payouts/export.csv
export const exportDriverSettlements = async (_req: Request, res: Response) => {
  try {
    const list: any[] = await DriverSettlement.find().populate("driver", "fullName phone").sort("-createdAt").limit(5000);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="driver-settlements.csv"');
    res.send(
      toCsv(
        list.map((s) => ({
          date: s.createdAt,
          driver: s.driver?.fullName,
          phone: s.driver?.phone,
          deliveries: s.deliveriesCount,
          earnings: s.earnings,
          codCollected: s.codCollected,
          adjustment: s.adjustment,
          net: s.net,
          reference: s.reference,
        })),
      ),
    );
  } catch (error) {
    sendError(res, error, "Failed to export");
  }
};

// GET /api/admin/payments/export.csv?from=&to=   (orders ledger for accounting)
export const exportOrdersCsv = async (req: Request, res: Response) => {
  try {
    const q: any = {};
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(String(req.query.from));
      if (req.query.to) q.createdAt.$lte = new Date(String(req.query.to));
    }
    if (req.query.search) q.orderNumber = new RegExp(escapeRegex(String(req.query.search)), "i");
    const list: any[] = await Order.find(q).populate("shop", "name").sort("-createdAt").limit(10000);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="orders.csv"');
    res.send(
      toCsv(
        list.map((o) => ({
          date: o.createdAt,
          orderNumber: o.orderNumber,
          shop: o.shop?.name,
          status: o.orderStatus,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          subtotal: o.subtotal,
          shipping: o.shippingCost,
          tax: o.tax,
          total: o.totalAmount,
        })),
      ),
    );
  } catch (error) {
    sendError(res, error, "Failed to export orders");
  }
};

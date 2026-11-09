import { Request, Response } from "express";
import User from "../models/User.js";
import Shop from "../models/Shop.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Delivery from "../models/Delivery.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Advertisement from "../models/Advertisement.js";
import { PAYMENT_STATUSES, SERVICE_LOCATIONS, SHOP_STATUSES, PARTNER_STATUSES, VEHICLE_TYPES } from "../types/index.js";
import { HttpError, round2, sendError } from "../utils/http.js";
import { destroyImages, uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { notify } from "../utils/notify.js";
import { logActivity } from "../utils/activity.js";
import { setUserRole } from "../utils/roles.js";
import { getSettings, saveSettings } from "../utils/settings.js";
import { transitionOrder } from "../utils/orderHelpers.js";
import { cleanPayoutAccount } from "./payoutController.js";

const parseList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p)) return p.map(String);
  } catch {
    /* comma separated */
  }
  return String(value).split(",").map((s) => s.trim()).filter(Boolean);
};

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);

/** Finds a user from `userId` or `email` (the person must have signed in at least once). */
const findUser = async (b: any) => {
  const user: any = b.userId ? await User.findById(b.userId) : b.email ? await User.findOne({ email: String(b.email).trim().toLowerCase() }) : null;
  if (!user) throw new HttpError(404, "No user with that email/id. They need to sign up once before you can assign them.");
  return user;
};

const parseCoordinates = (c: any) => {
  if (typeof c === "string") {
    try {
      c = JSON.parse(c);
    } catch {
      return undefined;
    }
  }
  return c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) ? { lat: Number(c.lat), lng: Number(c.lng) } : undefined;
};

const parseRate = (v: any) => {
  if (v === "" || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new HttpError(400, "commissionRate must be between 0 and 1 (e.g. 0.05), or empty for the platform default");
  return n;
};

// ===================== SHOPS =====================

const SHOP_FIELDS = ["name", "description", "phone", "email", "addressLine", "landmark", "location", "openingHours", "isOpen", "adminNotes"] as const;

// POST /api/admin/shops   (multipart; optional `logo`)
// body: owner email|userId, name, phone, location, ... ; created already APPROVED and the owner becomes shop_owner.
export const adminCreateShop = async (req: Request, res: Response) => {
  let logo: string | undefined;
  try {
    const owner = await findUser({ userId: req.body.ownerId || req.body.userId, email: req.body.ownerEmail || req.body.email });
    if (await Shop.exists({ owner: owner._id })) throw new HttpError(409, "That user already owns a shop");
    const { name, phone, location } = req.body;
    if (!name?.trim() || !phone?.trim()) throw new HttpError(400, "name and phone are required");
    if (!(SERVICE_LOCATIONS as readonly string[]).includes(location)) throw new HttpError(400, `location must be one of: ${SERVICE_LOCATIONS.join(", ")}`);

    const data: Record<string, any> = {};
    for (const f of SHOP_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
    if (req.body.categories !== undefined) data.categories = parseList(req.body.categories);
    const coords = parseCoordinates(req.body.coordinates);
    if (coords) data.coordinates = coords;
    const rate = req.body.commissionRate !== undefined ? parseRate(req.body.commissionRate) : null;
    if (rate !== null) data.commissionRate = rate;
    if (req.body.payoutMethod || req.body.payout) {
      data.payout = cleanPayoutAccount(req.body.payout ?? { method: req.body.payoutMethod, upiId: req.body.upiId, accountHolder: req.body.accountHolder, accountNumber: req.body.accountNumber, ifsc: req.body.ifsc, bankName: req.body.bankName });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) logo = (await uploadToCloudinary(file, "pj-digitals-estore/shops")).secure_url;

    const shop: any = await Shop.create({
      ...data,
      owner: owner._id,
      slug: slugify(name),
      logo,
      status: "approved",
      approvedAt: new Date(),
      approvedBy: req.user._id,
    });
    await setUserRole(owner, "shop_owner");
    await notify(owner._id, { type: "shop", title: `Your shop "${shop.name}" is ready`, body: "You can now add products and receive orders.", data: { shopId: shop._id } });
    await logActivity(req, "shop.created_by_admin", "Shop", shop._id, { owner: owner._id });
    res.status(201).json({ success: true, data: shop });
  } catch (error) {
    if (logo) await destroyImages([logo]);
    sendError(res, error, "Failed to create shop");
  }
};

// PUT /api/admin/shops/:id   (multipart; optional `logo`)
// Edit anything: profile, commission, payout account, notes, status, or hand the shop to another owner (`owner` email / `ownerId`).
export const adminUpdateShop = async (req: Request, res: Response) => {
  let newLogo: string | undefined;
  try {
    const shop: any = await Shop.findById(req.params.id);
    if (!shop) throw new HttpError(404, "Shop not found");
    const b = req.body;
    for (const f of SHOP_FIELDS) if (b[f] !== undefined) shop[f] = b[f];
    if (b.location !== undefined && !(SERVICE_LOCATIONS as readonly string[]).includes(b.location)) {
      throw new HttpError(400, `location must be one of: ${SERVICE_LOCATIONS.join(", ")}`);
    }
    if (b.categories !== undefined) shop.categories = parseList(b.categories);
    if (b.coordinates !== undefined) shop.coordinates = parseCoordinates(b.coordinates);
    if (b.commissionRate !== undefined) shop.commissionRate = parseRate(b.commissionRate) ?? undefined;
    if (b.payout !== undefined || b.payoutMethod !== undefined) {
      shop.payout = b.payout === null || b.payout === "" ? undefined : cleanPayoutAccount(b.payout ?? { method: b.payoutMethod, upiId: b.upiId, accountHolder: b.accountHolder, accountNumber: b.accountNumber, ifsc: b.ifsc, bankName: b.bankName });
    }

    // transfer to a different owner
    if (b.ownerEmail || b.ownerId) {
      const next = await findUser({ userId: b.ownerId, email: b.ownerEmail });
      if (String(next._id) !== String(shop.owner)) {
        if (await Shop.exists({ owner: next._id, _id: { $ne: shop._id } })) throw new HttpError(409, "That user already owns another shop");
        const prev: any = await User.findById(shop.owner);
        shop.owner = next._id;
        if (shop.status === "approved") await setUserRole(next, "shop_owner");
        if (prev && prev.role === "shop_owner") await setUserRole(prev, "user");
        await notify(next._id, { type: "shop", title: `You now manage "${shop.name}"`, data: { shopId: shop._id } });
      }
    }

    if (b.status !== undefined && b.status !== shop.status) {
      if (!(SHOP_STATUSES as readonly string[]).includes(b.status)) throw new HttpError(400, `status must be one of: ${SHOP_STATUSES.join(", ")}`);
      shop.status = b.status;
      shop.statusReason = b.statusReason || b.reason || undefined;
      if (b.status === "approved") {
        shop.approvedAt = new Date();
        shop.approvedBy = req.user._id;
        const o: any = await User.findById(shop.owner);
        if (o) await setUserRole(o, "shop_owner");
      }
    }

    const file = req.file as Express.Multer.File | undefined;
    const oldLogo = shop.logo;
    if (file) {
      newLogo = (await uploadToCloudinary(file, "pj-digitals-estore/shops")).secure_url;
      shop.logo = newLogo;
    }
    await shop.save();
    if (newLogo && oldLogo) await destroyImages([oldLogo]);
    await logActivity(req, "shop.edited_by_admin", "Shop", shop._id, { fields: Object.keys(b) });
    res.json({ success: true, data: shop });
  } catch (error) {
    if (newLogo) await destroyImages([newLogo]);
    sendError(res, error, "Failed to update shop");
  }
};

// DELETE /api/admin/shops/:id   Only shops that never had an order can be removed; otherwise suspend them.
export const adminDeleteShop = async (req: Request, res: Response) => {
  try {
    const shop: any = await Shop.findById(req.params.id);
    if (!shop) throw new HttpError(404, "Shop not found");
    if (await Order.exists({ shop: shop._id })) throw new HttpError(409, "This shop has orders - suspend it instead of deleting");
    await Product.updateMany({ shop: shop._id }, { isActive: false, $unset: { shop: 1 } });
    await Advertisement.deleteMany({ shop: shop._id });
    const owner: any = await User.findById(shop.owner);
    if (owner && owner.role === "shop_owner") await setUserRole(owner, "user");
    if (shop.logo) await destroyImages([shop.logo]);
    await shop.deleteOne();
    await logActivity(req, "shop.deleted", "Shop", shop._id, { name: shop.name });
    res.json({ success: true, message: "Shop deleted. Its products were unlisted." });
  } catch (error) {
    sendError(res, error, "Failed to delete shop");
  }
};

// PUT /api/admin/products/:id/assign   body: { shopId | null }   (move a product to another shop, or to the platform itself)
export const adminAssignProduct = async (req: Request, res: Response) => {
  try {
    const shopId = req.body.shopId;
    let shop: any = null;
    if (shopId) {
      shop = await Shop.findById(shopId);
      if (!shop) throw new HttpError(404, "Shop not found");
    }
    const product: any = await Product.findByIdAndUpdate(req.params.id, shop ? { shop: shop._id } : { $unset: { shop: 1 } }, { new: true });
    if (!product) throw new HttpError(404, "Product not found");
    await logActivity(req, "product.assigned", "Product", product._id, { shop: shop?._id ?? null });
    res.json({ success: true, data: product });
  } catch (error) {
    sendError(res, error, "Failed to assign product");
  }
};

// ===================== DRIVERS =====================

const DRIVER_FIELDS = ["fullName", "phone", "vehicleType", "vehicleNumber", "licenseNumber", "adminNotes"] as const;

// POST /api/admin/delivery-partners   (multipart; optional `photo`)  -> created APPROVED
export const adminCreateDriver = async (req: Request, res: Response) => {
  let photo: string | undefined;
  try {
    const user = await findUser(req.body);
    if (await DeliveryPartner.exists({ user: user._id })) throw new HttpError(409, "That user is already a delivery partner");
    const { fullName, phone, vehicleType } = req.body;
    if (!fullName?.trim() || !phone?.trim()) throw new HttpError(400, "fullName and phone are required");
    if (vehicleType && !(VEHICLE_TYPES as readonly string[]).includes(vehicleType)) throw new HttpError(400, `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}`);
    const data: Record<string, any> = {};
    for (const f of DRIVER_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
    if (req.body.payout) data.payout = (({ bankName, ...r }: any) => r)(cleanPayoutAccount(req.body.payout));
    const file = req.file as Express.Multer.File | undefined;
    if (file) photo = (await uploadToCloudinary(file, "pj-digitals-estore/drivers")).secure_url;

    const driver: any = await DeliveryPartner.create({
      ...data,
      user: user._id,
      serviceLocations: parseList(req.body.serviceLocations).filter((l) => (SERVICE_LOCATIONS as readonly string[]).includes(l)),
      photo,
      status: "approved",
      approvedAt: new Date(),
      approvedBy: req.user._id,
    });
    await setUserRole(user, "delivery_partner");
    await notify(user._id, { type: "delivery", title: "You're a delivery partner", body: "Go online to start receiving jobs.", data: { partnerId: driver._id } });
    await logActivity(req, "driver.created_by_admin", "DeliveryPartner", driver._id, { user: user._id });
    res.status(201).json({ success: true, data: driver });
  } catch (error) {
    if (photo) await destroyImages([photo]);
    sendError(res, error, "Failed to create delivery partner");
  }
};

// PUT /api/admin/delivery-partners/:id   (multipart; optional `photo`)
export const adminUpdateDriver = async (req: Request, res: Response) => {
  let newPhoto: string | undefined;
  try {
    const driver: any = await DeliveryPartner.findById(req.params.id);
    if (!driver) throw new HttpError(404, "Delivery partner not found");
    const b = req.body;
    for (const f of DRIVER_FIELDS) if (b[f] !== undefined) driver[f] = b[f];
    if (b.vehicleType !== undefined && !(VEHICLE_TYPES as readonly string[]).includes(b.vehicleType)) throw new HttpError(400, `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}`);
    if (b.serviceLocations !== undefined) driver.serviceLocations = parseList(b.serviceLocations).filter((l) => (SERVICE_LOCATIONS as readonly string[]).includes(l));
    if (b.isAvailable !== undefined) driver.isAvailable = b.isAvailable === true || b.isAvailable === "true";
    if (b.payout !== undefined) driver.payout = b.payout ? (({ bankName, ...r }: any) => r)(cleanPayoutAccount(b.payout)) : undefined;
    if (b.status !== undefined && b.status !== driver.status) {
      if (!(PARTNER_STATUSES as readonly string[]).includes(b.status)) throw new HttpError(400, `status must be one of: ${PARTNER_STATUSES.join(", ")}`);
      driver.status = b.status;
      driver.statusReason = b.statusReason || b.reason || undefined;
      if (b.status === "approved") {
        driver.approvedAt = new Date();
        driver.approvedBy = req.user._id;
        const u: any = await User.findById(driver.user);
        if (u) await setUserRole(u, "delivery_partner");
      } else {
        driver.isAvailable = false;
      }
    }
    const file = req.file as Express.Multer.File | undefined;
    const oldPhoto = driver.photo;
    if (file) {
      newPhoto = (await uploadToCloudinary(file, "pj-digitals-estore/drivers")).secure_url;
      driver.photo = newPhoto;
    }
    await driver.save();
    if (newPhoto && oldPhoto) await destroyImages([oldPhoto]);
    await logActivity(req, "driver.edited_by_admin", "DeliveryPartner", driver._id, { fields: Object.keys(b) });
    res.json({ success: true, data: driver });
  } catch (error) {
    if (newPhoto) await destroyImages([newPhoto]);
    sendError(res, error, "Failed to update delivery partner");
  }
};

// ===================== USERS =====================

// PUT /api/admin/users/:id/active   body: { isActive: boolean }   (block / unblock an account)
export const setUserActive = async (req: Request, res: Response) => {
  try {
    const user: any = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, "User not found");
    const active = req.body.isActive === true || req.body.isActive === "true";
    if (!active && String(user._id) === String(req.user._id)) throw new HttpError(400, "You can't block your own account");
    user.isActive = active;
    await user.save();
    await logActivity(req, active ? "user.unblocked" : "user.blocked", "User", user._id);
    res.json({ success: true, data: user });
  } catch (error) {
    sendError(res, error, "Failed to update user");
  }
};

// ===================== SETTINGS =====================

// GET /api/admin/settings
export const getPlatformSettings = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getSettings() });
  } catch (error) {
    sendError(res, error, "Failed to fetch settings");
  }
};

// PUT /api/admin/settings   (any subset of the settings)
export const updatePlatformSettings = async (req: Request, res: Response) => {
  try {
    let data;
    try {
      data = await saveSettings(req.body, req.user._id);
    } catch (e: any) {
      throw new HttpError(400, e.message);
    }
    await logActivity(req, "settings.updated", "Setting", undefined, { keys: Object.keys(req.body) });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Failed to save settings");
  }
};

// ===================== BROADCAST =====================

// POST /api/admin/broadcast   body: { title, body?, audience: all|customers|shops|drivers|user, userId? }
export const broadcast = async (req: Request, res: Response) => {
  try {
    const { title, body, audience = "all" } = req.body;
    if (!title?.trim()) throw new HttpError(400, "title is required");
    const q: any = { isActive: { $ne: false } };
    if (audience === "customers") q.role = "user";
    else if (audience === "shops") q.role = "shop_owner";
    else if (audience === "drivers") q.role = "delivery_partner";
    else if (audience === "user") q._id = req.body.userId;
    else if (audience !== "all") throw new HttpError(400, "audience must be all, customers, shops, drivers or user");
    const ids = await User.find(q).distinct("_id");
    if (!ids.length) throw new HttpError(400, "No recipients");
    for (let i = 0; i < ids.length; i += 500) {
      await notify(ids.slice(i, i + 500), { type: "system", title: title.trim(), body: body?.trim() });
    }
    await logActivity(req, "broadcast.sent", "User", undefined, { audience, recipients: ids.length, title });
    res.json({ success: true, recipients: ids.length });
  } catch (error) {
    sendError(res, error, "Failed to send broadcast");
  }
};

// ===================== ORDER / DELIVERY OVERRIDES =====================

// PUT /api/admin/orders/:id/payment   body: { paymentStatus, note? }   (e.g. mark a bank-transferred order paid, or refunded)
export const adminSetPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentStatus } = req.body;
    if (!(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) throw new HttpError(400, `paymentStatus must be one of: ${PAYMENT_STATUSES.join(", ")}`);
    const order: any = await Order.findById(req.params.id);
    if (!order) throw new HttpError(404, "Order not found");
    if (order.settlement) throw new HttpError(400, "This order is already in a settlement");
    const before = order.paymentStatus;
    order.paymentStatus = paymentStatus;
    if (paymentStatus === "paid" && !order.paidAt) order.paidAt = new Date();
    await order.save();
    await notify(order.user, { type: "payment", title: `Payment ${paymentStatus}`, body: order.orderNumber, data: { orderId: order._id } });
    await logActivity(req, "order.payment_overridden", "Order", order._id, { from: before, to: paymentStatus, note: req.body.note });
    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to update payment");
  }
};

// PUT /api/admin/deliveries/:id/status   body: { status, note? }
// Admin override of the driver flow (e.g. driver's phone died; mark it delivered, or failed).
export const adminSetDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { status, note } = req.body;
    if (!["picked_up", "on_the_way", "delivered", "failed"].includes(status)) throw new HttpError(400, "status must be picked_up, on_the_way, delivered or failed");
    const job: any = await Delivery.findById(req.params.id);
    if (!job) throw new HttpError(404, "Delivery not found");
    if (["delivered", "cancelled", "failed", "rejected"].includes(job.status)) throw new HttpError(400, `Delivery is already ${job.status}`);
    const order: any = await Order.findById(job.order);
    if (!order || order.orderStatus === "cancelled") throw new HttpError(400, "Order is cancelled");
    const now = new Date();
    job.status = status;
    job.timeline.push({ status, at: now, note: `Admin: ${note || "manual update"}` });
    if (status === "picked_up") {
      job.pickedUpAt = now;
      if (["placed", "processing"].includes(order.orderStatus)) await transitionOrder(order, "shipping", "system");
    } else if (status === "delivered") {
      job.deliveredAt = now;
      job.driverFee = (await getSettings()).driverFee;
      await transitionOrder(order, "delivered", "system");
      if (job.driver) await DeliveryPartner.updateOne({ _id: job.driver }, { $inc: { completedDeliveries: 1 } });
    } else if (status === "failed") {
      job.failureReason = note;
    }
    await job.save();
    await notify(order.user, { type: "delivery", title: `Delivery ${status.replace("_", " ")}`, body: order.orderNumber, data: { orderId: order._id, deliveryId: job._id } });
    await logActivity(req, "delivery.overridden", "Delivery", job._id, { status, note });
    res.json({ success: true, data: job });
  } catch (error) {
    sendError(res, error, "Failed to update delivery");
  }
};

// GET /api/admin/overview   extra dashboard numbers: money owed, COD in the field, ad performance, today's activity
export const adminOverview = async (_req: Request, res: Response) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [today, codInField, adTotals, topShops, shopsOwed, driverFees] = await Promise.all([
      Order.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] } } } }]),
      Delivery.aggregate([{ $match: { status: { $in: ["delivered"] }, driverSettlement: { $exists: false } } }, { $group: { _id: null, cod: { $sum: "$codAmount" } } }]),
      Advertisement.aggregate([{ $group: { _id: "$status", n: { $sum: 1 }, impressions: { $sum: "$impressions" }, clicks: { $sum: "$clicks" } } }]),
      Order.aggregate([
        { $match: { paymentStatus: "paid", orderStatus: { $ne: "cancelled" }, shop: { $exists: true } } },
        { $group: { _id: "$shop", revenue: { $sum: "$subtotal" }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([{ $match: { orderStatus: "delivered", paymentStatus: "paid", settlement: { $exists: false }, shop: { $exists: true } } }, { $group: { _id: null, gross: { $sum: "$subtotal" } } }]),
      Delivery.aggregate([{ $match: { status: "delivered", driverSettlement: { $exists: false } } }, { $group: { _id: null, fees: { $sum: "$driverFee" } } }]),
    ]);
    const shops: any[] = await Shop.find({ _id: { $in: topShops.map((t) => t._id) } }).select("name");
    const names = new Map(shops.map((s) => [s._id.toString(), s.name]));
    res.json({
      success: true,
      data: {
        today: { orders: today[0]?.orders ?? 0, revenue: round2(today[0]?.revenue ?? 0) },
        codHeldByDrivers: round2(codInField[0]?.cod ?? 0),
        shopSalesAwaitingSettlement: round2(shopsOwed[0]?.gross ?? 0),
        driverFeesAwaitingSettlement: round2(driverFees[0]?.fees ?? 0),
        ads: adTotals.map((a) => ({ status: a._id, count: a.n, impressions: a.impressions, clicks: a.clicks })),
        topShops: topShops.map((t) => ({ shopId: t._id, name: names.get(t._id.toString()), revenue: round2(t.revenue), orders: t.orders })),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to build overview");
  }
};


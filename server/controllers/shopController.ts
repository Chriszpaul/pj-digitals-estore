import { Request, Response } from "express";
import Shop from "../models/Shop.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import Settlement from "../models/Settlement.js";
import { ORDER_STATUSES, SERVICE_LOCATIONS } from "../types/index.js";
import { escapeRegex, sendError } from "../utils/http.js";
import { destroyImages, uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { attachDeliveries, transitionOrder } from "../utils/orderHelpers.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { getSettings } from "../utils/settings.js";

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
  "-" +
  Math.random().toString(36).slice(2, 6);

const parseList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* comma separated */
  }
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const PROFILE_FIELDS = [
  "name",
  "description",
  "phone",
  "email",
  "addressLine",
  "landmark",
  "location",
  "openingHours",
  "isOpen",
] as const;

const pickProfile = (body: any) => {
  const out: Record<string, any> = {};
  for (const f of PROFILE_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (body.categories !== undefined) out.categories = parseList(body.categories);
  if (body.coordinates !== undefined) {
    let c = body.coordinates;
    if (typeof c === "string") {
      try {
        c = JSON.parse(c);
      } catch {
        c = undefined;
      }
    }
    if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
      out.coordinates = { lat: Number(c.lat), lng: Number(c.lng) };
    }
  }
  return out;
};

const PUBLIC_SELECT = "-owner -statusReason -approvedBy";

// ===================== PUBLIC (customer app) =====================

// GET /api/shops?location=&search=&category=&page=&limit=
export const listShops = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = { status: "approved" };

    if (req.query.location) query.location = String(req.query.location);
    if (req.query.category) query.categories = String(req.query.category);
    if (req.query.search) {
      query.name = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
    }

    const [total, shops] = await Promise.all([
      Shop.countDocuments(query),
      Shop.find(query)
        .select(PUBLIC_SELECT)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: shops,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch shops");
  }
};

// GET /api/shops/:id
export const getShop = async (req: Request, res: Response) => {
  try {
    const shop = await Shop.findOne({ _id: req.params.id, status: "approved" }).select(
      PUBLIC_SELECT,
    );
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }
    const productCount = await Product.countDocuments({ shop: shop._id, isActive: true });
    res.json({ success: true, data: { ...shop.toObject(), productCount } });
  } catch (error) {
    sendError(res, error, "Failed to fetch shop");
  }
};

// ===================== APPLY / OWN PROFILE =====================

// POST /api/shops/apply   (multipart; optional `logo` file)
// Any signed-in user can apply. The shop starts as "pending" and becomes usable
// (and the user becomes a shop_owner) once an admin approves it.
export const applyForShop = async (req: Request, res: Response) => {
  let logo: string | undefined;
  try {
    if (await Shop.exists({ owner: req.user._id })) {
      return res
        .status(409)
        .json({ success: false, message: "You have already applied for a shop" });
    }

    const data = pickProfile(req.body);
    if (!data.name?.trim() || !data.phone?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "name and phone are required" });
    }
    if (!(SERVICE_LOCATIONS as readonly string[]).includes(data.location)) {
      return res.status(400).json({
        success: false,
        message: `location must be one of: ${SERVICE_LOCATIONS.join(", ")}`,
      });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) logo = (await uploadToCloudinary(file, "pj-digitals-estore/shops")).secure_url;

    const shop = await Shop.create({
      ...data,
      isOpen: undefined, // always starts with the default
      owner: req.user._id,
      slug: slugify(data.name),
      logo,
      status: "pending",
    });

    await notifyAdmins({
      type: "shop",
      title: "New shop application",
      body: shop.name,
      data: { shopId: shop._id },
    });

    res.status(201).json({ success: true, data: shop });
  } catch (error) {
    if (logo) await destroyImages([logo]);
    sendError(res, error, "Failed to submit shop application");
  }
};

// GET /api/shop/me   (works while pending so the app can show the status)
export const getMyShop = async (req: Request, res: Response) => {
  res.json({ success: true, data: req.shop });
};

// PUT /api/shop/me   (multipart; optional `logo`)
export const updateMyShop = async (req: Request, res: Response) => {
  let newLogo: string | undefined;
  try {
    const shop = req.shop;
    const updates = pickProfile(req.body);

    if (updates.location && !(SERVICE_LOCATIONS as readonly string[]).includes(updates.location)) {
      return res.status(400).json({
        success: false,
        message: `location must be one of: ${SERVICE_LOCATIONS.join(", ")}`,
      });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      newLogo = (await uploadToCloudinary(file, "pj-digitals-estore/shops")).secure_url;
      updates.logo = newLogo;
    }

    const oldLogo = shop.logo;
    shop.set(updates);
    await shop.save();
    if (newLogo && oldLogo) await destroyImages([oldLogo]);

    res.json({ success: true, data: shop });
  } catch (error) {
    if (newLogo) await destroyImages([newLogo]);
    sendError(res, error, "Failed to update shop");
  }
};

// ===================== OWNER: INVENTORY =====================

// GET /api/shop/products?search=&lowStock=true&isActive=&page=&limit=
export const getShopProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = { shop: req.shop._id };

    if (req.query.search) {
      query.name = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
    }
    if (req.query.lowStock === "true") query.stock = { $lte: (await getSettings()).lowStockLevel };
    if (req.query.isActive === "true" || req.query.isActive === "false") {
      query.isActive = req.query.isActive === "true";
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort("-updatedAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch inventory");
  }
};

// PUT /api/shop/products/:id/stock   body: { stock } (set) OR { adjust } (+/-)
export const updateStock = async (req: Request, res: Response) => {
  try {
    const { stock, adjust } = req.body;
    const filter: any = { _id: req.params.id, shop: req.shop._id };
    let update: any;

    if (stock !== undefined) {
      const n = Number(stock);
      if (!Number.isInteger(n) || n < 0) {
        return res
          .status(400)
          .json({ success: false, message: "stock must be a whole number >= 0" });
      }
      update = { stock: n };
    } else if (adjust !== undefined) {
      const n = Number(adjust);
      if (!Number.isInteger(n) || n === 0) {
        return res
          .status(400)
          .json({ success: false, message: "adjust must be a non-zero whole number" });
      }
      if (n < 0) filter.stock = { $gte: -n }; // never go below zero
      update = { $inc: { stock: n } };
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Provide stock or adjust" });
    }

    const product = await Product.findOneAndUpdate(filter, update, { new: true });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found (or not enough stock to remove)",
      });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    sendError(res, error, "Failed to update stock");
  }
};

// ===================== OWNER: ORDERS =====================

// GET /api/shop/orders?status=&page=&limit=   (includes delivery info)
export const getShopOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    // unpaid online orders aren't the shop's yet (they expire if never paid)
    const query: any = {
      shop: req.shop._id,
      $or: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }],
    };
    if (req.query.status) query.orderStatus = String(req.query.status);

    const [total, orders] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .populate("user", "name")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: await attachDeliveries(orders),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

// PUT /api/shop/orders/:id/status   body: { orderStatus: "processing" | "cancelled" }
// ("shipping"/"delivered" are driven by the delivery partner.)
export const updateShopOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus } = req.body;
    if (!(ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return res
        .status(400)
        .json({ success: false, message: `orderStatus must be one of: ${ORDER_STATUSES.join(", ")}` });
    }

    const order: any = await Order.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (
      order.paymentMethod === "razorpay" &&
      order.paymentStatus !== "paid" &&
      orderStatus !== "cancelled"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "This online order hasn't been paid yet" });
    }

    await transitionOrder(order, orderStatus, "shop");

    await notify(order.user, {
      type: "order",
      title: `Order ${order.orderNumber} is ${orderStatus}`,
      body: req.shop.name,
      data: { orderId: order._id },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to update order");
  }
};

// ===================== OWNER: STATS / SETTLEMENTS =====================

// GET /api/shop/stats?days=30
export const getShopStats = async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const shopId = req.shop._id;
    const lowLevel = (await getSettings()).lowStockLevel;

    const [totals, statusAgg, daily, topProducts, lowStock, productCount] = await Promise.all([
      Order.aggregate([
        { $match: { shop: shopId, orderStatus: { $ne: "cancelled" }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            sales: { $sum: "$subtotal" },
            paidSales: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$subtotal", 0] },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { shop: shopId } },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { shop: shopId, orderStatus: { $ne: "cancelled" }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
            orders: { $sum: 1 },
            sales: { $sum: "$subtotal" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { shop: shopId, orderStatus: { $ne: "cancelled" }, createdAt: { $gte: since } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            unitsSold: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
      ]),
      Product.find({ shop: shopId, isActive: true, stock: { $lte: lowLevel } })
        .select("name stock images")
        .sort("stock")
        .limit(10),
      Product.countDocuments({ shop: shopId }),
    ]);

    res.json({
      success: true,
      data: {
        periodDays: days,
        orders: totals[0]?.orders ?? 0,
        sales: totals[0]?.sales ?? 0,
        paidSales: totals[0]?.paidSales ?? 0,
        productCount,
        ordersByStatus: Object.fromEntries(statusAgg.map((s) => [s._id, s.count])),
        dailySales: daily.map((d) => ({ date: d._id, orders: d.orders, sales: d.sales })),
        topProducts,
        lowStockProducts: lowStock,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load stats");
  }
};

// GET /api/shop/settlements
export const getShopSettlements = async (req: Request, res: Response) => {
  try {
    const settlements = await Settlement.find({ shop: req.shop._id })
      .select("-orders")
      .sort("-createdAt");
    res.json({ success: true, data: settlements });
  } catch (error) {
    sendError(res, error, "Failed to fetch settlements");
  }
};

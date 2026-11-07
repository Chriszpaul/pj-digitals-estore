import { Request, Response } from "express";
import User from "../models/User.js";
import Shop from "../models/Shop.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Delivery from "../models/Delivery.js";
import ActivityLog from "../models/ActivityLog.js";
import { escapeRegex, HttpError, sendError } from "../utils/http.js";
import { notify } from "../utils/notify.js";
import { logActivity } from "../utils/activity.js";
import { setUserRole } from "../utils/roles.js";
import { assignDelivery } from "../utils/deliveryHelpers.js";

const paging = (req: Request, defLimit = 20) => ({
  page: Math.max(1, Number(req.query.page) || 1),
  limit: Math.min(100, Math.max(1, Number(req.query.limit) || defLimit)),
});

// ===================== USERS (customers etc.) =====================

// GET /api/admin/users/:id   customer details + activity summary
export const getUserDetail = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const [orders, spent, shop, deliveryPartner, recentOrders] = await Promise.all([
      Order.countDocuments({ user: user._id }),
      Order.aggregate([
        { $match: { user: user._id, paymentStatus: "paid", orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Shop.findOne({ owner: user._id }),
      DeliveryPartner.findOne({ user: user._id }),
      Order.find({ user: user._id }).sort("-createdAt").limit(5).select("orderNumber totalAmount orderStatus paymentStatus createdAt"),
    ]);

    res.json({
      success: true,
      data: { user, orderCount: orders, totalSpent: spent[0]?.total ?? 0, shop, deliveryPartner, recentOrders },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch user");
  }
};

// ===================== SHOPS =====================

// GET /api/admin/shops?status=&location=&search=&page=&limit=
export const adminListShops = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);
    const query: any = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.location) query.location = String(req.query.location);
    if (req.query.search) query.name = new RegExp(escapeRegex(String(req.query.search)), "i");

    const [total, shops] = await Promise.all([
      Shop.countDocuments(query),
      Shop.find(query)
        .populate("owner", "name email")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data: shops, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch shops");
  }
};

// GET /api/admin/shops/:id
export const adminGetShop = async (req: Request, res: Response) => {
  try {
    const shop = await Shop.findById(req.params.id).populate("owner", "name email image");
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    const [products, orders, sales] = await Promise.all([
      Product.countDocuments({ shop: shop._id }),
      Order.countDocuments({ shop: shop._id }),
      Order.aggregate([
        { $match: { shop: shop._id, orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, sales: { $sum: "$subtotal" } } },
      ]),
    ]);
    res.json({
      success: true,
      data: { shop, productCount: products, orderCount: orders, totalSales: sales[0]?.sales ?? 0 },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch shop");
  }
};

// PUT /api/admin/shops/:id/status   body: { status: approved|rejected|suspended|pending, reason? }
export const adminSetShopStatus = async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!["approved", "rejected", "suspended", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be approved, rejected, suspended or pending",
      });
    }
    if (["rejected", "suspended"].includes(status) && !reason?.trim()) {
      return res.status(400).json({ success: false, message: "Please give a reason" });
    }

    const shop: any = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

    shop.status = status;
    shop.statusReason = reason?.trim() || undefined;
    if (status === "approved") {
      shop.approvedAt = new Date();
      shop.approvedBy = req.user._id;
    }
    await shop.save();

    const owner: any = await User.findById(shop.owner);
    if (owner && owner.role !== "admin") {
      if (status === "approved") await setUserRole(owner, "shop_owner");
      if (status === "rejected") await setUserRole(owner, "user");
      // suspended keeps the role; loadShop() blocks access while suspended
    }

    await notify(shop.owner, {
      type: "shop",
      title: `Your shop "${shop.name}" is ${status}`,
      body: reason?.trim(),
      data: { shopId: shop._id, status },
    });
    await logActivity(req, `shop.${status}`, "Shop", shop._id, { reason });

    res.json({ success: true, data: shop });
  } catch (error) {
    sendError(res, error, "Failed to update shop status");
  }
};

// ===================== DELIVERY PARTNERS =====================

// GET /api/admin/delivery-partners?status=&available=true&location=&search=
export const adminListPartners = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);
    const query: any = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.available === "true") query.isAvailable = true;
    if (req.query.location) query.serviceLocations = String(req.query.location);
    if (req.query.search) query.fullName = new RegExp(escapeRegex(String(req.query.search)), "i");

    const [total, partners] = await Promise.all([
      DeliveryPartner.countDocuments(query),
      DeliveryPartner.find(query)
        .populate("user", "name email")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data: partners, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch delivery partners");
  }
};

// GET /api/admin/delivery-partners/:id
export const adminGetPartner = async (req: Request, res: Response) => {
  try {
    const partner = await DeliveryPartner.findById(req.params.id).populate("user", "name email image");
    if (!partner) return res.status(404).json({ success: false, message: "Delivery partner not found" });

    const [activeJobs, delivered, recent] = await Promise.all([
      Delivery.countDocuments({ driver: partner._id, status: { $in: ["assigned", "accepted", "picked_up", "on_the_way"] } }),
      Delivery.countDocuments({ driver: partner._id, status: "delivered" }),
      Delivery.find({ driver: partner._id }).sort("-updatedAt").limit(10).populate("order", "orderNumber"),
    ]);
    res.json({ success: true, data: { partner, activeJobs, delivered, recentDeliveries: recent } });
  } catch (error) {
    sendError(res, error, "Failed to fetch delivery partner");
  }
};

// PUT /api/admin/delivery-partners/:id/status   body: { status, reason? }
export const adminSetPartnerStatus = async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!["approved", "rejected", "suspended", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be approved, rejected, suspended or pending",
      });
    }
    if (["rejected", "suspended"].includes(status) && !reason?.trim()) {
      return res.status(400).json({ success: false, message: "Please give a reason" });
    }

    const partner: any = await DeliveryPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: "Delivery partner not found" });

    partner.status = status;
    partner.statusReason = reason?.trim() || undefined;
    if (status === "approved") {
      partner.approvedAt = new Date();
      partner.approvedBy = req.user._id;
    } else {
      partner.isAvailable = false;
    }
    await partner.save();

    const user: any = await User.findById(partner.user);
    if (user && user.role !== "admin") {
      if (status === "approved") await setUserRole(user, "delivery_partner");
      if (status === "rejected") await setUserRole(user, "user");
    }

    await notify(partner.user, {
      type: "delivery",
      title: `Your delivery-partner account is ${status}`,
      body: reason?.trim(),
      data: { partnerId: partner._id, status },
    });
    await logActivity(req, `partner.${status}`, "DeliveryPartner", partner._id, { reason });

    res.json({ success: true, data: partner });
  } catch (error) {
    sendError(res, error, "Failed to update delivery partner");
  }
};

// ===================== DELIVERIES =====================

// GET /api/admin/deliveries?status=&driver=&shop=&unassigned=true&page=&limit=
// unassigned=true lists paid/COD orders that still have no delivery record
export const adminListDeliveries = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req);

    if (req.query.unassigned === "true") {
      const assigned = await Delivery.find({ status: { $nin: ["rejected", "failed", "cancelled"] } }).distinct("order");
      const query: any = {
        _id: { $nin: assigned },
        orderStatus: { $in: ["placed", "processing"] },
        // online orders must be paid before dispatch; COD can go straight out
        $or: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }],
      };
      const [total, orders] = await Promise.all([
        Order.countDocuments(query),
        Order.find(query)
          .populate("shop", "name location")
          .sort("createdAt")
          .skip((page - 1) * limit)
          .limit(limit),
      ]);
      return res.json({ success: true, data: orders, pagination: { total, page, pages: Math.ceil(total / limit) } });
    }

    const query: any = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.driver) query.driver = String(req.query.driver);
    if (req.query.shop) query.shop = String(req.query.shop);

    const [total, deliveries] = await Promise.all([
      Delivery.countDocuments(query),
      Delivery.find(query)
        .populate("order", "orderNumber totalAmount paymentMethod orderStatus")
        .populate("driver", "fullName phone")
        .populate("shop", "name")
        .sort("-updatedAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data: deliveries, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch deliveries");
  }
};

// POST /api/admin/deliveries   body: { orderId, driverId }   (assign or re-assign)
export const adminAssignDelivery = async (req: Request, res: Response) => {
  try {
    const { orderId, driverId } = req.body;
    if (!orderId || !driverId) {
      return res.status(400).json({ success: false, message: "orderId and driverId are required" });
    }
    const order: any = await Order.findById(orderId).select("paymentMethod paymentStatus");
    if (order && order.paymentMethod === "razorpay" && order.paymentStatus !== "paid") {
      throw new HttpError(400, "Online order hasn't been paid yet");
    }
    const delivery = await assignDelivery(orderId, driverId, req.user._id);
    await logActivity(req, "delivery.assigned", "Delivery", delivery._id, { orderId, driverId });
    res.status(201).json({ success: true, data: delivery });
  } catch (error) {
    sendError(res, error, "Failed to assign delivery");
  }
};

// PUT /api/admin/deliveries/:id/cancel   body: { reason? }
export const adminCancelDelivery = async (req: Request, res: Response) => {
  try {
    const delivery: any = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ success: false, message: "Delivery not found" });
    if (["delivered", "cancelled"].includes(delivery.status)) {
      return res.status(400).json({ success: false, message: `Delivery is already ${delivery.status}` });
    }
    delivery.status = "cancelled";
    delivery.timeline.push({ status: "cancelled", at: new Date(), note: req.body.reason });
    await delivery.save();

    const driver: any = await DeliveryPartner.findById(delivery.driver).select("user");
    if (driver) {
      await notify(driver.user, {
        type: "delivery",
        title: "Delivery cancelled",
        body: req.body.reason,
        data: { deliveryId: delivery._id },
      });
    }
    await logActivity(req, "delivery.cancelled", "Delivery", delivery._id, { reason: req.body.reason });
    res.json({ success: true, data: delivery });
  } catch (error) {
    sendError(res, error, "Failed to cancel delivery");
  }
};

// ===================== ACTIVITY LOG =====================

// GET /api/admin/activity-logs?action=&actor=&targetType=&page=&limit=
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { page, limit } = paging(req, 50);
    const query: any = {};
    if (req.query.action) query.action = new RegExp("^" + escapeRegex(String(req.query.action)));
    if (req.query.actor) query.actor = String(req.query.actor);
    if (req.query.targetType) query.targetType = String(req.query.targetType);

    const [total, logs] = await Promise.all([
      ActivityLog.countDocuments(query),
      ActivityLog.find(query)
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.json({ success: true, data: logs, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error, "Failed to fetch activity logs");
  }
};

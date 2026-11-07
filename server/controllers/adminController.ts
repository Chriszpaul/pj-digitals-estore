import { Request, Response } from "express";
import User from "../models/User.js";
import Shop from "../models/Shop.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Delivery from "../models/Delivery.js";
import Advertisement from "../models/Advertisement.js";
import Ticket from "../models/Ticket.js";
import { ROLES } from "../types/index.js";
import { setUserRole } from "../utils/roles.js";
import { logActivity } from "../utils/activity.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import { escapeRegex, sendError } from "../utils/http.js";

const LOW_STOCK = 5;

// Get dashboard stats
// GET /api/admin/stats   (also used by /api/dealer/stats)
export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      revenueAgg,
      statusAgg,
      lowStock,
      recentOrders,
      pendingShops,
      pendingPartners,
      pendingAds,
      openTickets,
      activeDeliveries,
      unassignedOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      // computed in the database instead of loading every order into memory.
      // Revenue = money actually received.
      Order.aggregate([
        { $match: { paymentStatus: "paid", orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
      Product.find({ isActive: true, stock: { $lte: LOW_STOCK } })
        .select("name stock images")
        .sort("stock")
        .limit(10),
      Order.find().sort("-createdAt").limit(5).populate("user", "name email"),
      Shop.countDocuments({ status: "pending" }),
      DeliveryPartner.countDocuments({ status: "pending" }),
      Advertisement.countDocuments({ status: "pending" }),
      Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      Delivery.countDocuments({ status: { $in: ["assigned", "accepted", "picked_up", "on_the_way"] } }),
      Order.countDocuments({ orderStatus: { $in: ["placed", "processing"] }, $or: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }] }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue: revenueAgg[0]?.total ?? 0,
        ordersByStatus: Object.fromEntries(statusAgg.map((s) => [s._id, s.count])),
        lowStockProducts: lowStock,
        recentOrders,
        pending: {
          shops: pendingShops,
          deliveryPartners: pendingPartners,
          advertisements: pendingAds,
          supportTickets: openTickets,
        },
        deliveries: { active: activeDeliveries, ordersAwaitingAssignment: unassignedOrders },
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load stats");
  }
};

// List users
// GET /api/admin/users?page=&limit=&search=&role=
export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = {};

    if (req.query.role) query.role = String(req.query.role);
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search)), "i");
      query.$or = [{ name: rx }, { email: rx }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch users");
  }
};

// Change a user's role
// PUT /api/admin/users/:id/role   body: { role }
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!(ROLES as readonly string[]).includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: `role must be one of: ${ROLES.join(", ")}` });
    }
    if (req.params.id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "You can't change your own role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const before = user.role;
    await setUserRole(user, role);
    await logActivity(req, "user.role_changed", "User", user._id, { from: before, to: role });

    res.json({ success: true, data: user });
  } catch (error) {
    sendError(res, error, "Failed to update role");
  }
};

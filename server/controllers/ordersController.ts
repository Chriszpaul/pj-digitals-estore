import { Request, Response } from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Products.js";

// Get user orders
// GET /api/orders
export const getOrders = async (req: Request, res: Response) => {
  try {
    const query = { user: req.user._id };
    const orders = await Order.find(query)
      .populate("items.product", "name images")
      .sort("-createdAt");

    res.json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single orders
// GET /api/orders/:id
export const getOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "name images",
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      order.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not auth" });
    }

    return res.status(403).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create order from cart
// POST /api/orders
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { shippingAddress, notes } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Verify stock nd prepare order items
    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `insufficiant stock for ${(item.product as any).name}`,
        });
      }
      orderItems.push({
        product: item.product._id,
        name: (item.product as any).name,
        quantity: item.price,
        size: item.size,
      });

      //   reduce stock
      product.stock -= item.quantity;
      await product.save();
    }
    const subtotal = cart.totalAmount;
    const shippingCost = 2;
    const tax = 0;
    const totalAmount = subtotal + shippingCost + tax;

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: req.body.paymentMethod || "cash",
      paymentStatus: "pending",
      subtotal,
      shippingCost,
      tax,
      totalAmount,
      notes,
      paymentIntentId: req.body.paymentIntendId,
      orderNumber: "ORD-" + Date.now(),
    });

    if (req.body.paymentMethod !== "stripe") {
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();
    }

    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// update order Status
// PUT /api/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "order not found" });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (orderStatus === "delivered") order.deliveredAt = new Date();

    await order.save();
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all orders
// GET /api/orders/admin/all

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query: any = {};

    if (status) query.orderStatus = status;

    const total = await Order.countDocuments(query);
    const order = await Order.find(query)
      .populate("user", "name email")
      .populate("ite,s.product", "name")
      .sort("-createdAt")
      .skip((Number(page) - 1) * Number(limit));

    res.json({
      success: true,
      data: getOrders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

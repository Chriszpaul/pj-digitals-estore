import { Request, Response } from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Address from "../models/Address.js";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PaymentMethod,
} from "../types/index.js";
import { escapeRegex, HttpError, sendError } from "../utils/http.js";
import { computeTotals } from "../utils/pricing.js";
import {
  generateOrderNumber,
  reserveStock,
  restoreOrderStock,
  restoreStockLines,
} from "../utils/orderHelpers.js";

const ADDRESS_FIELDS = ["fullName", "phone", "street", "city", "state", "zipCode", "country"];

// Resolve the shipping address from either a saved address id or an inline object
const resolveShippingAddress = async (req: Request) => {
  const { addressId, shippingAddress } = req.body;

  let src: any = shippingAddress;
  if (addressId) {
    const saved = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!saved) throw new HttpError(400, "Selected address not found");
    src = saved;
  }
  if (!src) throw new HttpError(400, "Shipping address is required");

  const address: Record<string, string> = {};
  for (const f of ADDRESS_FIELDS) {
    if (src[f] !== undefined && src[f] !== null) address[f] = String(src[f]).trim();
  }
  address.country = address.country || "India";

  for (const f of ["street", "city", "state", "zipCode"]) {
    if (!address[f]) throw new HttpError(400, `Shipping address: ${f} is required`);
  }
  return address;
};

// Get user orders
// GET /api/orders
export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("items.product", "name images")
      .sort("-createdAt");

    res.json({ success: true, data: orders });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

// Get single order
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
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // (this used to return status 403 even on success)
    return res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to fetch order");
  }
};

// Create order from cart
// POST /api/orders   body: { addressId | shippingAddress, paymentMethod?, notes? }
export const createOrder = async (req: Request, res: Response) => {
  let reserved: { product: any; quantity: number }[] = [];
  try {
    let paymentMethod = String(req.body.paymentMethod || "cod").toLowerCase();
    if (paymentMethod === "cash") paymentMethod = "cod"; // legacy alias
    if (!["cod", "razorpay"].includes(paymentMethod)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment method" });
    }

    const shippingAddress = await resolveShippingAddress(req);

    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Build order lines from CURRENT product data, never from client/cart prices
    const orderItems: any[] = [];
    for (const item of cart.items) {
      const product: any = item.product;
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: "A product in your cart is no longer available",
        });
      }
      if (product.sizes?.length > 0 && !product.sizes.includes(item.size)) {
        return res.status(400).json({
          success: false,
          message: `Please select a valid size for ${product.name}`,
        });
      }
      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0],
        quantity: item.quantity,
        price: product.price,
        size: item.size,
      });
    }

    // Atomic stock reservation (rolled back automatically on failure)
    const stock = await reserveStock(orderItems);
    if (!stock.ok) {
      const bad = orderItems.find(
        (i) => i.product.toString() === String(stock.productId),
      );
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${bad?.name ?? "a product"}`,
      });
    }
    reserved = orderItems;

    const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const totals = computeTotals(subtotal);

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: paymentMethod as PaymentMethod,
      paymentStatus: "pending",
      ...totals,
      notes: req.body.notes,
      orderNumber: generateOrderNumber(),
    });
    reserved = []; // order exists now - stock is owned by the order

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    // RAZORPAY: when integrating, create the Razorpay order here for
    // paymentMethod === "razorpay" (amount = toPaise(order.totalAmount)),
    // save razorpayOrderId on the order and return it in the response.
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (reserved.length) await restoreStockLines(reserved).catch(() => {});
    sendError(res, error, "Failed to create order");
  }
};

// Customer cancels their own order (only before it's processed / paid)
// PUT /api/orders/:id/cancel
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    if (order.orderStatus !== "placed") {
      return res.status(400).json({
        success: false,
        message: `Order can't be cancelled once it is ${order.orderStatus}`,
      });
    }
    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Paid orders need a refund - please contact support",
      });
    }

    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    await order.save();
    await restoreOrderStock(order._id);

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to cancel order");
  }
};

// update order Status (admin)
// PUT /api/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderStatus, paymentStatus } = req.body;

    if (orderStatus && !(ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return res
        .status(400)
        .json({ success: false, message: `orderStatus must be one of: ${ORDER_STATUSES.join(", ")}` });
    }
    if (paymentStatus && !(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
      return res
        .status(400)
        .json({ success: false, message: `paymentStatus must be one of: ${PAYMENT_STATUSES.join(", ")}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      orderStatus &&
      orderStatus !== order.orderStatus &&
      (order.orderStatus === "cancelled" || order.orderStatus === "delivered")
    ) {
      return res.status(400).json({
        success: false,
        message: `A ${order.orderStatus} order can't be changed`,
      });
    }

    if (orderStatus && orderStatus !== order.orderStatus) {
      order.orderStatus = orderStatus;
      if (orderStatus === "delivered") {
        order.deliveredAt = new Date();
        // cash is collected on delivery
        if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
          order.paymentStatus = "paid";
          order.paidAt = new Date();
        }
      }
      if (orderStatus === "cancelled") order.cancelledAt = new Date();
    }

    if (paymentStatus && paymentStatus !== order.paymentStatus) {
      order.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") order.paidAt = new Date();
    }

    await order.save();
    if (order.orderStatus === "cancelled") await restoreOrderStock(order._id);

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to update order");
  }
};

// Get all orders (admin)
// GET /api/orders/admin/all?page=&limit=&status=&paymentStatus=&search=
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { status, paymentStatus, search } = req.query;

    const query: any = {};
    if (status) query.orderStatus = String(status);
    if (paymentStatus) query.paymentStatus = String(paymentStatus);
    if (search) query.orderNumber = new RegExp(escapeRegex(String(search)), "i");

    const total = await Order.countDocuments(query);
    // (this used to skip but never limit, returning every order)
    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("items.product", "name")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: orders,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

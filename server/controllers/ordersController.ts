import { Request, Response } from "express";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Address from "../models/Address.js";
import Shop from "../models/Shop.js";
import Delivery from "../models/Delivery.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PaymentMethod,
} from "../types/index.js";
import { escapeRegex, HttpError, round2, sendError } from "../utils/http.js";
import { computeTotals } from "../utils/pricing.js";
import {
  attachDeliveries,
  generateCheckoutId,
  generateOrderNumber,
  reserveStock,
  restoreOrderStock,
  restoreStockLines,
  transitionOrder,
} from "../utils/orderHelpers.js";
import { notify } from "../utils/notify.js";
import { logActivity } from "../utils/activity.js";
import { getSettings } from "../utils/settings.js";
import { razorpayConfigured } from "../utils/razorpay.js";
import { createCheckoutPayment } from "./paymentController.js";

const ADDRESS_FIELDS = [
  "fullName",
  "phone",
  "street",
  "city",
  "state",
  "zipCode",
  "country",
  "location",
  "landmark",
];

// The customer app offers UPI / Card (online). All online options are paid
// through Razorpay; COD is still supported by the backend.
const ONLINE_OPTIONS = ["razorpay", "online", "upi", "card", "netbanking", "wallet"];
const normalizePaymentMethod = (value: any): PaymentMethod | null => {
  const v = String(value || "cod").toLowerCase();
  if (v === "cod" || v === "cash") return "cod";
  if (ONLINE_OPTIONS.includes(v)) return "razorpay";
  return null;
};

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
      .populate("shop", "name phone location")
      .sort("-createdAt");

    res.json({ success: true, data: await attachDeliveries(orders) });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

// Get single order (customer, admin, the order's shop owner, or its assigned driver)
// GET /api/orders/:id
export const getOrder = async (req: Request, res: Response) => {
  try {
    const order: any = await Order.findById(req.params.id)
      .populate("items.product", "name images")
      .populate("shop", "name phone location addressLine")
      .populate("user", "name email");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const customerId = (order.user?._id ?? order.user).toString();
    let allowed = customerId === req.user._id.toString() || req.user.role === "admin";

    if (!allowed && order.shop) {
      const shop = await Shop.findOne({ owner: req.user._id }).select("_id");
      allowed = !!shop && shop._id.toString() === (order.shop._id ?? order.shop).toString();
    }
    if (!allowed) {
      const driver = await DeliveryPartner.findOne({ user: req.user._id }).select("_id");
      if (driver) allowed = !!(await Delivery.exists({ order: order._id, driver: driver._id }));
    }
    if (!allowed) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const [withDelivery] = await attachDeliveries([order]);
    return res.json({ success: true, data: withDelivery });
  } catch (error) {
    sendError(res, error, "Failed to fetch order");
  }
};

// Create orders from the cart. The cart is split into ONE ORDER PER SHOP
// (each shop fulfils and is paid separately); orders from the same checkout
// share a `checkoutId`.
// POST /api/orders   body: { addressId | shippingAddress, paymentMethod?, notes? }
export const createOrder = async (req: Request, res: Response) => {
  let reserved: { product: any; quantity: number }[] = [];
  let checkoutId = "";
  try {
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
    if (!paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment method" });
    }

    const settings = await getSettings();
    if (paymentMethod === "cod" && !settings.allowCod) {
      return res
        .status(400)
        .json({ success: false, message: "Cash on delivery is not available" });
    }
    // fail before any stock is reserved
    if (paymentMethod === "razorpay" && !razorpayConfigured()) {
      return res
        .status(503)
        .json({ success: false, message: "Online payments are not available right now" });
    }

    const shippingAddress = await resolveShippingAddress(req);

    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Shops involved must be approved and open
    const shopIds = [
      ...new Set(
        cart.items
          .map((i: any) => i.product?.shop?.toString())
          .filter(Boolean) as string[],
      ),
    ];
    const shops: any[] = await Shop.find({ _id: { $in: shopIds } });
    const shopById = new Map(shops.map((s) => [s._id.toString(), s]));

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
      if (product.shop) {
        const shop = shopById.get(product.shop.toString());
        if (!shop || shop.status !== "approved") {
          return res.status(400).json({
            success: false,
            message: `${product.name} is not available right now`,
          });
        }
        if (!shop.isOpen) {
          return res.status(400).json({
            success: false,
            message: `${shop.name} is currently closed`,
          });
        }
      }
      orderItems.push({
        product: product._id,
        shop: product.shop?.toString() ?? "platform",
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

    // group by shop
    const groups = new Map<string, any[]>();
    for (const item of orderItems) {
      const list = groups.get(item.shop) ?? [];
      list.push(item);
      groups.set(item.shop, list);
    }

    checkoutId = generateCheckoutId();
    const orders: any[] = [];
    for (const [shopKey, items] of groups) {
      const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const order = await Order.create({
        user: req.user._id,
        shop: shopKey === "platform" ? undefined : shopKey,
        checkoutId,
        items: items.map(({ shop: _s, ...rest }) => rest),
        shippingAddress,
        paymentMethod,
        paymentOption: String(req.body.paymentMethod || "cod").toLowerCase(),
        paymentStatus: "pending",
        ...computeTotals(subtotal, settings),
        notes: req.body.notes,
        orderNumber: generateOrderNumber(),
      });
      orders.push(order);
    }

    // Online payment: ONE Razorpay order for the whole checkout. If this throws,
    // the catch block below removes the orders and returns the stock.
    let payment = null;
    if (paymentMethod === "razorpay") {
      payment = await createCheckoutPayment(orders, req.user);
    }
    reserved = []; // orders exist now - stock is owned by them

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    // Notifications (best effort)
    await notify(req.user._id, {
      type: "order",
      title: "Order placed",
      body:
        orders.length === 1
          ? `Your order ${orders[0].orderNumber} has been placed`
          : `Your ${orders.length} orders have been placed`,
      data: { checkoutId, orderIds: orders.map((o) => o._id) },
    });
    // Online orders reach the shop only once they are paid (see paymentController)
    for (const order of paymentMethod === "cod" ? orders : []) {
      const shop = order.shop && shopById.get(order.shop.toString());
      if (shop) {
        await notify(shop.owner, {
          type: "order",
          title: "New order received",
          body: `${order.orderNumber} - ₹${order.totalAmount}`,
          data: { orderId: order._id },
        });
      }
    }

    const summary = {
      subtotal: round2(orders.reduce((s, o) => s + o.subtotal, 0)),
      shippingCost: round2(orders.reduce((s, o) => s + o.shippingCost, 0)),
      tax: round2(orders.reduce((s, o) => s + o.tax, 0)),
      totalAmount: round2(orders.reduce((s, o) => s + o.totalAmount, 0)),
    };

    res.status(201).json({ success: true, data: orders, checkoutId, summary, payment });
  } catch (error) {
    if (checkoutId) await Order.deleteMany({ checkoutId, paymentStatus: "pending" }).catch(() => {});
    if (reserved.length) await restoreStockLines(reserved).catch(() => {});
    sendError(res, error, "Failed to create order");
  }
};

// Customer cancels their own order (only before it's processed / paid)
// PUT /api/orders/:id/cancel
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const order: any = await Order.findById(req.params.id);
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

    if (order.shop) {
      const shop: any = await Shop.findById(order.shop).select("owner");
      if (shop) {
        await notify(shop.owner, {
          type: "order",
          title: "Order cancelled by customer",
          body: order.orderNumber,
          data: { orderId: order._id },
        });
      }
    }

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

    const order: any = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const before = { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus };

    if (paymentStatus && paymentStatus !== order.paymentStatus) {
      order.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") order.paidAt = new Date();
    }
    if (orderStatus && orderStatus !== order.orderStatus) {
      await transitionOrder(order, orderStatus, "admin"); // saves
    } else {
      await order.save();
    }

    if (order.orderStatus !== before.orderStatus) {
      await notify(order.user, {
        type: "order",
        title: `Order ${order.orderNumber} is ${order.orderStatus === "shipping" ? "dispatched" : order.orderStatus}`,
        data: { orderId: order._id },
      });
    }
    await logActivity(req, "order.updated", "Order", order._id, {
      from: before,
      to: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    sendError(res, error, "Failed to update order");
  }
};

// Get all orders (admin)
// GET /api/orders/admin/all?page=&limit=&status=&paymentStatus=&shop=&search=
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { status, paymentStatus, search, shop } = req.query;

    const query: any = {};
    if (status) query.orderStatus = String(status);
    if (paymentStatus) query.paymentStatus = String(paymentStatus);
    if (shop) query.shop = String(shop);
    if (search) query.orderNumber = new RegExp(escapeRegex(String(search)), "i");

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("shop", "name location")
      .populate("items.product", "name")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: await attachDeliveries(orders),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch orders");
  }
};

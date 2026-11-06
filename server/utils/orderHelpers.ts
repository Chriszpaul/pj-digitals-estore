import Product from "../models/Products.js";
import Order from "../models/Order.js";
import { IOrder } from "../types/index.js";

export const generateOrderNumber = () =>
  "ORD-" +
  Date.now().toString(36).toUpperCase() +
  "-" +
  Math.random().toString(36).slice(2, 6).toUpperCase();

type StockLine = { product: any; quantity: number };

export const restoreStockLines = async (lines: StockLine[]) => {
  await Promise.all(
    lines.map((l) =>
      Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } }),
    ),
  );
};

/**
 * Atomically decrements stock for every line. If any line can't be satisfied,
 * everything already reserved is rolled back (prevents overselling and the
 * "half the stock was deducted then it failed" bug).
 */
export const reserveStock = async (
  lines: StockLine[],
): Promise<{ ok: true } | { ok: false; productId: any }> => {
  const reserved: StockLine[] = [];
  for (const line of lines) {
    const result = await Product.updateOne(
      { _id: line.product, isActive: true, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
    );
    if (result.modifiedCount !== 1) {
      await restoreStockLines(reserved);
      return { ok: false, productId: line.product };
    }
    reserved.push(line);
  }
  return { ok: true };
};

/** Idempotent: restores stock for an order at most once. */
export const restoreOrderStock = async (orderId: any) => {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, stockRestored: { $ne: true } },
    { stockRestored: true },
    { new: true },
  );
  if (!order) return false;
  await restoreStockLines(order.items.map((i) => ({ product: i.product, quantity: i.quantity })));
  return true;
};

/**
 * Idempotent "payment succeeded" transition. Call this from the Razorpay
 * verify endpoint AND the Razorpay webhook - whichever arrives first wins,
 * the second is a no-op.
 */
export const markOrderPaid = async (
  orderId: any,
  payment: { razorpayPaymentId?: string; razorpaySignature?: string } = {},
): Promise<IOrder | null> => {
  return Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: "paid" }, orderStatus: { $ne: "cancelled" } },
    {
      paymentStatus: "paid",
      paidAt: new Date(),
      ...(payment.razorpayPaymentId && { razorpayPaymentId: payment.razorpayPaymentId }),
      ...(payment.razorpaySignature && { razorpaySignature: payment.razorpaySignature }),
    },
    { new: true },
  );
};

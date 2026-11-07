import mongoose from "mongoose";
import {
  IOrder,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "../types/index.js";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: String,
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  size: { type: String },
});

const orderSchema = new mongoose.Schema<IOrder>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderNumber: { type: String, unique: true, required: true },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: String,
      phone: String,
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
      location: String,
      landmark: String,
    },
    // one order per shop; orders created in one checkout share a checkoutId
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", index: true },
    checkoutId: { type: String, index: true },
    settlement: { type: mongoose.Schema.Types.ObjectId, ref: "Settlement" },
    paymentOption: { type: String }, // what the app sent: upi / card / cod ...
    paymentMethod: {
      type: String,
      required: true,
      enum: PAYMENT_METHODS,
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: "placed",
    },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    notes: String,
    stockRestored: { type: Boolean, default: false },
    paidAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;

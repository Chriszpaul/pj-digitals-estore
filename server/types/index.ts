import { Document, Types } from "mongoose";

export const ORDER_STATUSES = [
  "placed",
  "processing",
  "shipping",
  "delivered",
  "cancelled",
] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export const PAYMENT_METHODS = ["cod", "razorpay"] as const;
export const PRODUCT_CATEGORIES = [
  "Mobile",
  "Tablet",
  "Laptop",
  "Accessories",
  "Electronics",
  "Textiles",
  "Home Appliances",
  "Other",
] as const;

export const ROLES = [
  "user",
  "admin",
  "dealer", // legacy role, kept for existing data
  "shop_owner",
  "delivery_partner",
] as const;
export const SERVICE_LOCATIONS = ["Thodupuzha", "Muttom"] as const;
export const SHOP_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const PARTNER_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const DELIVERY_STATUSES = [
  "assigned",
  "accepted",
  "picked_up",
  "on_the_way",
  "delivered",
  "failed",
  "rejected",
  "cancelled",
] as const;
export const AD_STATUSES = ["draft", "pending", "approved", "rejected"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_CATEGORIES = ["order", "payment", "delivery", "account", "shop", "other"] as const;
export const SETTLEMENT_STATUSES = ["pending", "paid", "void"] as const;
// where an advertisement may appear on the storefront
export const AD_PLACEMENTS = ["home", "catalogue", "shops", "product"] as const;
export const PAYOUT_METHODS = ["upi", "bank"] as const;
export const PAYOUT_REQUEST_STATUSES = ["open", "fulfilled", "rejected"] as const;
export const VEHICLE_TYPES = ["bike", "scooter", "bicycle", "car", "van", "other"] as const;

export type Role = (typeof ROLES)[number];

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface IAddress extends Document {
  user: Types.ObjectId;
  type: "Home" | "Work" | "Other";
  fullName?: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  location?: string; // service location, e.g. Thodupuzha / Muttom
  landmark?: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
  price: number;
  size?: string;
}

export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  totalAmount: number;
  calculateTotal(): number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image?: string;
  quantity: number;
  price: number;
  size?: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: {
    fullName?: string;
    phone?: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    location?: string;
    landmark?: string;
  };
  shop?: Types.ObjectId;
  checkoutId?: string;
  settlement?: Types.ObjectId;
  paymentOption?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  currency: string;
  // Razorpay fields (filled in once Razorpay is integrated)
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  orderStatus: OrderStatus;
  subtotal: number;
  shippingCost: number;
  tax: number;
  totalAmount: number;
  notes?: string;
  stockRestored: boolean;
  paidAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  sizes: string[];
  category: ProductCategory;
  shop?: Types.ObjectId;
  ratings: { average: number; count: number };
  stock: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  clerkId: string;
  image?: string;
  role: Role;
  pushTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlist extends Document {
  user: Types.ObjectId;
  products: Types.ObjectId[];
  createdAt: Date;
}

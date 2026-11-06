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
  "Other",
] as const;

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
  };
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
  role: "user" | "admin" | "dealer";
  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlist extends Document {
  user: Types.ObjectId;
  products: Types.ObjectId[];
  createdAt: Date;
}

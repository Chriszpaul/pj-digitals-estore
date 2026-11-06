import { Schema } from "mongoose";
import mongoose from "mongoose";
import { IProduct, PRODUCT_CATEGORIES } from "../types/index.js";

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, min: 0 },
    images: [{ type: String }],
    sizes: [{ type: String }],
    category: {
      type: String,
      required: true,
      enum: PRODUCT_CATEGORIES,
      default: "Other",
    },
    stock: { type: Number, required: true, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ name: "text", description: "text" });
productSchema.index({ isActive: 1, category: 1, price: 1 });

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;

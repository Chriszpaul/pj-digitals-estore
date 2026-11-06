import mongoose from "mongoose";
import { IWishlist } from "../types/index.js";

const wishlistSchema = new mongoose.Schema<IWishlist>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model<IWishlist>("Wishlist", wishlistSchema);

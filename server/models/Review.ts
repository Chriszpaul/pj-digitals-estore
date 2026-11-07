import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 2000 },
    verifiedPurchase: { type: Boolean, default: true },
  },
  { timestamps: true },
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true }); // one review per user per product

export default mongoose.model("Review", reviewSchema);

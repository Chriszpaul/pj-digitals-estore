import mongoose, { Schema } from "mongoose";
import { SERVICE_LOCATIONS, SHOP_STATUSES, PAYOUT_METHODS } from "../types/index.js";

const shopSchema = new Schema(
  {
    // one shop per owner account
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    addressLine: { type: String, trim: true },
    landmark: { type: String, trim: true },
    location: { type: String, enum: SERVICE_LOCATIONS, required: true, index: true },
    coordinates: { lat: Number, lng: Number },
    logo: String,
    banner: String,
    categories: [{ type: String }],
    openingHours: String,
    isOpen: { type: Boolean, default: true },
    // per-shop commission override (0.05 = 5%). Empty = platform default from settings.
    commissionRate: { type: Number, min: 0, max: 1 },
    // where the shop is paid out
    payout: {
      method: { type: String, enum: PAYOUT_METHODS },
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
      upiId: String,
    },
    adminNotes: String,
    status: { type: String, enum: SHOP_STATUSES, default: "pending", index: true },
    statusReason: String,
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

shopSchema.index({ name: "text", description: "text" });

export default mongoose.model("Shop", shopSchema);

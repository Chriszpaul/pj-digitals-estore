import mongoose, { Schema } from "mongoose";
import { SERVICE_LOCATIONS, SHOP_STATUSES } from "../types/index.js";

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
    status: { type: String, enum: SHOP_STATUSES, default: "pending", index: true },
    statusReason: String,
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

shopSchema.index({ name: "text", description: "text" });

export default mongoose.model("Shop", shopSchema);

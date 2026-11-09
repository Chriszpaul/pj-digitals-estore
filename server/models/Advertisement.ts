import mongoose, { Schema } from "mongoose";
import { AD_STATUSES, SERVICE_LOCATIONS, AD_PLACEMENTS } from "../types/index.js";

const adSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    image: { type: String },
    product: { type: Schema.Types.ObjectId, ref: "Product" }, // optional deep link
    targetLocations: [{ type: String, enum: SERVICE_LOCATIONS }], // empty = everywhere
    placements: { type: [{ type: String, enum: AD_PLACEMENTS }], default: ["home"] },
    priority: { type: Number, default: 0 }, // higher shows first (admin-controlled)
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date },
    status: { type: String, enum: AD_STATUSES, default: "pending", index: true },
    rejectionReason: String,
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("Advertisement", adSchema);

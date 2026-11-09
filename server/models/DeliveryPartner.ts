import mongoose, { Schema } from "mongoose";
import { PARTNER_STATUSES, SERVICE_LOCATIONS, VEHICLE_TYPES } from "../types/index.js";

const partnerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, default: "bike" },
    vehicleNumber: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },
    serviceLocations: [{ type: String, enum: SERVICE_LOCATIONS }],
    photo: String,
    status: { type: String, enum: PARTNER_STATUSES, default: "pending", index: true },
    statusReason: String,
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isAvailable: { type: Boolean, default: false },
    // where the driver is paid
    payout: { method: { type: String, enum: ["upi", "bank"] }, accountHolder: String, accountNumber: String, ifsc: String, upiId: String },
    adminNotes: String,
    currentLocation: { lat: Number, lng: Number, updatedAt: Date },
    completedDeliveries: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("DeliveryPartner", partnerSchema);

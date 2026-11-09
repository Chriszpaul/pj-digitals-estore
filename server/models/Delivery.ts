import mongoose, { Schema } from "mongoose";
import { DELIVERY_STATUSES } from "../types/index.js";

// One delivery record per order. Re-assigning a driver updates the same record.
const deliverySchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    shop: { type: Schema.Types.ObjectId, ref: "Shop", index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", index: true },
    driver: { type: Schema.Types.ObjectId, ref: "DeliveryPartner", index: true },
    status: { type: String, enum: DELIVERY_STATUSES, default: "assigned", index: true },
    // snapshots so the driver app doesn't need to join anything
    pickup: {
      name: String,
      phone: String,
      address: String,
      location: String,
      coordinates: { lat: Number, lng: Number },
    },
    drop: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      location: String,
      landmark: String,
    },
    codAmount: { type: Number, default: 0 }, // cash the driver must collect
    timeline: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
        _id: false,
      },
    ],
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: Date,
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    failureReason: String,
    driverFee: { type: Number, default: 0 }, // earned by the driver on delivery
    driverSettlement: { type: Schema.Types.ObjectId, ref: "DriverSettlement", index: true },
  },
  { timestamps: true },
);

export default mongoose.model("Delivery", deliverySchema);

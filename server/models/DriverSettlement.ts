import mongoose, { Schema } from "mongoose";

// Settling up with a delivery partner: delivery fees we owe them minus the
// cash-on-delivery money they collected and still hold.
const driverSettlementSchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: "DeliveryPartner", required: true, index: true },
    deliveries: [{ type: Schema.Types.ObjectId, ref: "Delivery" }],
    deliveriesCount: Number,
    earnings: { type: Number, default: 0 }, // delivery fees owed to the driver
    codCollected: { type: Number, default: 0 }, // cash the driver collected from customers
    adjustment: { type: Number, default: 0 }, // bonus (+) or deduction (-)
    adjustmentNote: String,
    // earnings + adjustment - codCollected.  > 0 we pay the driver, < 0 the driver hands over cash
    net: { type: Number, default: 0 },
    reference: String,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model("DriverSettlement", driverSettlementSchema);

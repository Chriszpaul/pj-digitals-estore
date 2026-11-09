import mongoose, { Schema } from "mongoose";
import { SETTLEMENT_STATUSES } from "../types/index.js";

const settlementSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    periodFrom: Date,
    periodTo: Date,
    orders: [{ type: Schema.Types.ObjectId, ref: "Order" }],
    ordersCount: Number,
    grossSales: Number, // sum of order subtotals (shop's goods)
    commissionRate: Number,
    commission: Number,
    adjustment: { type: Number, default: 0 }, // admin correction: + bonus / - deduction (refunds, penalties)
    adjustmentNote: String,
    netPayable: Number, // grossSales - commission + adjustment
    payoutSnapshot: String, // where it was sent, e.g. "UPI: shop@upi"
    codAmount: Number, // of grossSales, collected as cash on delivery
    onlineAmount: Number, // of grossSales, collected online
    status: { type: String, enum: SETTLEMENT_STATUSES, default: "pending", index: true },
    paidAt: Date,
    reference: String, // bank/UPI transaction reference
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model("Settlement", settlementSchema);

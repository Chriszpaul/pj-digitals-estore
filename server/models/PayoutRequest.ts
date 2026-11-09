import mongoose, { Schema } from "mongoose";
import { PAYOUT_REQUEST_STATUSES } from "../types/index.js";

// A shop owner asking for their unsettled earnings to be paid out.
const payoutRequestSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    // snapshot at request time (the real amount is fixed when the settlement is created)
    ordersCount: Number,
    grossSales: Number,
    estimatedNet: Number,
    note: String,
    status: { type: String, enum: PAYOUT_REQUEST_STATUSES, default: "open", index: true },
    resolutionNote: String,
    settlement: { type: Schema.Types.ObjectId, ref: "Settlement" },
    resolvedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("PayoutRequest", payoutRequestSchema);

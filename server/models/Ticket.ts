import mongoose, { Schema } from "mongoose";
import { TICKET_CATEGORIES, TICKET_STATUSES } from "../types/index.js";

const ticketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userRole: String,
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: TICKET_CATEGORIES, default: "other" },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    status: { type: String, enum: TICKET_STATUSES, default: "open", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    messages: [
      {
        sender: { type: Schema.Types.ObjectId, ref: "User" },
        senderRole: String,
        body: { type: String, required: true, maxlength: 4000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("Ticket", ticketSchema);

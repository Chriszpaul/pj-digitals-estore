import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true }, // order | delivery | shop | payment | support | system
    title: { type: String, required: true },
    body: { type: String },
    data: { type: Schema.Types.Mixed }, // e.g. { orderId } for deep links
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);

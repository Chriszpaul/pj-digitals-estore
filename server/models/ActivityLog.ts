import mongoose, { Schema } from "mongoose";

const logSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorName: String,
    action: { type: String, required: true, index: true }, // e.g. shop.approved
    targetType: String,
    targetId: String,
    meta: { type: Schema.Types.Mixed },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

logSchema.index({ createdAt: -1 });

export default mongoose.model("ActivityLog", logSchema);

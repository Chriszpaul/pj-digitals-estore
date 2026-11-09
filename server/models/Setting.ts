import mongoose, { Schema } from "mongoose";

// Single document holding runtime-editable platform settings (see utils/settings.ts).
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    values: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model("Setting", settingSchema);

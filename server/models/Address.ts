import mongoose from "mongoose";
import { IAddress } from "../types/index.js";

const AddressSchema = new mongoose.Schema<IAddress>({
  // NOTE: `unique: true` was removed - it limited each user to ONE address.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
  fullName: { type: String, trim: true },
  phone: { type: String, trim: true },
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  zipCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true, default: "India" },
  location: { type: String, trim: true }, // service location (Thodupuzha / Muttom)
  landmark: { type: String, trim: true },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IAddress>("Address", AddressSchema);

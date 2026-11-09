import mongoose from "mongoose";
import { IUser, ROLES } from "../types/index.js";

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, trim: true },
    // sparse: users without an email must not collide on `null`
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    clerkId: { type: String, unique: true, sparse: true },
    image: { type: String },
    role: { type: String, enum: ROLES, default: "user" },
    // admins can block an account; blocked users get 403 on every request
    isActive: { type: Boolean, default: true },
    // Expo push tokens for phone notification-bar alerts
    pushTokens: [{ type: String }],
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;

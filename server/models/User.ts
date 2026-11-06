import mongoose from "mongoose";
import { IUser } from "../types/index.js";

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, trim: true },
    // sparse: users without an email must not collide on `null`
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    clerkId: { type: String, unique: true, sparse: true },
    image: { type: String },
    role: { type: String, enum: ["user", "admin", "dealer"], default: "user" },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;

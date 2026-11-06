import User from "../models/User.js";
import { clerkClient } from "@clerk/express";

const makeAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    // Without this guard an unset ADMIN_EMAIL made the filter `{}` and
    // promoted the FIRST user in the database to admin.
    if (!email) return;

    const user = await User.findOneAndUpdate({ email }, { role: "admin" });
    if (user?.clerkId) {
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: "admin" },
      });
    }
  } catch (error: any) {
    console.error("Error making user admin:", error.message);
  }
};

export default makeAdmin;

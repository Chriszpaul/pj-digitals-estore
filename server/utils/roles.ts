import { clerkClient } from "@clerk/express";

/** Changes a user's role in MongoDB and mirrors it to Clerk public metadata. */
export const setUserRole = async (user: any, role: string) => {
  if (user.role === role) return user;
  user.role = role;
  await user.save();
  if (user.clerkId) {
    await clerkClient.users
      .updateUserMetadata(user.clerkId, { publicMetadata: { role } })
      .catch((e: any) => console.error("Clerk metadata sync failed:", e.message));
  }
  return user;
};

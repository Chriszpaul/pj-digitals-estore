import { NextFunction, Request, Response } from "express";
import { clerkClient } from "@clerk/express";
import User from "../models/User.js";

const VALID_ROLES = ["user", "admin", "dealer"];

/**
 * Requires a signed-in Clerk user. If the user isn't in our DB yet (e.g. the
 * Clerk webhook hasn't arrived or failed) the record is created on the spot,
 * so req.user is never null.
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = await req.auth();

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      const cu = await clerkClient.users.getUser(userId);
      const primary =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ??
        cu.emailAddresses[0];
      const metaRole = (cu.publicMetadata as any)?.role;

      const data = {
        clerkId: userId,
        email: primary?.emailAddress?.toLowerCase(),
        name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || undefined,
        image: cu.imageUrl,
        ...(VALID_ROLES.includes(metaRole) && { role: metaRole }),
      };

      // upsert avoids a race with the webhook creating the same user
      user = await User.findOneAndUpdate(
        { clerkId: userId },
        { $setOnInsert: data },
        { upsert: true, new: true },
      );
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in protect middleware, auth error:", error);
    res.status(500).json({ success: false, message: "failed auth" });
  }
};

/** Attaches req.user when signed in, but never rejects the request. */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = await req.auth();
    if (userId) req.user = await User.findOne({ clerkId: userId });
  } catch {
    // anonymous request - ignore
  }
  next();
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient role" });
    }
    next();
  };
};

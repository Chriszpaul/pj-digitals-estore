import { NextFunction, Request, Response } from "express";
import { clerkClient } from "@clerk/express";
import User from "../models/User.js";
import { logActivity } from "../utils/activity.js";
import Shop from "../models/Shop.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import { ROLES } from "../types/index.js";

const VALID_ROLES: readonly string[] = ROLES;

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

    if (user && user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled. Please contact support.",
      });
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

/**
 * Loads the signed-in user's shop into req.shop.
 * `requireApproved` (default true) blocks pending/rejected/suspended shops.
 */
export const loadShop =
  (requireApproved = true) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Admins can act as any shop with the `x-shop-id` header (every write is logged)
      const actAs = req.user.role === "admin" ? req.header("x-shop-id") : undefined;
      if (actAs) {
        if (!/^[a-f\d]{24}$/i.test(actAs)) {
          return res.status(400).json({ success: false, message: "Invalid x-shop-id" });
        }
        const target: any = await Shop.findById(actAs);
        if (!target) {
          return res.status(404).json({ success: false, message: "Shop not found" });
        }
        req.shop = target;
        if (req.method !== "GET") {
          await logActivity(req, "admin.act_as_shop", "Shop", target._id, { method: req.method, path: req.originalUrl });
        }
        return next();
      }

      const shop: any = await Shop.findOne({ owner: req.user._id });
      if (!shop) {
        return res
          .status(404)
          .json({ success: false, message: "You don't have a shop yet" });
      }
      if (requireApproved && shop.status !== "approved") {
        return res.status(403).json({
          success: false,
          message: `Your shop is ${shop.status}`,
          shopStatus: shop.status,
          reason: shop.statusReason,
        });
      }
      req.shop = shop;
      next();
    } catch (error) {
      console.error("loadShop error:", error);
      res.status(500).json({ success: false, message: "failed to load shop" });
    }
  };

/** Loads the signed-in user's delivery-partner profile into req.driver. */
export const loadDriver =
  (requireApproved = true) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Admins can act as any driver with the `x-driver-id` header (every write is logged)
      const actAs = req.user.role === "admin" ? req.header("x-driver-id") : undefined;
      if (actAs) {
        if (!/^[a-f\d]{24}$/i.test(actAs)) {
          return res.status(400).json({ success: false, message: "Invalid x-driver-id" });
        }
        const target: any = await DeliveryPartner.findById(actAs);
        if (!target) {
          return res.status(404).json({ success: false, message: "Delivery partner not found" });
        }
        req.driver = target;
        if (req.method !== "GET") {
          await logActivity(req, "admin.act_as_driver", "DeliveryPartner", target._id, { method: req.method, path: req.originalUrl });
        }
        return next();
      }

      const driver: any = await DeliveryPartner.findOne({ user: req.user._id });
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "You don't have a delivery-partner profile yet",
        });
      }
      if (requireApproved && driver.status !== "approved") {
        return res.status(403).json({
          success: false,
          message: `Your delivery-partner account is ${driver.status}`,
          partnerStatus: driver.status,
          reason: driver.statusReason,
        });
      }
      req.driver = driver;
      next();
    } catch (error) {
      console.error("loadDriver error:", error);
      res.status(500).json({ success: false, message: "failed to load profile" });
    }
  };

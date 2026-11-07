import { NextFunction, Request, Response } from "express";
import { loadShop } from "./auth.js";

/**
 * For product write routes: admins pass straight through, shop owners must
 * have an APPROVED shop (loaded into req.shop). Everyone else gets 403.
 */
export const adminOrShopOwner = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === "admin") return next();
  if (req.user?.role === "shop_owner") return loadShop(true)(req, res, next);
  return res
    .status(403)
    .json({ success: false, message: "Forbidden: admin or shop owner only" });
};

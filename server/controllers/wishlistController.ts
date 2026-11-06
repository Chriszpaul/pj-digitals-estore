import { Request, Response } from "express";
import Wishlist from "../models/Wishlist.js";
import Product from "../models/Products.js";
import { sendError } from "../utils/http.js";

const POPULATE = "name images price comparePrice stock category isActive";

// GET /api/wishlist
export const getWishlist = async (req: Request, res: Response) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
      "products",
      POPULATE,
    );
    res.json({ success: true, data: wishlist?.products ?? [] });
  } catch (error) {
    sendError(res, error, "Failed to fetch wishlist");
  }
};

// POST /api/wishlist/:productId   (idempotent add)
export const addToWishlist = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || !product.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $addToSet: { products: product._id } },
      { upsert: true, new: true },
    ).populate("products", POPULATE);

    res.status(201).json({ success: true, data: wishlist.products });
  } catch (error) {
    sendError(res, error, "Failed to add to wishlist");
  }
};

// DELETE /api/wishlist/:productId
export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { products: req.params.productId } },
      { new: true },
    ).populate("products", POPULATE);

    res.json({ success: true, data: wishlist?.products ?? [] });
  } catch (error) {
    sendError(res, error, "Failed to remove from wishlist");
  }
};

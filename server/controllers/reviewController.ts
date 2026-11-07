import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Products.js";
import Order from "../models/Order.js";
import { sendError } from "../utils/http.js";

const recalcRating = async (productId: any) => {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      ratings: {
        average: agg ? Math.round(agg.avg * 10) / 10 : 0,
        count: agg?.count ?? 0,
      },
    },
  );
};

// GET /api/products/:id/reviews?page=&limit=
export const getReviews = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const query = { product: req.params.id };

    const [total, reviews] = await Promise.all([
      Review.countDocuments(query),
      Review.find(query)
        .populate("user", "name image")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: reviews,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch reviews");
  }
};

// POST /api/products/:id/reviews   body: { rating: 1-5, comment? }
// Only customers with a DELIVERED order containing the product can review.
// Posting again updates the user's existing review.
export const createReview = async (req: Request, res: Response) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "rating must be a whole number from 1 to 5" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const purchased = await Order.exists({
      user: req.user._id,
      orderStatus: "delivered",
      "items.product": product._id,
    });
    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: "You can review a product after your order has been delivered",
      });
    }

    const review = await Review.findOneAndUpdate(
      { product: product._id, user: req.user._id },
      { rating, comment: req.body.comment, verifiedPurchase: true },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    await recalcRating(product._id);

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    sendError(res, error, "Failed to save review");
  }
};

// DELETE /api/products/:id/reviews/:reviewId  (author or admin)
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      product: req.params.id,
    });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    await review.deleteOne();
    await recalcRating(review.product);
    res.json({ success: true, message: "Review removed" });
  } catch (error) {
    sendError(res, error, "Failed to delete review");
  }
};

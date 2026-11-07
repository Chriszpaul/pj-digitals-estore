import express from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import upload from "../middleware/upload.js";
import { optionalAuth, protect } from "../middleware/auth.js";
import { adminOrShopOwner } from "../middleware/productAccess.js";
import {
  createReview,
  deleteReview,
  getReviews,
} from "../controllers/reviewController.js";
import { validateObjectId } from "../middleware/validate.js";

const ProductRouter = express.Router();

// Public (optionalAuth lets admins see inactive products)
ProductRouter.get("/", optionalAuth, getProducts);
ProductRouter.get("/:id", validateObjectId("id"), optionalAuth, getProduct);

// Admin / approved shop owner - auth runs BEFORE multer so anonymous users can't push uploads
ProductRouter.post(
  "/",
  protect,
  adminOrShopOwner,
  upload.array("images", 5),
  createProduct,
);

ProductRouter.put(
  "/:id",
  validateObjectId("id"),
  protect,
  adminOrShopOwner,
  upload.array("images", 5),
  updateProduct,
);

ProductRouter.delete(
  "/:id",
  validateObjectId("id"),
  protect,
  adminOrShopOwner,
  deleteProduct,
);

// Reviews
ProductRouter.get("/:id/reviews", validateObjectId("id"), getReviews);
ProductRouter.post("/:id/reviews", validateObjectId("id"), protect, createReview);
ProductRouter.delete(
  "/:id/reviews/:reviewId",
  validateObjectId("id", "reviewId"),
  protect,
  deleteReview,
);

export default ProductRouter;

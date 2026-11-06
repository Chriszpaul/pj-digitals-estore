import express from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import upload from "../middleware/upload.js";
import { authorize, optionalAuth, protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";

const ProductRouter = express.Router();

// Public (optionalAuth lets admins see inactive products)
ProductRouter.get("/", optionalAuth, getProducts);
ProductRouter.get("/:id", validateObjectId("id"), optionalAuth, getProduct);

// Admin - auth runs BEFORE multer so anonymous users can't push uploads
ProductRouter.post(
  "/",
  protect,
  authorize("admin"),
  upload.array("images", 5),
  createProduct,
);

ProductRouter.put(
  "/:id",
  validateObjectId("id"),
  protect,
  authorize("admin"),
  upload.array("images", 5),
  updateProduct,
);

ProductRouter.delete(
  "/:id",
  validateObjectId("id"),
  protect,
  authorize("admin"),
  deleteProduct,
);

export default ProductRouter;

import express from "express";
import { protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../controllers/wishlistController.js";

const WishlistRouter = express.Router();

WishlistRouter.use(protect);

WishlistRouter.get("/", getWishlist);
WishlistRouter.post("/:productId", validateObjectId("productId"), addToWishlist);
WishlistRouter.delete("/:productId", validateObjectId("productId"), removeFromWishlist);

export default WishlistRouter;

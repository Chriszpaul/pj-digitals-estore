import express from "express";
import { protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItems,
} from "../controllers/cartController.js";

const CartRouter = express.Router();

CartRouter.use(protect);

CartRouter.get("/", getCart);
CartRouter.post("/add", addToCart);
CartRouter.put("/item/:productId", validateObjectId("productId"), updateCartItems);
// (this route was missing `protect`, so req.user was undefined and it crashed)
CartRouter.delete("/item/:productId", validateObjectId("productId"), removeCartItem);
CartRouter.delete("/", clearCart);

export default CartRouter;

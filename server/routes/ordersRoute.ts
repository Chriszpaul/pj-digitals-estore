import express from "express";
import {
  cancelOrder,
  createOrder,
  getAllOrders,
  getOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/ordersController.js";
import { authorize, protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import { getOrderTracking } from "../controllers/deliveryController.js";

const OrderRouter = express.Router();

OrderRouter.use(protect);

OrderRouter.get("/", getOrders);
OrderRouter.post("/", createOrder);

// admin (declared before "/:id" routes)
OrderRouter.get("/admin/all", authorize("admin"), getAllOrders);
OrderRouter.put("/:id/status", authorize("admin"), validateObjectId("id"), updateOrderStatus);

OrderRouter.get("/:id", validateObjectId("id"), getOrder);
OrderRouter.get("/:id/tracking", validateObjectId("id"), getOrderTracking);
OrderRouter.put("/:id/cancel", validateObjectId("id"), cancelOrder);

export default OrderRouter;

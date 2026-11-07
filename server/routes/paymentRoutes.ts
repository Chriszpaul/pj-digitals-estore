import express from "express";
import { protect } from "../middleware/auth.js";
import { createPayment, verifyPayment } from "../controllers/paymentController.js";

const PaymentRouter = express.Router();

PaymentRouter.use(protect);
PaymentRouter.post("/create", createPayment);
PaymentRouter.post("/verify", verifyPayment);

export default PaymentRouter;

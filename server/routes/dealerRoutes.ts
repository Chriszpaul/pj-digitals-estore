import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { getDashboardStats } from "../controllers/dealerController.js";

const DealerRouter = express.Router();

// Get dashboard stats
DealerRouter.get("/stats", protect, authorize("dealer"), getDashboardStats);

export default DealerRouter;

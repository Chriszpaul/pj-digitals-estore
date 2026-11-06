import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import {
  getDashboardStats,
  getUsers,
  updateUserRole,
} from "../controllers/adminController.js";

const AdminRouter = express.Router();

AdminRouter.use(protect, authorize("admin"));

AdminRouter.get("/stats", getDashboardStats);
AdminRouter.get("/users", getUsers);
AdminRouter.put("/users/:id/role", validateObjectId("id"), updateUserRole);

export default AdminRouter;

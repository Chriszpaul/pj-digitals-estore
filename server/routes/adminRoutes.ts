import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import {
  getDashboardStats,
  getUsers,
  updateUserRole,
} from "../controllers/adminController.js";
import {
  adminAssignDelivery,
  adminCancelDelivery,
  adminGetPartner,
  adminGetShop,
  adminListDeliveries,
  adminListPartners,
  adminListShops,
  adminSetPartnerStatus,
  adminSetShopStatus,
  getActivityLogs,
  getUserDetail,
} from "../controllers/adminOpsController.js";
import {
  createSettlement,
  expireUnpaidOrders,
  getSettlement,
  listPayments,
  listSettlements,
  reconciliation,
  salesReport,
  shopsReport,
  updateSettlement,
} from "../controllers/adminReportsController.js";
import { adminListAds, adminModerateAd } from "../controllers/adController.js";
import {
  adminListTickets,
  adminUpdateTicket,
} from "../controllers/supportController.js";

const AdminRouter = express.Router();

AdminRouter.use(protect, authorize("admin"));

// dashboard
AdminRouter.get("/stats", getDashboardStats);

// users / customers
AdminRouter.get("/users", getUsers);
AdminRouter.get("/users/:id", validateObjectId("id"), getUserDetail);
AdminRouter.put("/users/:id/role", validateObjectId("id"), updateUserRole);

// shops
AdminRouter.get("/shops", adminListShops);
AdminRouter.get("/shops/:id", validateObjectId("id"), adminGetShop);
AdminRouter.put("/shops/:id/status", validateObjectId("id"), adminSetShopStatus);

// delivery partners
AdminRouter.get("/delivery-partners", adminListPartners);
AdminRouter.get("/delivery-partners/:id", validateObjectId("id"), adminGetPartner);
AdminRouter.put("/delivery-partners/:id/status", validateObjectId("id"), adminSetPartnerStatus);

// deliveries
AdminRouter.get("/deliveries", adminListDeliveries);
AdminRouter.post("/deliveries", adminAssignDelivery);
AdminRouter.put("/deliveries/:id/cancel", validateObjectId("id"), adminCancelDelivery);

// advertisements
AdminRouter.get("/ads", adminListAds);
AdminRouter.put("/ads/:id/status", validateObjectId("id"), adminModerateAd);

// support
AdminRouter.get("/tickets", adminListTickets);
AdminRouter.put("/tickets/:id", validateObjectId("id"), adminUpdateTicket);

// payments, reports, settlements
AdminRouter.get("/payments", listPayments);
AdminRouter.get("/reports/sales", salesReport);
AdminRouter.get("/reports/shops", shopsReport);
AdminRouter.get("/reports/reconciliation", reconciliation);
AdminRouter.post("/orders/expire-unpaid", expireUnpaidOrders);
AdminRouter.get("/settlements", listSettlements);
AdminRouter.post("/settlements", createSettlement);
AdminRouter.get("/settlements/:id", validateObjectId("id"), getSettlement);
AdminRouter.put("/settlements/:id", validateObjectId("id"), updateSettlement);

// audit trail
AdminRouter.get("/activity-logs", getActivityLogs);

export default AdminRouter;

import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import upload from "../middleware/upload.js";
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
  createSettlementsBulk,
  exportSettlements,
  expireUnpaidOrders,
  listPayoutRequests,
  payoutsSummary,
  previewSettlement,
  resolvePayoutRequest,
  getSettlement,
  listPayments,
  listSettlements,
  reconciliation,
  salesReport,
  shopsReport,
  updateSettlement,
} from "../controllers/adminReportsController.js";
import { adminCreateAd, adminDeleteAd, adminListAds, adminModerateAd, adminUpdateAd } from "../controllers/adController.js";
import {
  adminAssignProduct,
  adminCreateDriver,
  adminCreateShop,
  adminDeleteShop,
  adminOverview,
  adminSetDeliveryStatus,
  adminSetPaymentStatus,
  adminUpdateDriver,
  adminUpdateShop,
  broadcast,
  getPlatformSettings,
  setUserActive,
  updatePlatformSettings,
} from "../controllers/adminManageController.js";
import {
  createDriverSettlement,
  driverPayoutsSummary,
  exportDriverSettlements,
  exportOrdersCsv,
  listDriverSettlements,
  previewDriverSettlement,
} from "../controllers/payoutController.js";
import {
  adminListTickets,
  adminUpdateTicket,
} from "../controllers/supportController.js";

const AdminRouter = express.Router();

AdminRouter.use(protect, authorize("admin"));

// dashboard
AdminRouter.get("/stats", getDashboardStats);
AdminRouter.get("/overview", adminOverview);

// platform settings, broadcast
AdminRouter.get("/settings", getPlatformSettings);
AdminRouter.put("/settings", updatePlatformSettings);
AdminRouter.post("/broadcast", broadcast);

// users / customers
AdminRouter.get("/users", getUsers);
AdminRouter.get("/users/:id", validateObjectId("id"), getUserDetail);
AdminRouter.put("/users/:id/role", validateObjectId("id"), updateUserRole);
AdminRouter.put("/users/:id/active", validateObjectId("id"), setUserActive);

// shops
AdminRouter.get("/shops", adminListShops);
AdminRouter.post("/shops", upload.single("logo"), adminCreateShop);
AdminRouter.get("/shops/:id", validateObjectId("id"), adminGetShop);
AdminRouter.put("/shops/:id/status", validateObjectId("id"), adminSetShopStatus);
AdminRouter.put("/shops/:id", validateObjectId("id"), upload.single("logo"), adminUpdateShop);
AdminRouter.delete("/shops/:id", validateObjectId("id"), adminDeleteShop);
AdminRouter.put("/products/:id/assign", validateObjectId("id"), adminAssignProduct);

// delivery partners
AdminRouter.get("/delivery-partners", adminListPartners);
AdminRouter.post("/delivery-partners", upload.single("photo"), adminCreateDriver);
AdminRouter.get("/delivery-partners/:id", validateObjectId("id"), adminGetPartner);
AdminRouter.put("/delivery-partners/:id/status", validateObjectId("id"), adminSetPartnerStatus);
AdminRouter.put("/delivery-partners/:id", validateObjectId("id"), upload.single("photo"), adminUpdateDriver);

// deliveries
AdminRouter.get("/deliveries", adminListDeliveries);
AdminRouter.post("/deliveries", adminAssignDelivery);
AdminRouter.put("/deliveries/:id/cancel", validateObjectId("id"), adminCancelDelivery);
AdminRouter.put("/deliveries/:id/status", validateObjectId("id"), adminSetDeliveryStatus);
AdminRouter.put("/orders/:id/payment", validateObjectId("id"), adminSetPaymentStatus);

// advertisements
AdminRouter.get("/ads", adminListAds);
AdminRouter.post("/ads", upload.single("image"), adminCreateAd);
AdminRouter.put("/ads/:id/status", validateObjectId("id"), adminModerateAd);
AdminRouter.put("/ads/:id", validateObjectId("id"), upload.single("image"), adminUpdateAd);
AdminRouter.delete("/ads/:id", validateObjectId("id"), adminDeleteAd);

// support
AdminRouter.get("/tickets", adminListTickets);
AdminRouter.put("/tickets/:id", validateObjectId("id"), adminUpdateTicket);

// payments, reports, settlements
AdminRouter.get("/payments", listPayments);
AdminRouter.get("/reports/sales", salesReport);
AdminRouter.get("/reports/shops", shopsReport);
AdminRouter.get("/reports/reconciliation", reconciliation);
AdminRouter.post("/orders/expire-unpaid", expireUnpaidOrders);
AdminRouter.get("/payments/export.csv", exportOrdersCsv);
AdminRouter.get("/payouts/summary", payoutsSummary);
AdminRouter.get("/payouts/preview", previewSettlement);
AdminRouter.get("/payout-requests", listPayoutRequests);
AdminRouter.put("/payout-requests/:id", validateObjectId("id"), resolvePayoutRequest);
AdminRouter.get("/settlements/export.csv", exportSettlements);
AdminRouter.get("/settlements", listSettlements);
AdminRouter.post("/settlements", createSettlement);
AdminRouter.post("/settlements/bulk", createSettlementsBulk);

// driver earnings + cash-on-delivery remittance
AdminRouter.get("/driver-payouts/summary", driverPayoutsSummary);
AdminRouter.get("/driver-payouts/preview", previewDriverSettlement);
AdminRouter.get("/driver-payouts/export.csv", exportDriverSettlements);
AdminRouter.get("/driver-payouts", listDriverSettlements);
AdminRouter.post("/driver-payouts", createDriverSettlement);
AdminRouter.get("/settlements/:id", validateObjectId("id"), getSettlement);
AdminRouter.put("/settlements/:id", validateObjectId("id"), updateSettlement);

// audit trail
AdminRouter.get("/activity-logs", getActivityLogs);

export default AdminRouter;

import express from "express";
import { loadDriver, protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import upload from "../middleware/upload.js";
import { getDriverEarnings, setDriverPayoutAccount } from "../controllers/payoutController.js";
import {
  applyAsDriver,
  getHistory,
  getJob,
  getJobs,
  getMyProfile,
  setAvailability,
  updateJobStatus,
  updateLocation,
  updateMyProfile,
} from "../controllers/deliveryController.js";

const DeliveryRouter = express.Router();

DeliveryRouter.use(protect);

DeliveryRouter.post("/apply", upload.single("photo"), applyAsDriver);
// readable while pending so the app can show the approval status
DeliveryRouter.get("/me", loadDriver(false), getMyProfile);

// everything below needs an APPROVED delivery partner
DeliveryRouter.put("/me", loadDriver(true), upload.single("photo"), updateMyProfile);
DeliveryRouter.put("/availability", loadDriver(true), setAvailability);
DeliveryRouter.put("/location", loadDriver(true), updateLocation);

DeliveryRouter.get("/jobs", loadDriver(true), getJobs);
DeliveryRouter.get("/jobs/:id", loadDriver(true), validateObjectId("id"), getJob);
DeliveryRouter.put("/jobs/:id/status", loadDriver(true), validateObjectId("id"), updateJobStatus);
DeliveryRouter.get("/history", loadDriver(true), getHistory);
DeliveryRouter.get("/earnings", loadDriver(true), getDriverEarnings);
DeliveryRouter.put("/payout-account", loadDriver(true), setDriverPayoutAccount);

export default DeliveryRouter;

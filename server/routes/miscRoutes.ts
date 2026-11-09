import express from "express";
import { protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import {
  addPushToken,
  getMe,
  getMeta,
  removePushToken,
} from "../controllers/meController.js";
import {
  deleteNotification,
  getNotifications,
  markAllRead,
  markRead,
} from "../controllers/notificationController.js";
import {
  createTicket,
  getMyTickets,
  getTicket,
  replyToTicket,
} from "../controllers/supportController.js";
import { getPublicAds, trackClick, trackImpressions } from "../controllers/adController.js";

// /api/meta  (public)
export const MetaRouter = express.Router();
MetaRouter.get("/", getMeta);

// /api/ads  (public, running + approved ads)
export const PublicAdsRouter = express.Router();
PublicAdsRouter.get("/", getPublicAds);
PublicAdsRouter.post("/impressions", trackImpressions);
PublicAdsRouter.post("/:id/click", validateObjectId("id"), trackClick);

// /api/me
export const MeRouter = express.Router();
MeRouter.use(protect);
MeRouter.get("/", getMe);
MeRouter.put("/push-token", addPushToken);
MeRouter.delete("/push-token", removePushToken);

// /api/notifications
export const NotificationRouter = express.Router();
NotificationRouter.use(protect);
NotificationRouter.get("/", getNotifications);
NotificationRouter.put("/read-all", markAllRead);
NotificationRouter.put("/:id/read", validateObjectId("id"), markRead);
NotificationRouter.delete("/:id", validateObjectId("id"), deleteNotification);

// /api/support  (customers, shop owners and drivers)
export const SupportRouter = express.Router();
SupportRouter.use(protect);
SupportRouter.get("/", getMyTickets);
SupportRouter.post("/", createTicket);
SupportRouter.get("/:id", validateObjectId("id"), getTicket);
SupportRouter.post("/:id/messages", validateObjectId("id"), replyToTicket);

import { Request, Response } from "express";
import User from "../models/User.js";
import Shop from "../models/Shop.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Notification from "../models/Notification.js";
import {
  AD_STATUSES,
  DELIVERY_STATUSES,
  ORDER_STATUSES,
  PARTNER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_CATEGORIES,
  ROLES,
  SERVICE_LOCATIONS,
  SETTLEMENT_STATUSES,
  SHOP_STATUSES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  VEHICLE_TYPES,
} from "../types/index.js";
import { sendError } from "../utils/http.js";
import { getSettings } from "../utils/settings.js";
import { razorpayConfigured } from "../utils/razorpay.js";

// GET /api/me
// Everything an app needs right after Clerk login: the DB user, their role,
// shop / delivery-partner profile (with approval status) and unread count.
export const getMe = async (req: Request, res: Response) => {
  try {
    const [shop, deliveryPartner, unreadNotifications] = await Promise.all([
      Shop.findOne({ owner: req.user._id }),
      DeliveryPartner.findOne({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        user: req.user,
        shop,
        deliveryPartner,
        unreadNotifications,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to load profile");
  }
};

// PUT /api/me/push-token   body: { token }   (Expo push token)
export const addPushToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ success: false, message: "token is required" });
    }
    await User.updateOne({ _id: req.user._id }, { $addToSet: { pushTokens: token.trim() } });
    res.json({ success: true, message: "Push token saved" });
  } catch (error) {
    sendError(res, error, "Failed to save push token");
  }
};

// DELETE /api/me/push-token   body: { token }   (call on logout)
export const removePushToken = async (req: Request, res: Response) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: req.body.token } });
    res.json({ success: true, message: "Push token removed" });
  } catch (error) {
    sendError(res, error, "Failed to remove push token");
  }
};

// GET /api/meta  (public) - the shared enum values every app must agree on
export const getMeta = async (_req: Request, res: Response) => {
  const settings = await getSettings().catch(() => null);
  res.json({
    success: true,
    data: {
      categories: PRODUCT_CATEGORIES,
      locations: SERVICE_LOCATIONS,
      roles: ROLES,
      orderStatuses: ORDER_STATUSES,
      paymentStatuses: PAYMENT_STATUSES,
      paymentMethods: PAYMENT_METHODS,
      // which options the checkout screen should offer
      cashOnDelivery: settings ? settings.allowCod : true,
      onlinePayments: razorpayConfigured(),
      // shown on the storefront when an admin sets them
      announcement: settings?.announcement ?? "",
      supportPhone: settings?.supportPhone ?? "",
      supportEmail: settings?.supportEmail ?? "",
      freeShippingThreshold: settings?.freeShippingThreshold ?? 0,
      deliveryStatuses: DELIVERY_STATUSES,
      shopStatuses: SHOP_STATUSES,
      partnerStatuses: PARTNER_STATUSES,
      adStatuses: AD_STATUSES,
      ticketStatuses: TICKET_STATUSES,
      ticketCategories: TICKET_CATEGORIES,
      settlementStatuses: SETTLEMENT_STATUSES,
      vehicleTypes: VEHICLE_TYPES,
      // UI label hints
      orderStatusLabels: {
        placed: "Placed",
        processing: "Processing",
        shipping: "Dispatched",
        delivered: "Delivered",
        cancelled: "Cancelled",
      },
    },
  });
};

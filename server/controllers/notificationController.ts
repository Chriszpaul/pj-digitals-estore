import { Request, Response } from "express";
import Notification from "../models/Notification.js";
import { sendError } from "../utils/http.js";

// GET /api/notifications?page=&limit=&unread=true
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = { user: req.user._id };
    if (req.query.unread === "true") query.isRead = false;

    const [total, unread, data] = await Promise.all([
      Notification.countDocuments({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
      Notification.find(query)
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data,
      unreadCount: unread,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch notifications");
  }
};

// PUT /api/notifications/read-all
export const markAllRead = async (req: Request, res: Response) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    sendError(res, error, "Failed to update notifications");
  }
};

// PUT /api/notifications/:id/read
export const markRead = async (req: Request, res: Response) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!n) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, data: n });
  } catch (error) {
    sendError(res, error, "Failed to update notification");
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: "Notification removed" });
  } catch (error) {
    sendError(res, error, "Failed to delete notification");
  }
};

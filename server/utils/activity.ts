import { Request } from "express";
import ActivityLog from "../models/ActivityLog.js";

/** Records an admin/audit event. Never throws. */
export const logActivity = async (
  req: Request,
  action: string,
  targetType?: string,
  targetId?: any,
  meta?: Record<string, any>,
) => {
  try {
    await ActivityLog.create({
      actor: req.user?._id,
      actorName: req.user?.name || req.user?.email,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      meta,
      ip: req.ip,
    });
  } catch (error) {
    console.error("logActivity failed:", error);
  }
};

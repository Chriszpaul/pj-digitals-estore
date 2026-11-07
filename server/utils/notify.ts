import Notification from "../models/Notification.js";
import User from "../models/User.js";

type Payload = {
  type: string; // order | delivery | shop | payment | support | system
  title: string;
  body?: string;
  data?: Record<string, any>;
};

const sendExpoPush = async (messages: any[]) => {
  for (let i = 0; i < messages.length; i += 100) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
};

/**
 * Stores an in-app notification for each user and (best effort) pushes it to
 * their phones through Expo. Never throws - a failed notification must not
 * fail the request that triggered it.
 */
export const notify = async (userIds: any, payload: Payload) => {
  try {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
    if (!ids.length) return;

    await Notification.insertMany(ids.map((user) => ({ user, ...payload })));

    const users = await User.find({ _id: { $in: ids } }).select("pushTokens");
    const messages = users.flatMap((u: any) =>
      (u.pushTokens || []).map((to: string) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: "default",
      })),
    );
    if (messages.length) await sendExpoPush(messages);
  } catch (error) {
    console.error("notify failed:", error);
  }
};

export const notifyAdmins = async (payload: Payload) => {
  const admins = await User.find({ role: "admin" }).select("_id");
  await notify(admins.map((a) => a._id), payload);
};

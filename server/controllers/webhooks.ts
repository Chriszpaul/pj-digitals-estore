import { verifyWebhook } from "@clerk/express/webhooks";
import { Request, Response } from "express";
import User from "../models/User.js";

export const clerkWebhook = async (req: Request, res: Response) => {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return res.status(400).send("Error verifying webhook");
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const d: any = evt.data;
      const primary =
        d.email_addresses?.find((e: any) => e.id === d.primary_email_address_id) ??
        d.email_addresses?.[0];

      const userData = {
        clerkId: d.id,
        email: primary?.email_address?.toLowerCase(),
        name: [d.first_name, d.last_name].filter(Boolean).join(" ") || undefined,
        image: d.image_url,
      };

      try {
        // `role` is deliberately not in $set so updates never reset an admin
        await User.findOneAndUpdate(
          { clerkId: d.id },
          { $set: userData },
          { upsert: true },
        );
      } catch (e: any) {
        // same email already stored under an older Clerk id -> relink it
        if (e?.code === 11000 && userData.email) {
          await User.findOneAndUpdate({ email: userData.email }, { $set: userData });
        } else {
          throw e;
        }
      }
    }

    // Always acknowledge, otherwise Clerk keeps retrying (and the request
    // used to hang for event types other than created/updated).
    return res.json({ success: true, message: "Webhook received" });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return res.status(500).send("Error processing webhook");
  }
};

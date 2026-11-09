import { round2 } from "./http.js";
import type { PlatformSettings } from "./settings.js";

/**
 * All pricing rules live here so the order total is always computed on the
 * server (never trusted from the client). The values come from the platform
 * settings (editable by admins, with env variables as the defaults):
 * shippingCost, freeShippingThreshold (0 = off) and taxRate (0.18 = 18%).
 */
export const computeTotals = (
  subtotal: number,
  settings: Pick<PlatformSettings, "shippingCost" | "freeShippingThreshold" | "taxRate">,
) => {
  const flat = Number(settings.shippingCost);
  const threshold = Number(settings.freeShippingThreshold);
  const taxRate = Number(settings.taxRate);

  const shippingCost =
    threshold > 0 && subtotal >= threshold ? 0 : Number.isFinite(flat) ? flat : 0;
  const tax = round2(subtotal * (Number.isFinite(taxRate) ? taxRate : 0));
  const totalAmount = round2(subtotal + shippingCost + tax);

  return { subtotal: round2(subtotal), shippingCost, tax, totalAmount };
};

/** Razorpay expects amounts in the smallest currency unit (paise). */
export const toPaise = (amount: number) => Math.round(amount * 100);

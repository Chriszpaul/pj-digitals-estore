import { round2 } from "./http.js";

/**
 * All pricing rules live here so the order total is always computed on the
 * server (never trusted from the client). Configure via env vars.
 *   SHIPPING_COST            flat shipping fee            (default 2)
 *   FREE_SHIPPING_THRESHOLD  subtotal for free shipping   (default 0 = off)
 *   TAX_RATE                 e.g. 0.18 for 18% GST        (default 0)
 */
export const computeTotals = (subtotal: number) => {
  const flat = Number(process.env.SHIPPING_COST ?? 2);
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD ?? 0);
  const taxRate = Number(process.env.TAX_RATE ?? 0);

  const shippingCost =
    threshold > 0 && subtotal >= threshold ? 0 : Number.isFinite(flat) ? flat : 0;
  const tax = round2(subtotal * (Number.isFinite(taxRate) ? taxRate : 0));
  const totalAmount = round2(subtotal + shippingCost + tax);

  return { subtotal: round2(subtotal), shippingCost, tax, totalAmount };
};

/** Razorpay expects amounts in the smallest currency unit (paise). */
export const toPaise = (amount: number) => Math.round(amount * 100);

import crypto from "crypto";
import { HttpError } from "./http.js";

// Dependency-free Razorpay helpers (REST via fetch + HMAC via node:crypto).

const API = "https://api.razorpay.com/v1";

export const razorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID as string;

const safeEqualHex = (a: string, b: string) => {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** amountPaise must be an integer >= 100. Returns the Razorpay order object. */
export const createRazorpayOrder = async (
  amountPaise: number,
  receipt: string,
  notes: Record<string, string> = {},
): Promise<{ id: string; amount: number; currency: string }> => {
  if (!razorpayConfigured()) {
    throw new HttpError(503, "Online payments are not configured");
  }
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: receipt.slice(0, 40),
        notes,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error("Razorpay unreachable:", error);
    throw new HttpError(502, "Payment provider is not reachable, please try again");
  }

  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Razorpay order creation failed:", response.status, body?.error);
    throw new HttpError(502, "Could not start the payment, please try again");
  }
  return body;
};

/** Checks the signature the app receives after a successful checkout. */
export const verifyPaymentSignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
};

/** Checks a webhook against the RAW request body. */
export const verifyWebhookSignature = (rawBody: Buffer, signature: string) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
};

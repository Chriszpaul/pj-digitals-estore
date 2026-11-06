import { Response } from "express";

/**
 * Maps common Mongoose errors to proper HTTP codes and avoids leaking
 * internal error details to clients in production.
 */
export const sendError = (
  res: Response,
  error: any,
  fallback = "Something went wrong",
) => {
  if (res.headersSent) return;

  let status = 500;
  let message = fallback;

  if (error?.name === "ValidationError") {
    status = 400;
    message = Object.values(error.errors || {})
      .map((e: any) => e.message)
      .join(", ") || error.message;
  } else if (error?.name === "CastError") {
    status = 400;
    message = `Invalid value for ${error.path}`;
  } else if (error?.code === 11000) {
    status = 409;
    message = "Duplicate value";
  } else if (error?.status && error.status < 500) {
    status = error.status;
    message = error.message;
  } else {
    console.error(fallback + ":", error);
    if (process.env.NODE_ENV !== "production") {
      message = error?.message || fallback;
    }
  }

  res.status(status).json({ success: false, message });
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

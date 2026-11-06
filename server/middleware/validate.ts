import { NextFunction, Request, Response } from "express";
import multer from "multer";

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Rejects malformed ids with 400 instead of a Mongoose CastError (500). */
export const validateObjectId =
  (...params: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    for (const p of params.length ? params : ["id"]) {
      if (!OBJECT_ID.test(String(req.params[p]))) {
        return res
          .status(400)
          .json({ success: false, message: `Invalid ${p}` });
      }
    }
    next();
  };

export const notFound = (req: Request, res: Response) => {
  res
    .status(404)
    .json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  const status = err?.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({
    success: false,
    message:
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err?.message || "Internal server error",
  });
};

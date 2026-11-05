import { Request, Response } from "express";
import type { UploadApiResponse } from "cloudinary";
import Product from "../models/Products.js";
import cloudinary from "../config/cloudinary.js";

// --------------------------------------------------
// CLOUDINARY IMAGE UPLOAD
// --------------------------------------------------

const uploadToCloudinary = (
  file: Express.Multer.File,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    let settled = false;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "pj-digitals-estore/products",
        resource_type: "image",
      },
      (error, result) => {
        if (settled) return;
        settled = true;

        if (error) {
          console.error("CLOUDINARY ERROR DETAILS:");
          console.dir(error, { depth: 10 });

          console.error("ERROR PROPERTIES:", Object.getOwnPropertyNames(error));

          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary returned no upload result"));
          return;
        }

        resolve(result);
      },
    );

    uploadStream.on("error", (error) => {
      if (settled) return;
      settled = true;

      console.error("CLOUDINARY STREAM ERROR:", error);
      reject(error);
    });

    // IMPORTANT: End the stream exactly once.
    uploadStream.end(file.buffer);
  });
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getUploadedFiles = (req: Request): Express.Multer.File[] => {
  return (req.files as Express.Multer.File[]) || [];
};

const parseSizes = (value: any): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      return parsed ? [parsed] : [];
    } catch {
      return value
        .split(",")
        .map((size: string) => size.trim())
        .filter(Boolean);
    }
  }

  return [value];
};

const parseExistingImages = (value: any): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((image) => typeof image === "string" && image.trim());
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (image) => typeof image === "string" && image.trim(),
        );
      }

      if (typeof parsed === "string" && parsed.trim()) {
        return [parsed];
      }
    } catch {
      return [value];
    }
  }

  return [];
};

// Supports both existing URL strings and older Cloudinary result objects.
const getCloudinaryPublicId = (image: any): string | null => {
  if (!image) return null;

  if (typeof image === "object" && image.public_id) {
    return image.public_id;
  }

  const imageUrl =
    typeof image === "string" ? image : image.secure_url || image.url;

  if (typeof imageUrl !== "string") return null;

  try {
    const pathname = new URL(imageUrl).pathname;
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) return null;

    let path = pathname.slice(uploadIndex + uploadMarker.length);

    path = path.split("?")[0];

    let segments = path.split("/").filter(Boolean);

    // Remove Cloudinary transformation segments when present.
    const versionIndex = segments.findIndex((segment) =>
      /^v\d+$/.test(segment),
    );

    if (versionIndex !== -1) {
      segments = segments.slice(versionIndex + 1);
    } else if (segments[0]?.includes(",")) {
      segments = segments.slice(1);
    }

    if (segments.length === 0) return null;

    // Remove the file extension.
    const lastIndex = segments.length - 1;

    segments[lastIndex] = segments[lastIndex].replace(/\.[^/.]+$/, "");

    return decodeURIComponent(segments.join("/"));
  } catch {
    return null;
  }
};

// --------------------------------------------------
// GET ALL PRODUCTS
// GET /api/products?page=1&limit=10
// --------------------------------------------------

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const query = { isActive: true };

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET PRODUCTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve products",
    });
  }
};

// --------------------------------------------------
// GET SINGLE PRODUCT
// GET /api/products/:id
// --------------------------------------------------

export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error("GET PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve product",
    });
  }
};

// --------------------------------------------------
// CREATE PRODUCT
// POST /api/products
// --------------------------------------------------

export const createProduct = async (req: Request, res: Response) => {
  try {
    const files = getUploadedFiles(req);

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one product image.",
      });
    }

    console.log(`Uploading ${files.length} product image(s)...`);

    // Upload all images to Cloudinary.
    const uploadedResults = await Promise.all(
      files.map((file) => uploadToCloudinary(file)),
    );

    // Store consistent image URL strings in MongoDB.
    const images = uploadedResults.map((result) => result.secure_url);

    let sizes = parseSizes(req.body.sizes);

    const productData = {
      ...req.body,
      images,
      sizes,
    };

    // Do not save multipart-only fields as product properties.
    delete (productData as any).existingImages;

    const product = await Product.create(productData);

    console.log("PRODUCT CREATED:", product._id);

    return res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error("CREATE PRODUCT ERROR:", {
      message: error.message,
      http_code: error.http_code,
      stack: error.stack,
    });

    const isCloudinaryError = Boolean(error.http_code);

    return res.status(isCloudinaryError ? 502 : 500).json({
      success: false,
      message: isCloudinaryError
        ? `Image upload failed: ${error.message}`
        : error.message || "Failed to create product",
    });
  }
};

// --------------------------------------------------
// UPDATE PRODUCT
// PUT /api/products/:id
// --------------------------------------------------

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const files = getUploadedFiles(req);

    // Preserve existing images selected by the admin.
    let images = parseExistingImages(req.body.existingImages);

    // Upload any newly selected images.
    if (files.length > 0) {
      console.log(`Uploading ${files.length} new image(s)...`);

      const uploadedResults = await Promise.all(
        files.map((file) => uploadToCloudinary(file)),
      );

      const newImages = uploadedResults.map((result) => result.secure_url);

      images = [...images, ...newImages];
    }

    const updates: Record<string, any> = {
      ...req.body,
    };

    // Parse sizes when supplied.
    if (req.body.sizes !== undefined) {
      updates.sizes = parseSizes(req.body.sizes);
    }

    // Only update images if the admin explicitly changed them.
    if (req.body.existingImages !== undefined || files.length > 0) {
      updates.images = images;
    }

    // Remove fields used only for multipart form handling.
    delete updates.existingImages;

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    console.log("PRODUCT UPDATED:", product._id);

    return res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error("UPDATE PRODUCT ERROR:", {
      message: error.message,
      http_code: error.http_code,
      stack: error.stack,
    });

    const isCloudinaryError = Boolean(error.http_code);

    return res.status(isCloudinaryError ? 502 : 500).json({
      success: false,
      message: isCloudinaryError
        ? `Image upload failed: ${error.message}`
        : error.message || "Failed to update product",
    });
  }
};

// --------------------------------------------------
// DELETE PRODUCT
// DELETE /api/products/:id
// --------------------------------------------------

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete associated Cloudinary images.
    if (product.images && product.images.length > 0) {
      const deletePromises = product.images.map(async (image: any) => {
        const publicId = getCloudinaryPublicId(image);

        if (!publicId) {
          console.warn("Could not extract Cloudinary public ID:", image);
          return null;
        }

        return cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
      });

      const deleteResults = await Promise.allSettled(deletePromises);

      deleteResults.forEach((result) => {
        if (result.status === "rejected") {
          console.error("CLOUDINARY DELETE ERROR:", result.reason);
        }
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    console.log("PRODUCT DELETED:", req.params.id);

    return res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    console.error("DELETE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product",
    });
  }
};

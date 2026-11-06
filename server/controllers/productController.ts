import { Request, Response } from "express";
import type { UploadApiResponse } from "cloudinary";
import Product from "../models/Products.js";
import cloudinary from "../config/cloudinary.js";
import { PRODUCT_CATEGORIES } from "../types/index.js";
import { escapeRegex, sendError } from "../utils/http.js";

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

// Only these fields can be set by the client (no mass-assignment).
const PRODUCT_FIELDS = [
  "name",
  "description",
  "price",
  "comparePrice",
  "category",
  "stock",
  "isFeatured",
  "isActive",
] as const;

const pickProductFields = (body: any) => {
  const out: Record<string, any> = {};
  for (const f of PRODUCT_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
};

const destroyImages = async (images: string[]) => {
  const results = await Promise.allSettled(
    images.map(async (image) => {
      const publicId = getCloudinaryPublicId(image);
      if (!publicId) return null;
      return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    }),
  );
  results.forEach((r) => {
    if (r.status === "rejected") console.error("CLOUDINARY DELETE ERROR:", r.reason);
  });
};

const isAdmin = (req: Request) => req.user?.role === "admin";

// --------------------------------------------------
// GET ALL PRODUCTS
// GET /api/products?page=&limit=&search=&category=&minPrice=&maxPrice=
//                  &featured=true&inStock=true&sort=newest|price_asc|price_desc|name
// Admins may add &includeInactive=true
// --------------------------------------------------

const SORTS: Record<string, any> = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const { search, category, minPrice, maxPrice, featured, inStock, sort } =
      req.query;

    const query: any = {};
    if (!(isAdmin(req) && req.query.includeInactive === "true")) {
      query.isActive = true;
    }

    if (category) {
      if (!(PRODUCT_CATEGORIES as readonly string[]).includes(String(category))) {
        return res.status(400).json({
          success: false,
          message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
        });
      }
      query.category = String(category);
    }

    if (search) {
      const rx = new RegExp(escapeRegex(String(search).trim()), "i");
      query.$or = [{ name: rx }, { description: rx }];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) query.price.$lte = Number(maxPrice);
    }

    if (featured === "true") query.isFeatured = true;
    if (inStock === "true") query.stock = { $gt: 0 };

    const sortBy = SORTS[String(sort)] || SORTS.newest;

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      success: true,
      data: products,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to retrieve products");
  }
};

// --------------------------------------------------
// GET SINGLE PRODUCT
// GET /api/products/:id
// --------------------------------------------------

export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    // hide inactive (soft-deleted/unpublished) products from the public
    if (!product || (!product.isActive && !isAdmin(req))) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    sendError(res, error, "Failed to retrieve product");
  }
};

// --------------------------------------------------
// CREATE PRODUCT
// POST /api/products
// --------------------------------------------------

export const createProduct = async (req: Request, res: Response) => {
  let images: string[] = [];
  try {
    const files = getUploadedFiles(req);

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one product image.",
      });
    }

    const uploaded = await Promise.all(files.map((f) => uploadToCloudinary(f)));
    images = uploaded.map((r) => r.secure_url);

    const product = await Product.create({
      ...pickProductFields(req.body),
      images,
      sizes: parseSizes(req.body.sizes),
    });

    return res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    // don't leave orphaned images in Cloudinary if the DB write failed
    if (images.length) await destroyImages(images);

    if (error.http_code) {
      console.error("CLOUDINARY ERROR:", error.message);
      return res.status(502).json({
        success: false,
        message: `Image upload failed: ${error.message}`,
      });
    }
    sendError(res, error, "Failed to create product");
  }
};

// --------------------------------------------------
// UPDATE PRODUCT
// PUT /api/products/:id
// --------------------------------------------------

export const updateProduct = async (req: Request, res: Response) => {
  let newImages: string[] = [];
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const files = getUploadedFiles(req);
    const updates: Record<string, any> = pickProductFields(req.body);

    if (req.body.sizes !== undefined) updates.sizes = parseSizes(req.body.sizes);

    if (files.length > 0) {
      const uploaded = await Promise.all(files.map((f) => uploadToCloudinary(f)));
      newImages = uploaded.map((r) => r.secure_url);
    }

    // Only touch images if the admin explicitly changed them.
    let removed: string[] = [];
    if (req.body.existingImages !== undefined || files.length > 0) {
      const kept =
        req.body.existingImages !== undefined
          ? parseExistingImages(req.body.existingImages)
          : existing.images; // new files only -> keep current ones
      const finalImages = [...kept, ...newImages];

      if (finalImages.length === 0) {
        return res.status(400).json({
          success: false,
          message: "A product needs at least one image.",
        });
      }
      updates.images = finalImages;
      removed = existing.images.filter((img) => !finalImages.includes(img));
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (removed.length) await destroyImages(removed);

    return res.json({ success: true, data: product });
  } catch (error: any) {
    if (newImages.length) await destroyImages(newImages);

    if (error.http_code) {
      console.error("CLOUDINARY ERROR:", error.message);
      return res.status(502).json({
        success: false,
        message: `Image upload failed: ${error.message}`,
      });
    }
    sendError(res, error, "Failed to update product");
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
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    await Product.findByIdAndDelete(req.params.id);
    // delete images only after the DB delete succeeded
    await destroyImages(product.images || []);

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    sendError(res, error, "Failed to delete product");
  }
};

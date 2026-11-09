import { Request, Response } from "express";
import Product from "../models/Products.js";
import Shop from "../models/Shop.js";
import { PRODUCT_CATEGORIES } from "../types/index.js";
import { escapeRegex, sendError } from "../utils/http.js";
import { destroyImages, uploadToCloudinary } from "../utils/cloudinaryUpload.js";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getUploadedFiles = (req: Request): Express.Multer.File[] =>
  (req.files as Express.Multer.File[]) || [];

const parseSizes = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      return parsed ? [parsed] : [];
    } catch {
      return value
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }
  return [value];
};

const parseExistingImages = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((i) => typeof i === "string" && i.trim());
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((i) => typeof i === "string" && i.trim());
      }
      if (typeof parsed === "string" && parsed.trim()) return [parsed];
    } catch {
      return [value];
    }
  }
  return [];
};

// Fields the client may set. `shop` and `isFeatured` are handled separately.
const PRODUCT_FIELDS = [
  "name",
  "description",
  "price",
  "comparePrice",
  "category",
  "stock",
  "isActive",
] as const;

const pickProductFields = (body: any) => {
  const out: Record<string, any> = {};
  for (const f of PRODUCT_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
};

const isAdmin = (req: Request) => req.user?.role === "admin";
const isShopOwner = (req: Request) => req.user?.role !== "admin" && !!req.shop;

const SHOP_SELECT = "name slug logo location phone addressLine status";

/** Shop owners may only touch their own products. Returns false (and responds) if denied. */
const canManage = (req: Request, res: Response, product: any) => {
  if (isAdmin(req)) return true;
  if (product.shop && req.shop && product.shop.toString() === req.shop._id.toString()) {
    return true;
  }
  // 404 instead of 403 so other shops' product ids aren't confirmable
  res.status(404).json({ success: false, message: "Product not found" });
  return false;
};

// --------------------------------------------------
// GET ALL PRODUCTS
// GET /api/products?page=&limit=&search=&category=&minPrice=&maxPrice=
//     &featured=true&inStock=true&sort=newest|price_asc|price_desc|name|rating
//     &shop=<shopId>&location=Thodupuzha|Muttom
// Admins may add &includeInactive=true
// --------------------------------------------------

const SORTS: Record<string, any> = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  name: { name: 1, _id: 1 },
  rating: { "ratings.average": -1, "ratings.count": -1, _id: 1 },
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const { search, category, minPrice, maxPrice, featured, inStock, sort, shop, location } =
      req.query;

    const query: any = {};
    const seeAll = isAdmin(req) && req.query.includeInactive === "true";
    if (!seeAll) query.isActive = true;

    if (category) {
      if (!(PRODUCT_CATEGORIES as readonly string[]).includes(String(category))) {
        return res.status(400).json({
          success: false,
          message: `category must be one of: ${PRODUCT_CATEGORIES.join(", ")}`,
        });
      }
      query.category = String(category);
    }

    // Shop / location filtering. Products of pending/suspended shops stay hidden.
    if (!seeAll) {
      const hidden: any[] = await Shop.find({ status: { $ne: "approved" } }).distinct("_id");
      if (shop) {
        if (hidden.some((h) => h.toString() === String(shop))) {
          return res.json({ success: true, data: [], pagination: { total: 0, page, pages: 0 } });
        }
        query.shop = String(shop);
      } else if (location) {
        query.shop = {
          $in: await Shop.find({ status: "approved", location: String(location) }).distinct("_id"),
        };
      } else if (hidden.length) {
        query.shop = { $nin: hidden };
      }
    } else if (shop) {
      query.shop = String(shop);
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
        .populate("shop", SHOP_SELECT)
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
    const product: any = await Product.findById(req.params.id).populate("shop", SHOP_SELECT);

    const shopHidden = product?.shop && product.shop.status !== "approved";
    if (!product || ((!product.isActive || shopHidden) && !isAdmin(req))) {
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
// CREATE PRODUCT (admin, or approved shop owner -> product belongs to their shop)
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

    const data: Record<string, any> = pickProductFields(req.body);

    if (isShopOwner(req)) {
      data.shop = req.shop._id; // forced - owners can't create for other shops
    } else {
      // admin: optional shop (or the shop they're acting as), optional featured flag
      const shopRef = req.body.shop || req.header("x-shop-id");
      if (shopRef) {
        const shop = await Shop.findById(shopRef);
        if (!shop) {
          return res.status(400).json({ success: false, message: "Shop not found" });
        }
        data.shop = shop._id;
      }
      if (req.body.isFeatured !== undefined) data.isFeatured = req.body.isFeatured;
    }

    const uploaded = await Promise.all(files.map((f) => uploadToCloudinary(f)));
    images = uploaded.map((r) => r.secure_url);

    const product = await Product.create({
      ...data,
      images,
      sizes: parseSizes(req.body.sizes),
    });

    return res.status(201).json({ success: true, data: product });
  } catch (error: any) {
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
    const existing: any = await Product.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    if (!canManage(req, res, existing)) return;

    const files = getUploadedFiles(req);
    const updates: Record<string, any> = pickProductFields(req.body);

    if (req.body.sizes !== undefined) updates.sizes = parseSizes(req.body.sizes);

    if (isAdmin(req)) {
      if (req.body.isFeatured !== undefined) updates.isFeatured = req.body.isFeatured;
      if (req.body.shop !== undefined) {
        if (req.body.shop === "" || req.body.shop === "null") {
          updates.shop = null;
        } else {
          const shop = await Shop.findById(req.body.shop);
          if (!shop) {
            return res.status(400).json({ success: false, message: "Shop not found" });
          }
          updates.shop = shop._id;
        }
      }
    }

    if (files.length > 0) {
      const uploaded = await Promise.all(files.map((f) => uploadToCloudinary(f)));
      newImages = uploaded.map((r) => r.secure_url);
    }

    let removed: string[] = [];
    if (req.body.existingImages !== undefined || files.length > 0) {
      const kept =
        req.body.existingImages !== undefined
          ? parseExistingImages(req.body.existingImages)
          : existing.images;
      const finalImages = [...kept, ...newImages];

      if (finalImages.length === 0) {
        return res.status(400).json({
          success: false,
          message: "A product needs at least one image.",
        });
      }
      updates.images = finalImages;
      removed = existing.images.filter((img: string) => !finalImages.includes(img));
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
    const product: any = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    if (!canManage(req, res, product)) return;

    await Product.findByIdAndDelete(req.params.id);
    await destroyImages(product.images || []);

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    sendError(res, error, "Failed to delete product");
  }
};

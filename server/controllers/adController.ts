import { Request, Response } from "express";
import Advertisement from "../models/Advertisement.js";
import { AD_PLACEMENTS, AD_STATUSES, SERVICE_LOCATIONS } from "../types/index.js";
import Shop from "../models/Shop.js";
import Product from "../models/Products.js";
import { sendError } from "../utils/http.js";
import { destroyImages, uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { logActivity } from "../utils/activity.js";

const parseLocations = (value: any): string[] => {
  if (!value) return [];
  let list: any = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      list = value.split(",");
    }
  }
  return (Array.isArray(list) ? list : [list])
    .map((s: any) => String(s).trim())
    .filter((s: string) => (SERVICE_LOCATIONS as readonly string[]).includes(s));
};

const parsePlacements = (value: any): string[] => {
  if (!value) return [];
  let list: any = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      list = value.split(",");
    }
  }
  return (Array.isArray(list) ? list : [list])
    .map((s: any) => String(s).trim())
    .filter((s: string) => (AD_PLACEMENTS as readonly string[]).includes(s));
};

// ===================== PUBLIC =====================

// GET /api/ads?placement=home&location=&shop=&limit=
// Approved ads that are running now, from approved shops, most important first.
export const getPublicAds = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const query: any = {
      status: "approved",
      startsAt: { $lte: now },
      $and: [{ $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] }],
    };
    if (req.query.shop) query.shop = String(req.query.shop);
    if (req.query.placement) {
      const placement = String(req.query.placement);
      if (!(AD_PLACEMENTS as readonly string[]).includes(placement)) {
        return res.status(400).json({
          success: false,
          message: `placement must be one of: ${AD_PLACEMENTS.join(", ")}`,
        });
      }
      // ads saved before placements existed count as "home"
      query.$and.push({
        $or: [{ placements: placement }, ...(placement === "home" ? [{ placements: { $exists: false } }, { placements: { $size: 0 } }] : [])],
      });
    }
    if (req.query.location) {
      query.$and.push({
        $or: [
          { targetLocations: { $size: 0 } },
          { targetLocations: String(req.query.location) },
        ],
      });
    }
    // never advertise for a shop that isn't approved (suspended shops lose their ads)
    query.shop = {
      ...(query.shop ? { $eq: query.shop } : {}),
      $in: await Shop.find({ status: "approved" }).distinct("_id"),
    };

    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));
    const ads = await Advertisement.find(query)
      .select("-impressions -clicks -moderatedBy")
      .populate("shop", "name logo location")
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit);

    res.json({ success: true, data: ads });
  } catch (error) {
    sendError(res, error, "Failed to fetch ads");
  }
};

// POST /api/ads/impressions   body: { ids: [adId, ...] }   (public, batched, fire-and-forget)
export const trackImpressions = async (req: Request, res: Response) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : [])
      .map(String)
      .filter((id: string) => /^[a-f\d]{24}$/i.test(id))
      .slice(0, 30);
    if (ids.length) {
      await Advertisement.updateMany({ _id: { $in: ids }, status: "approved" }, { $inc: { impressions: 1 } });
    }
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed to record impressions");
  }
};

// POST /api/ads/:id/click   (public, fire-and-forget)
export const trackClick = async (req: Request, res: Response) => {
  try {
    await Advertisement.updateOne({ _id: req.params.id, status: "approved" }, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed to record click");
  }
};

// ===================== SHOP OWNER =====================

// GET /api/shop/ads?status=
export const getMyAds = async (req: Request, res: Response) => {
  try {
    const query: any = { shop: req.shop._id };
    if (req.query.status) query.status = String(req.query.status);
    const ads = await Advertisement.find(query).sort("-createdAt");
    res.json({ success: true, data: ads });
  } catch (error) {
    sendError(res, error, "Failed to fetch ads");
  }
};

// POST /api/shop/ads   (multipart; `image` file)
// body: title, description?, targetLocations?, startsAt?, endsAt?, product?, draft?=true
export const createAd = async (req: Request, res: Response) => {
  let image: string | undefined;
  try {
    const { title, description, startsAt, endsAt, product } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "title is required" });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) image = (await uploadToCloudinary(file, "pj-digitals-estore/ads")).secure_url;

    if (product && !(await Product.exists({ _id: product, shop: req.shop._id }))) {
      return res.status(400).json({ success: false, message: "That product doesn't belong to your shop" });
    }

    const draft = req.body.draft === true || req.body.draft === "true";
    const ad = await Advertisement.create({
      shop: req.shop._id,
      placements: parsePlacements(req.body.placements).length ? parsePlacements(req.body.placements) : ["home"],
      title: title.trim(),
      description,
      image,
      product: product || undefined,
      targetLocations: parseLocations(req.body.targetLocations),
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      status: draft ? "draft" : "pending",
    });

    if (!draft) {
      await notifyAdmins({
        type: "shop",
        title: "Advertisement awaiting approval",
        body: `${req.shop.name}: ${ad.title}`,
        data: { adId: ad._id },
      });
    }

    res.status(201).json({ success: true, data: ad });
  } catch (error) {
    if (image) await destroyImages([image]);
    sendError(res, error, "Failed to create advertisement");
  }
};

// PUT /api/shop/ads/:id   (multipart). Editing an approved/rejected ad sends it
// back for moderation. body.draft="true" keeps/puts it in draft.
export const updateAd = async (req: Request, res: Response) => {
  let newImage: string | undefined;
  try {
    const ad: any = await Advertisement.findOne({ _id: req.params.id, shop: req.shop._id });
    if (!ad) {
      return res.status(404).json({ success: false, message: "Advertisement not found" });
    }

    const { title, description, startsAt, endsAt, product } = req.body;
    if (title !== undefined) ad.title = String(title).trim();
    if (description !== undefined) ad.description = description;
    if (startsAt !== undefined) ad.startsAt = startsAt || undefined;
    if (endsAt !== undefined) ad.endsAt = endsAt || undefined;
    if (product !== undefined) ad.product = product || undefined;
    if (req.body.targetLocations !== undefined) {
      ad.targetLocations = parseLocations(req.body.targetLocations);
    }
    if (req.body.placements !== undefined) {
      const p = parsePlacements(req.body.placements);
      ad.placements = p.length ? p : ["home"];
    }
    if (product && !(await Product.exists({ _id: product, shop: req.shop._id }))) {
      return res.status(400).json({ success: false, message: "That product doesn't belong to your shop" });
    }

    const file = req.file as Express.Multer.File | undefined;
    const oldImage = ad.image;
    if (file) {
      newImage = (await uploadToCloudinary(file, "pj-digitals-estore/ads")).secure_url;
      ad.image = newImage;
    }

    const draft = req.body.draft === true || req.body.draft === "true";
    ad.status = draft ? "draft" : "pending";
    ad.rejectionReason = undefined;
    await ad.save();
    if (newImage && oldImage) await destroyImages([oldImage]);

    if (!draft) {
      await notifyAdmins({
        type: "shop",
        title: "Advertisement awaiting approval",
        body: `${req.shop.name}: ${ad.title}`,
        data: { adId: ad._id },
      });
    }

    res.json({ success: true, data: ad });
  } catch (error) {
    if (newImage) await destroyImages([newImage]);
    sendError(res, error, "Failed to update advertisement");
  }
};

// DELETE /api/shop/ads/:id
export const deleteAd = async (req: Request, res: Response) => {
  try {
    const ad: any = await Advertisement.findOneAndDelete({
      _id: req.params.id,
      shop: req.shop._id,
    });
    if (!ad) {
      return res.status(404).json({ success: false, message: "Advertisement not found" });
    }
    if (ad.image) await destroyImages([ad.image]);
    res.json({ success: true, message: "Advertisement deleted" });
  } catch (error) {
    sendError(res, error, "Failed to delete advertisement");
  }
};

// ===================== ADMIN MODERATION =====================

// GET /api/admin/ads?status=pending&page=&limit=
export const adminListAds = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.shop) query.shop = String(req.query.shop);

    const [total, ads] = await Promise.all([
      Advertisement.countDocuments(query),
      Advertisement.find(query)
        .populate("shop", "name location")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: ads,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch ads");
  }
};

// PUT /api/admin/ads/:id/status   body: { status: "approved" | "rejected", reason? }
export const adminModerateAd = async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "status must be approved or rejected" });
    }
    if (status === "rejected" && !reason?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please give a reason when rejecting" });
    }

    const ad: any = await Advertisement.findById(req.params.id).populate("shop", "owner name");
    if (!ad) {
      return res.status(404).json({ success: false, message: "Advertisement not found" });
    }
    if (!(AD_STATUSES as readonly string[]).includes(ad.status) || ad.status === "draft") {
      return res
        .status(400)
        .json({ success: false, message: "Draft ads haven't been submitted for review" });
    }

    ad.status = status;
    ad.rejectionReason = status === "rejected" ? reason.trim() : undefined;
    ad.moderatedBy = req.user._id;
    ad.moderatedAt = new Date();
    await ad.save();

    await notify(ad.shop.owner, {
      type: "shop",
      title: status === "approved" ? "Advertisement approved" : "Advertisement rejected",
      body: status === "approved" ? ad.title : `${ad.title}: ${reason}`,
      data: { adId: ad._id },
    });
    await logActivity(req, `ad.${status}`, "Advertisement", ad._id, { reason });

    res.json({ success: true, data: ad });
  } catch (error) {
    sendError(res, error, "Failed to moderate advertisement");
  }
};

// POST /api/admin/ads   (multipart; `image`)  - create an ad for ANY shop
// body: shop, title, description?, placements?, targetLocations?, startsAt?, endsAt?, product?,
//       priority?, status? ("approved" by default, or "pending" / "draft")
export const adminCreateAd = async (req: Request, res: Response) => {
  let image: string | undefined;
  try {
    const { shop: shopId, title, description, startsAt, endsAt, product } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "title is required" });
    const shop: any = shopId ? await Shop.findById(shopId) : null;
    if (!shop) return res.status(400).json({ success: false, message: "Choose a valid shop" });
    const status = req.body.status || "approved";
    if (!(AD_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${AD_STATUSES.join(", ")}` });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) image = (await uploadToCloudinary(file, "pj-digitals-estore/ads")).secure_url;

    const ad = await Advertisement.create({
      shop: shop._id,
      title: title.trim(),
      description,
      image,
      product: product || undefined,
      placements: parsePlacements(req.body.placements).length ? parsePlacements(req.body.placements) : ["home"],
      targetLocations: parseLocations(req.body.targetLocations),
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      priority: Number(req.body.priority) || 0,
      status,
      moderatedBy: status === "approved" ? req.user._id : undefined,
      moderatedAt: status === "approved" ? new Date() : undefined,
    });
    await logActivity(req, "ad.created", "Advertisement", ad._id, { shop: shop._id, status });
    res.status(201).json({ success: true, data: ad });
  } catch (error) {
    if (image) await destroyImages([image]);
    sendError(res, error, "Failed to create advertisement");
  }
};

// PUT /api/admin/ads/:id   (multipart; optional `image`) - edit any field, including status and priority
export const adminUpdateAd = async (req: Request, res: Response) => {
  let newImage: string | undefined;
  try {
    const ad: any = await Advertisement.findById(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: "Advertisement not found" });

    const b = req.body;
    if (b.title !== undefined) ad.title = String(b.title).trim();
    if (b.description !== undefined) ad.description = b.description;
    if (b.startsAt !== undefined) ad.startsAt = b.startsAt || undefined;
    if (b.endsAt !== undefined) ad.endsAt = b.endsAt || undefined;
    if (b.product !== undefined) ad.product = b.product || undefined;
    if (b.priority !== undefined) ad.priority = Number(b.priority) || 0;
    if (b.targetLocations !== undefined) ad.targetLocations = parseLocations(b.targetLocations);
    if (b.placements !== undefined) {
      const p = parsePlacements(b.placements);
      ad.placements = p.length ? p : ["home"];
    }
    if (b.shop !== undefined && String(b.shop) !== String(ad.shop)) {
      const shop = await Shop.findById(b.shop);
      if (!shop) return res.status(400).json({ success: false, message: "Shop not found" });
      ad.shop = shop._id;
    }
    if (b.status !== undefined) {
      if (!(AD_STATUSES as readonly string[]).includes(b.status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${AD_STATUSES.join(", ")}` });
      }
      if (b.status === "rejected" && !String(b.reason || "").trim()) {
        return res.status(400).json({ success: false, message: "Please give a reason when rejecting" });
      }
      ad.status = b.status;
      ad.rejectionReason = b.status === "rejected" ? String(b.reason).trim() : undefined;
      ad.moderatedBy = req.user._id;
      ad.moderatedAt = new Date();
    }

    const file = req.file as Express.Multer.File | undefined;
    const oldImage = ad.image;
    if (file) {
      newImage = (await uploadToCloudinary(file, "pj-digitals-estore/ads")).secure_url;
      ad.image = newImage;
    }
    await ad.save();
    if (newImage && oldImage) await destroyImages([oldImage]);
    await logActivity(req, "ad.updated", "Advertisement", ad._id, { status: ad.status });
    res.json({ success: true, data: ad });
  } catch (error) {
    if (newImage) await destroyImages([newImage]);
    sendError(res, error, "Failed to update advertisement");
  }
};

// DELETE /api/admin/ads/:id
export const adminDeleteAd = async (req: Request, res: Response) => {
  try {
    const ad: any = await Advertisement.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: "Advertisement not found" });
    if (ad.image) await destroyImages([ad.image]);
    await logActivity(req, "ad.deleted", "Advertisement", ad._id, { title: ad.title });
    res.json({ success: true, message: "Advertisement deleted" });
  } catch (error) {
    sendError(res, error, "Failed to delete advertisement");
  }
};

import { Request, Response } from "express";
import Advertisement from "../models/Advertisement.js";
import { AD_STATUSES, SERVICE_LOCATIONS } from "../types/index.js";
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

// ===================== PUBLIC =====================

// GET /api/ads?location=&shop=   -> approved ads that are currently running
export const getPublicAds = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const query: any = {
      status: "approved",
      startsAt: { $lte: now },
      $and: [{ $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] }],
    };
    if (req.query.shop) query.shop = String(req.query.shop);
    if (req.query.location) {
      query.$and.push({
        $or: [
          { targetLocations: { $size: 0 } },
          { targetLocations: String(req.query.location) },
        ],
      });
    }

    const ads = await Advertisement.find(query)
      .populate("shop", "name logo location")
      .sort("-createdAt")
      .limit(50);

    res.json({ success: true, data: ads });
  } catch (error) {
    sendError(res, error, "Failed to fetch ads");
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

    const draft = req.body.draft === true || req.body.draft === "true";
    const ad = await Advertisement.create({
      shop: req.shop._id,
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

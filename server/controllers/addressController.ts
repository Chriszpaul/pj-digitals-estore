import Address from "../models/Address.js";
import { Request, Response } from "express";
import { sendError } from "../utils/http.js";

const FIELDS = ["type", "fullName", "phone", "street", "city", "state", "zipCode", "country"] as const;

const pickFields = (body: any) => {
  const out: Record<string, any> = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) out[f] = typeof body[f] === "string" ? body[f].trim() : body[f];
  }
  return out;
};

// Get user addresses
// GET /api/address
export const getAddress = async (req: Request, res: Response) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });
    res.json({ success: true, data: addresses });
  } catch (error) {
    sendError(res, error, "Error fetching address");
  }
};

// add new address
// POST /api/address
export const addAddress = async (req: Request, res: Response) => {
  try {
    const data = pickFields(req.body);
    const existingCount = await Address.countDocuments({ user: req.user._id });

    // first address is always the default
    const isDefault = existingCount === 0 ? true : Boolean(req.body.isDefault);
    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const newAddress = await Address.create({
      ...data,
      user: req.user._id,
      isDefault,
    });

    res.status(201).json({ success: true, data: newAddress });
  } catch (error) {
    sendError(res, error, "Error adding address");
  }
};

// update address
// PUT /api/address/:id
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const address = await Address.findById(req.params.id);

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this address",
      });
    }

    if (req.body.isDefault === true || req.body.isDefault === "true") {
      await Address.updateMany(
        { user: req.user._id, _id: { $ne: address._id } },
        { isDefault: false },
      );
      address.isDefault = true;
    }

    address.set(pickFields(req.body));
    await address.save();

    res.json({ success: true, data: address });
  } catch (error) {
    sendError(res, error, "Error updating address");
  }
};

// delete address
// DELETE /api/address/:id
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const address = await Address.findById(req.params.id);

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this address",
      });
    }

    await address.deleteOne();

    // keep one default around
    if (address.isDefault) {
      const next = await Address.findOne({ user: req.user._id }).sort("-createdAt");
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    res.json({ success: true, message: "Address removed" });
  } catch (error) {
    sendError(res, error, "Error deleting address");
  }
};

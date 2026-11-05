import Address from "../models/Address.js";
import { Request, Response } from "express";

// Get user address
// GET /api/address
export const getAddress = async (req: Request, res: Response) => {
  try {
    const address = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });
    res.json({ success: true, data: address });
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }
    res.json(address);
  } catch (error) {
    res.status(500).json({ message: "Error fetching address" });
  }
};

// add new address
// POST /api/address
export const addAddress = async (req: Request, res: Response) => {
  try {
    const { type, street, city, state, zipCode, isDefault } = req.body;
    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const newAddress = await Address.create({
      user: req.user._id,
      type,
      street,
      city,
      state,
      zipCode,
      isDefault: isDefault || false,
    });

    // await newAddress.save();
    res.status(201).json({ success: true, data: newAddress });
  } catch (error) {
    res.status(500).json({ message: "Error adding address" });
  }
};

// update address
// PUT /api/address/:id
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const { type, street, city, state, zipCode, isDefault } = req.body;

    let addressItem = await Address.findById(req.params.id);

    if (!addressItem) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    // ensure user owns address
    if (addressItem.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this address",
      });
    }

    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    addressItem = await Address.findByIdAndUpdate(
      req.params.id,
      {
        type,
        street,
        city,
        state,
        zipCode,
        isDefault,
      },
      { new: true },
    );

    // await newAddress.save();
    res.status(201).json({ success: true, data: addressItem });
  } catch (error) {
    res.status(500).json({ message: "Error adding address" });
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

    // ensure user owns address
    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this address",
      });
    }

    await address.deleteOne();

    // await newAddress.save();
    res.json({ message: "address removed" }); 
  } catch (error) {
    res.status(500).json({ message: "Error adding address" });
  }
};

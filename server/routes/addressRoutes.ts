import express from "express";
import {
  addAddress,
  deleteAddress,
  getAddress,
  updateAddress,
} from "../controllers/addressController.js";
import { protect } from "../middleware/auth.js";

const AddressRouter = express.Router();

AddressRouter.get("/", protect, getAddress);
AddressRouter.post("/", protect, addAddress);
AddressRouter.put("/:id", protect, updateAddress);
AddressRouter.delete("/:id", protect, deleteAddress);

export default AddressRouter;
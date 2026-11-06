import express from "express";
import {
  addAddress,
  deleteAddress,
  getAddress,
  updateAddress,
} from "../controllers/addressController.js";
import { protect } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";

const AddressRouter = express.Router();

AddressRouter.use(protect);

AddressRouter.get("/", getAddress);
AddressRouter.post("/", addAddress);
AddressRouter.put("/:id", validateObjectId("id"), updateAddress);
AddressRouter.delete("/:id", validateObjectId("id"), deleteAddress);

export default AddressRouter;

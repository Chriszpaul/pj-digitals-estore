import express from "express";
import { protect, loadShop } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validate.js";
import upload from "../middleware/upload.js";
import {
  createPayoutRequest,
  exportShopSettlements,
  getShopPayouts,
  getShopSettlement,
  setShopPayoutAccount,
} from "../controllers/payoutController.js";
import {
  applyForShop,
  getMyShop,
  getShop,
  getShopOrders,
  getShopProducts,
  getShopSettlements,
  getShopStats,
  listShops,
  updateMyShop,
  updateShopOrderStatus,
  updateStock,
} from "../controllers/shopController.js";
import {
  createAd,
  deleteAd,
  getMyAds,
  updateAd,
} from "../controllers/adController.js";

// ---- Public shop directory + apply: mounted at /api/shops ----
export const ShopDirectoryRouter = express.Router();

ShopDirectoryRouter.get("/", listShops);
ShopDirectoryRouter.post("/apply", protect, upload.single("logo"), applyForShop);
ShopDirectoryRouter.get("/:id", validateObjectId("id"), getShop);

// ---- Shop-owner area: mounted at /api/shop ----
export const ShopOwnerRouter = express.Router();

ShopOwnerRouter.use(protect);

// profile (readable while still pending so the app can show the status)
ShopOwnerRouter.get("/me", loadShop(false), getMyShop);

// everything below needs an APPROVED shop
ShopOwnerRouter.put("/me", loadShop(true), upload.single("logo"), updateMyShop);

ShopOwnerRouter.get("/products", loadShop(true), getShopProducts);
ShopOwnerRouter.put("/products/:id/stock", loadShop(true), validateObjectId("id"), updateStock);

ShopOwnerRouter.get("/orders", loadShop(true), getShopOrders);
ShopOwnerRouter.put("/orders/:id/status", loadShop(true), validateObjectId("id"), updateShopOrderStatus);

ShopOwnerRouter.get("/stats", loadShop(true), getShopStats);
ShopOwnerRouter.get("/settlements/export.csv", loadShop(true), exportShopSettlements);
ShopOwnerRouter.get("/settlements", loadShop(true), getShopSettlements);
ShopOwnerRouter.get("/settlements/:id", loadShop(true), validateObjectId("id"), getShopSettlement);
ShopOwnerRouter.get("/payouts", loadShop(true), getShopPayouts);
ShopOwnerRouter.put("/payout-account", loadShop(true), setShopPayoutAccount);
ShopOwnerRouter.post("/payout-requests", loadShop(true), createPayoutRequest);

ShopOwnerRouter.get("/ads", loadShop(true), getMyAds);
ShopOwnerRouter.post("/ads", loadShop(true), upload.single("image"), createAd);
ShopOwnerRouter.put("/ads/:id", loadShop(true), validateObjectId("id"), upload.single("image"), updateAd);
ShopOwnerRouter.delete("/ads/:id", loadShop(true), validateObjectId("id"), deleteAd);

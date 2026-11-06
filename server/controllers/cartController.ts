import { Request, Response } from "express";
import Cart from "../models/Cart.js";
import Product from "../models/Products.js";
import { sendError } from "../utils/http.js";

const MAX_QTY = 99;
const POPULATE = "name images price stock sizes isActive";

const parseQty = (value: any, fallback = 1): number | null => {
  const q = value === undefined ? fallback : Number(value);
  return Number.isInteger(q) && q >= 0 && q <= MAX_QTY ? q : null;
};

const sameLine = (item: any, productId: string, size?: string) =>
  item.product.toString() === productId && (item.size || undefined) === (size || undefined);

const respond = async (res: Response, cart: any) => {
  await cart.populate("items.product", POPULATE);
  // `cart` kept for backwards compatibility, `data` matches the other endpoints
  res.json({ success: true, cart, data: cart });
};

// get user cart (also drops unavailable items and refreshes stale prices)
// GET /api/cart
export const getCart = async (req: Request, res: Response) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const products = await Product.find({
      _id: { $in: cart.items.map((i) => i.product) },
    }).select("price isActive");
    const byId = new Map(products.map((p) => [p._id.toString(), p]));

    let changed = false;
    const kept = cart.items.filter((item) => {
      const p = byId.get(item.product.toString());
      if (!p || !p.isActive) {
        changed = true;
        return false;
      }
      if (item.price !== p.price) {
        item.price = p.price;
        changed = true;
      }
      return true;
    });

    if (changed) {
      cart.items = kept as any;
      cart.calculateTotal();
      await cart.save();
    }

    await respond(res, cart);
  } catch (error) {
    sendError(res, error, "Failed to fetch cart");
  }
};

// add item to cart
// POST /api/cart/add
export const addToCart = async (req: Request, res: Response) => {
  try {
    const { productId, size } = req.body;
    const quantity = parseQty(req.body.quantity, 1);

    if (!quantity) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be a whole number between 1 and ${MAX_QTY}`,
      });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (product.sizes.length > 0 && !product.sizes.includes(size)) {
      return res
        .status(400)
        .json({ success: false, message: "Please choose a valid size" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const existing = cart.items.find((i) => sameLine(i, productId, size));
    const newQty = (existing?.quantity ?? 0) + quantity;

    // stock check includes what's already in the cart
    if (product.stock < newQty) {
      return res.status(400).json({
        success: false,
        message:
          product.stock === 0
            ? "Out of stock"
            : `Only ${product.stock} left in stock`,
      });
    }

    if (existing) {
      existing.quantity = newQty;
      existing.price = product.price;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        price: product.price,
        size,
      });
    }

    cart.calculateTotal();
    await cart.save();
    await respond(res, cart);
  } catch (error) {
    sendError(res, error, "Failed to add item to cart");
  }
};

// update cart item quantity (quantity 0 removes that line)
// PUT /api/cart/item/:productId   body: { quantity, size? }
export const updateCartItems = async (req: Request, res: Response) => {
  try {
    const { size } = req.body;
    const productId = req.params.productId as string;
    const quantity = parseQty(req.body.quantity, NaN);

    if (quantity === null) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be a whole number between 0 and ${MAX_QTY}`,
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((i) => sameLine(i, productId, size));
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not in cart" });
    }

    if (quantity === 0) {
      // only remove this size variant, not every size of the product
      cart.items = cart.items.filter((i) => !sameLine(i, productId, size)) as any;
    } else {
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res
          .status(404)
          .json({ success: false, message: "Product no longer available" });
      }
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} left in stock`,
        });
      }
      item.quantity = quantity;
      item.price = product.price;
    }

    cart.calculateTotal();
    await cart.save();
    await respond(res, cart);
  } catch (error) {
    sendError(res, error, "Failed to update cart");
  }
};

// remove item from cart
// DELETE /api/cart/item/:productId?size=XL   (size optional)
export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const size = req.query.size ? String(req.query.size) : undefined;
    const productId = req.params.productId as string;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (i) => !sameLine(i, productId, size),
    ) as any;

    cart.calculateTotal();
    await cart.save();
    await respond(res, cart);
  } catch (error) {
    sendError(res, error, "Failed to remove item");
  }
};

// clear cart
// DELETE /api/cart
export const clearCart = async (req: Request, res: Response) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();
    }
    // (previously this handler never sent a response and the request hung)
    res.json({ success: true, message: "Cart cleared", data: cart });
  } catch (error) {
    sendError(res, error, "Failed to clear cart");
  }
};

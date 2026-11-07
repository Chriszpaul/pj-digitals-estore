import Delivery from "../models/Delivery.js";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import { HttpError } from "./http.js";
import { notify } from "./notify.js";

const REASSIGNABLE = ["assigned", "accepted", "rejected", "failed", "cancelled"];

/**
 * Creates (or re-assigns) the delivery record linking order + shop + driver.
 * Used by the admin "assign delivery" endpoint.
 */
export const assignDelivery = async (
  orderId: any,
  driverId: any,
  assignedBy: any,
) => {
  const order: any = await Order.findById(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  if (["cancelled", "delivered"].includes(order.orderStatus)) {
    throw new HttpError(400, `Can't assign a ${order.orderStatus} order`);
  }

  const driver: any = await DeliveryPartner.findById(driverId);
  if (!driver) throw new HttpError(404, "Delivery partner not found");
  if (driver.status !== "approved") {
    throw new HttpError(400, `Delivery partner is ${driver.status}`);
  }

  const shop: any = order.shop ? await Shop.findById(order.shop) : null;

  let delivery: any = await Delivery.findOne({ order: order._id });
  if (delivery && !REASSIGNABLE.includes(delivery.status)) {
    throw new HttpError(400, `Delivery is already ${delivery.status}`);
  }

  const a = order.shippingAddress || {};
  const snapshot = {
    shop: order.shop,
    customer: order.user,
    driver: driver._id,
    status: "assigned",
    pickup: {
      name: shop?.name ?? "Store",
      phone: shop?.phone,
      address: [shop?.addressLine, shop?.landmark].filter(Boolean).join(", "),
      location: shop?.location,
      coordinates: shop?.coordinates,
    },
    drop: {
      fullName: a.fullName,
      phone: a.phone,
      street: a.street,
      city: a.city,
      state: a.state,
      zipCode: a.zipCode,
      location: a.location,
      landmark: a.landmark,
    },
    // cash the driver must collect on delivery
    codAmount:
      order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? order.totalAmount : 0,
    assignedBy,
    assignedAt: new Date(),
    acceptedAt: undefined,
    pickedUpAt: undefined,
    failureReason: undefined,
  };

  if (!delivery) {
    delivery = new Delivery({ order: order._id, ...snapshot, timeline: [] });
  } else {
    delivery.set(snapshot);
  }
  delivery.timeline.push({
    status: "assigned",
    at: new Date(),
    note: `Assigned to ${driver.fullName}`,
  });
  await delivery.save();

  await notify(driver.user, {
    type: "delivery",
    title: "New delivery assigned",
    body: `${snapshot.pickup.name} → ${a.fullName || "customer"} (${order.orderNumber})`,
    data: { deliveryId: delivery._id, orderId: order._id },
  });
  await notify(order.user, {
    type: "delivery",
    title: "Delivery partner assigned",
    body: `${driver.fullName} will deliver order ${order.orderNumber}`,
    data: { orderId: order._id },
  });

  return delivery;
};

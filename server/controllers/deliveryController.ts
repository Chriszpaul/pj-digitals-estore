import { Request, Response } from "express";
import DeliveryPartner from "../models/DeliveryPartner.js";
import Delivery from "../models/Delivery.js";
import Order from "../models/Order.js";
import Shop from "../models/Shop.js";
import { SERVICE_LOCATIONS, VEHICLE_TYPES } from "../types/index.js";
import { sendError } from "../utils/http.js";
import { destroyImages, uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { transitionOrder } from "../utils/orderHelpers.js";
import { getSettings } from "../utils/settings.js";

const ACTIVE = ["assigned", "accepted", "picked_up", "on_the_way"];

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

const PROFILE_FIELDS = ["fullName", "phone", "vehicleType", "vehicleNumber", "licenseNumber"] as const;

// POST /api/delivery/apply   (multipart; optional `photo`)
export const applyAsDriver = async (req: Request, res: Response) => {
  let photo: string | undefined;
  try {
    if (await DeliveryPartner.exists({ user: req.user._id })) {
      return res
        .status(409)
        .json({ success: false, message: "You have already applied as a delivery partner" });
    }
    const { fullName, phone, vehicleType } = req.body;
    if (!fullName?.trim() || !phone?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "fullName and phone are required" });
    }
    if (vehicleType && !(VEHICLE_TYPES as readonly string[]).includes(vehicleType)) {
      return res
        .status(400)
        .json({ success: false, message: `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}` });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (file) photo = (await uploadToCloudinary(file, "pj-digitals-estore/drivers")).secure_url;

    const data: Record<string, any> = {};
    for (const f of PROFILE_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];

    const partner = await DeliveryPartner.create({
      ...data,
      user: req.user._id,
      serviceLocations: parseLocations(req.body.serviceLocations),
      photo,
      status: "pending",
    });

    await notifyAdmins({
      type: "delivery",
      title: "New delivery-partner application",
      body: partner.fullName,
      data: { partnerId: partner._id },
    });

    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    if (photo) await destroyImages([photo]);
    sendError(res, error, "Failed to submit application");
  }
};

// GET /api/delivery/me   (works while pending so the app can show the status)
export const getMyProfile = async (req: Request, res: Response) => {
  res.json({ success: true, data: req.driver });
};

// PUT /api/delivery/me
export const updateMyProfile = async (req: Request, res: Response) => {
  let newPhoto: string | undefined;
  try {
    const driver = req.driver;
    for (const f of PROFILE_FIELDS) if (req.body[f] !== undefined) driver.set(f, req.body[f]);
    if (req.body.serviceLocations !== undefined) {
      driver.serviceLocations = parseLocations(req.body.serviceLocations);
    }
    const file = req.file as Express.Multer.File | undefined;
    const oldPhoto = driver.photo;
    if (file) {
      newPhoto = (await uploadToCloudinary(file, "pj-digitals-estore/drivers")).secure_url;
      driver.photo = newPhoto;
    }
    await driver.save();
    if (newPhoto && oldPhoto) await destroyImages([oldPhoto]);
    res.json({ success: true, data: driver });
  } catch (error) {
    if (newPhoto) await destroyImages([newPhoto]);
    sendError(res, error, "Failed to update profile");
  }
};

// PUT /api/delivery/availability   body: { isAvailable: boolean }
export const setAvailability = async (req: Request, res: Response) => {
  try {
    const v = req.body.isAvailable;
    if (typeof v !== "boolean" && v !== "true" && v !== "false") {
      return res
        .status(400)
        .json({ success: false, message: "isAvailable must be true or false" });
    }
    req.driver.isAvailable = v === true || v === "true";
    await req.driver.save();
    res.json({ success: true, data: { isAvailable: req.driver.isAvailable } });
  } catch (error) {
    sendError(res, error, "Failed to update availability");
  }
};

// PUT /api/delivery/location   body: { lat, lng }   (live location, optional feature)
export const updateLocation = async (req: Request, res: Response) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, message: "Valid lat and lng are required" });
    }
    req.driver.currentLocation = { lat, lng, updatedAt: new Date() };
    await req.driver.save();
    res.json({ success: true, data: req.driver.currentLocation });
  } catch (error) {
    sendError(res, error, "Failed to update location");
  }
};

const JOB_POPULATE = {
  path: "order",
  select: "orderNumber items totalAmount paymentMethod paymentStatus orderStatus notes",
};

// GET /api/delivery/jobs?scope=active|all   (default active)
export const getJobs = async (req: Request, res: Response) => {
  try {
    const query: any = { driver: req.driver._id };
    if (req.query.scope !== "all") query.status = { $in: ACTIVE };
    const jobs = await Delivery.find(query).populate(JOB_POPULATE).sort("-assignedAt");
    res.json({ success: true, data: jobs });
  } catch (error) {
    sendError(res, error, "Failed to fetch jobs");
  }
};

// GET /api/delivery/jobs/:id
export const getJob = async (req: Request, res: Response) => {
  try {
    const job = await Delivery.findOne({ _id: req.params.id, driver: req.driver._id }).populate(
      JOB_POPULATE,
    );
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    sendError(res, error, "Failed to fetch job");
  }
};

// GET /api/delivery/history?page=&limit=
export const getHistory = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query = { driver: req.driver._id, status: { $in: ["delivered", "failed", "rejected", "cancelled"] } };

    const [total, jobs] = await Promise.all([
      Delivery.countDocuments(query),
      Delivery.find(query)
        .populate(JOB_POPULATE)
        .sort("-updatedAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: jobs,
      completedDeliveries: req.driver.completedDeliveries,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch history");
  }
};

// What a driver may do next from each state
const DRIVER_FLOW: Record<string, string[]> = {
  assigned: ["accepted", "rejected"],
  accepted: ["picked_up", "failed"],
  picked_up: ["on_the_way", "delivered", "failed"],
  on_the_way: ["delivered", "failed"],
};

// PUT /api/delivery/jobs/:id/status   body: { status, note? }
//   assigned -> accepted | rejected;  accepted -> picked_up;
//   picked_up -> on_the_way | delivered;  any active -> failed (note required)
export const updateJobStatus = async (req: Request, res: Response) => {
  try {
    const { status, note } = req.body;
    const job: any = await Delivery.findOne({ _id: req.params.id, driver: req.driver._id });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const allowed = DRIVER_FLOW[job.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: allowed.length
          ? `From "${job.status}" you can only move to: ${allowed.join(", ")}`
          : `This job is already ${job.status}`,
      });
    }
    if ((status === "failed" || status === "rejected") && !note?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please give a reason in `note`" });
    }

    const order: any = await Order.findById(job.order);
    if (!order || order.orderStatus === "cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "This order has been cancelled" });
    }

    const now = new Date();
    job.status = status;
    job.timeline.push({ status, at: now, note });

    const shop: any = job.shop ? await Shop.findById(job.shop).select("owner name") : null;
    const orderRef = { orderId: order._id, deliveryId: job._id };

    if (status === "accepted") {
      job.acceptedAt = now;
    } else if (status === "rejected") {
      job.failureReason = note;
      await notifyAdmins({
        type: "delivery",
        title: "Delivery rejected by driver",
        body: `${order.orderNumber}: ${note}`,
        data: orderRef,
      });
    } else if (status === "picked_up") {
      job.pickedUpAt = now;
      if (["placed", "processing"].includes(order.orderStatus)) {
        await transitionOrder(order, "shipping", "system");
      }
      await notify(order.user, {
        type: "delivery",
        title: "Your order is on its way",
        body: `${order.orderNumber} has been picked up`,
        data: orderRef,
      });
    } else if (status === "on_the_way") {
      await notify(order.user, {
        type: "delivery",
        title: "Delivery partner is nearby",
        body: `${order.orderNumber} is on the way`,
        data: orderRef,
      });
    } else if (status === "delivered") {
      job.deliveredAt = now;
      job.driverFee = (await getSettings()).driverFee; // locked in at delivery time
      await transitionOrder(order, "delivered", "system"); // also marks COD as paid
      req.driver.completedDeliveries = (req.driver.completedDeliveries || 0) + 1;
      await req.driver.save();
      await notify(order.user, {
        type: "delivery",
        title: "Order delivered",
        body: `${order.orderNumber} has been delivered`,
        data: orderRef,
      });
      if (shop) {
        await notify(shop.owner, {
          type: "delivery",
          title: "Order delivered",
          body: order.orderNumber,
          data: orderRef,
        });
      }
    } else if (status === "failed") {
      job.failureReason = note;
      await notifyAdmins({
        type: "delivery",
        title: "Delivery failed",
        body: `${order.orderNumber}: ${note}`,
        data: orderRef,
      });
      await notify(order.user, {
        type: "delivery",
        title: "Delivery attempt failed",
        body: `${order.orderNumber}: ${note}`,
        data: orderRef,
      });
    }

    await job.save();
    res.json({ success: true, data: job });
  } catch (error) {
    sendError(res, error, "Failed to update delivery");
  }
};

// GET /api/orders/:id/tracking  (customer) -> delivery status + driver location
export const getOrderTracking = async (req: Request, res: Response) => {
  try {
    const order: any = await Order.findOne({ _id: req.params.id, user: req.user._id }).select(
      "_id orderStatus",
    );
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const delivery: any = await Delivery.findOne({ order: order._id })
      .select("status timeline pickup drop pickedUpAt deliveredAt driver")
      .populate("driver", "fullName phone vehicleType vehicleNumber currentLocation");

    res.json({
      success: true,
      data: {
        orderStatus: order.orderStatus,
        delivery: delivery
          ? {
              status: delivery.status,
              timeline: delivery.timeline,
              driver: delivery.driver,
              // live location only while the order is actually in transit
              driverLocation: ["picked_up", "on_the_way"].includes(delivery.status)
                ? delivery.driver?.currentLocation
                : undefined,
            }
          : null,
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch tracking");
  }
};

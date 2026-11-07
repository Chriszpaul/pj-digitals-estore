import { Request, Response } from "express";
import Ticket from "../models/Ticket.js";
import Order from "../models/Order.js";
import { TICKET_CATEGORIES, TICKET_STATUSES } from "../types/index.js";
import { sendError } from "../utils/http.js";
import { notify, notifyAdmins } from "../utils/notify.js";
import { logActivity } from "../utils/activity.js";

// ---- any signed-in user (customer, shop owner, driver) ----

// POST /api/support   body: { subject, message, category?, orderId? }
export const createTicket = async (req: Request, res: Response) => {
  try {
    const { subject, message, category, orderId } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "subject and message are required" });
    }
    if (category && !(TICKET_CATEGORIES as readonly string[]).includes(category)) {
      return res
        .status(400)
        .json({ success: false, message: `category must be one of: ${TICKET_CATEGORIES.join(", ")}` });
    }

    let order: any;
    if (orderId) {
      order = await Order.findOne({ _id: orderId, user: req.user._id });
      if (!order) {
        return res.status(400).json({ success: false, message: "Order not found" });
      }
    }

    const ticket = await Ticket.create({
      user: req.user._id,
      userRole: req.user.role,
      subject: subject.trim(),
      category,
      order: order?._id,
      messages: [{ sender: req.user._id, senderRole: req.user.role, body: message.trim() }],
    });

    await notifyAdmins({
      type: "support",
      title: "New support ticket",
      body: ticket.subject,
      data: { ticketId: ticket._id },
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    sendError(res, error, "Failed to create ticket");
  }
};

// GET /api/support
export const getMyTickets = async (req: Request, res: Response) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id })
      .select("-messages")
      .sort("-updatedAt");
    res.json({ success: true, data: tickets });
  } catch (error) {
    sendError(res, error, "Failed to fetch tickets");
  }
};

// GET /api/support/:id  (owner or admin)
export const getTicket = async (req: Request, res: Response) => {
  try {
    const ticket: any = await Ticket.findById(req.params.id)
      .populate("user", "name email role")
      .populate("messages.sender", "name role");
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    const ownerId = ticket.user?._id ?? ticket.user;
    if (ownerId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    sendError(res, error, "Failed to fetch ticket");
  }
};

// POST /api/support/:id/messages   body: { message }  (owner or admin)
export const replyToTicket = async (req: Request, res: Response) => {
  try {
    const body = String(req.body.message ?? "").trim();
    if (!body) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const ticket: any = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    const isAdmin = req.user.role === "admin";
    if (ticket.user.toString() !== req.user._id.toString() && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    if (ticket.status === "closed") {
      return res.status(400).json({ success: false, message: "Ticket is closed" });
    }

    ticket.messages.push({ sender: req.user._id, senderRole: req.user.role, body });
    if (isAdmin && ticket.status === "open") ticket.status = "in_progress";
    // a customer replying to a resolved ticket re-opens it
    if (!isAdmin && ticket.status === "resolved") ticket.status = "open";
    await ticket.save();

    if (isAdmin) {
      await notify(ticket.user, {
        type: "support",
        title: "Support replied to your ticket",
        body: ticket.subject,
        data: { ticketId: ticket._id },
      });
      await logActivity(req, "ticket.replied", "Ticket", ticket._id);
    } else {
      await notifyAdmins({
        type: "support",
        title: "New reply on a ticket",
        body: ticket.subject,
        data: { ticketId: ticket._id },
      });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    sendError(res, error, "Failed to reply");
  }
};

// ---- admin ----

// GET /api/admin/tickets?status=&category=&page=&limit=
export const adminListTickets = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: any = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.category) query.category = String(req.query.category);

    const [total, tickets] = await Promise.all([
      Ticket.countDocuments(query),
      Ticket.find(query)
        .select("-messages")
        .populate("user", "name email role")
        .sort("-updatedAt")
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch tickets");
  }
};

// PUT /api/admin/tickets/:id   body: { status?, assignedTo? }
export const adminUpdateTicket = async (req: Request, res: Response) => {
  try {
    const { status, assignedTo } = req.body;
    if (status && !(TICKET_STATUSES as readonly string[]).includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: `status must be one of: ${TICKET_STATUSES.join(", ")}` });
    }
    const ticket: any = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    if (status) {
      ticket.status = status;
      if (status === "resolved") ticket.resolvedAt = new Date();
    }
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo || undefined;
    await ticket.save();

    if (status) {
      await notify(ticket.user, {
        type: "support",
        title: `Your ticket is ${status.replace("_", " ")}`,
        body: ticket.subject,
        data: { ticketId: ticket._id },
      });
    }
    await logActivity(req, "ticket.updated", "Ticket", ticket._id, { status, assignedTo });
    res.json({ success: true, data: ticket });
  } catch (error) {
    sendError(res, error, "Failed to update ticket");
  }
};

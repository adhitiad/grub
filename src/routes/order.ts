import { Router } from "express";
import {
  cancelOrder,
  createOrder,
  getOrderById,
  searchOrders,
  updateOrderStatus,
} from "../controllers/order.controller";
import { protect } from "../middleware/auth";

const router = Router();

// Semua user yang login bisa membuat order
router.post("/", protect, createOrder);

// Search orders (customers see only their orders, staff/admin see all)
router.get("/search", protect, searchOrders);

// Get order by ID
router.get("/:id", protect, getOrderById);

// Update order status - accessible by admin, owner, staff
router.put("/:id/status", protect, updateOrderStatus);

// Cancel order - accessible by admin, owner, staff, customer (own orders only)
router.put("/:id/cancel", protect, cancelOrder);

export default router;

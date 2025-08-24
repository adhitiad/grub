import { Router } from "express";
import {
  createOrder,
  getOrderById,
  searchOrders,
} from "../controllers/order.controller";
import { protect } from "../middleware/auth";

const router = Router();

// Semua user yang login bisa membuat order
router.post("/", protect, createOrder);

// Search orders (customers see only their orders, staff/admin see all)
router.get("/search", protect, searchOrders);

// Get order by ID
router.get("/:id", protect, getOrderById);

export default router;

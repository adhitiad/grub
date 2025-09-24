// Analytics Routes
import { Router } from "express";
import {
  getDashboardStats,
  getSalesAnalytics,
  getInventoryAnalytics,
} from "../controllers/analytics.controller";
import { authorize, protect } from "../middleware/auth";

const router = Router();

// Dashboard statistics - accessible by admin, owner, staff, sales
router.get(
  "/dashboard",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  getDashboardStats
);

// Sales analytics - accessible by admin, owner, staff, sales
router.get(
  "/sales",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  getSalesAnalytics
);

// Inventory analytics - accessible by admin, owner, staff
router.get(
  "/inventory",
  protect,
  authorize("admin", "owner", "staff"),
  getInventoryAnalytics
);

export default router;

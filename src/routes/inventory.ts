// Inventory Management Routes
import { Router } from "express";
import {
  getInventoryAlerts,
  updateInventoryThresholds,
  acknowledgeAlert,
  getInventoryForecast,
} from "../controllers/inventory.controller";
import { protect, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/enhancedValidation";
import { z } from "zod";

const router = Router();

// Validation schemas
const updateThresholdsSchema = z.object({
  body: z.object({
    minThreshold: z.number().min(0, "Minimum threshold must be non-negative"),
    maxThreshold: z.number().min(0, "Maximum threshold must be non-negative").optional(),
    reorderPoint: z.number().min(0, "Reorder point must be non-negative").optional(),
    reorderQuantity: z.number().min(1, "Reorder quantity must be positive").optional(),
  }),
  params: z.object({
    productId: z.string().min(1, "Product ID is required"),
  }),
});

const acknowledgeAlertSchema = z.object({
  body: z.object({
    notes: z.string().optional(),
  }),
  params: z.object({
    alertId: z.string().min(1, "Alert ID is required"),
  }),
});

const alertsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['active', 'acknowledged', 'resolved', 'all']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    productId: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    sortBy: z.enum(['createdAt', 'severity', 'productName']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

const forecastQuerySchema = z.object({
  query: z.object({
    productId: z.string().optional(),
    days: z.string().regex(/^\d+$/).optional(),
  }),
});

// Get inventory alerts with filtering and pagination
// GET /api/inventory/alerts
router.get(
  "/alerts",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(alertsQuerySchema),
  getInventoryAlerts
);

// Update inventory thresholds for a product
// PUT /api/inventory/thresholds/:productId
router.put(
  "/thresholds/:productId",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(updateThresholdsSchema),
  updateInventoryThresholds
);

// Acknowledge an inventory alert
// PUT /api/inventory/alerts/:alertId/acknowledge
router.put(
  "/alerts/:alertId/acknowledge",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(acknowledgeAlertSchema),
  acknowledgeAlert
);

// Get inventory forecasting data
// GET /api/inventory/forecast
router.get(
  "/forecast",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(forecastQuerySchema),
  getInventoryForecast
);

export default router;

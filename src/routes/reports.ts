// Advanced Reports Routes
import { Router } from "express";
import {
  generateSalesReport,
  generateCustomerAnalytics,
  generateInventoryTurnoverReport,
} from "../controllers/reports.controller";
import { protect, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/enhancedValidation";
import { z } from "zod";

const router = Router();

// Validation schemas
const reportsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    groupBy: z.enum(['day', 'week', 'month']).optional(),
    productIds: z.union([z.string(), z.array(z.string())]).optional(),
    categoryIds: z.union([z.string(), z.array(z.string())]).optional(),
    format: z.enum(['json', 'pdf', 'excel']).optional(),
  }),
});

const customerAnalyticsSchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    segmentBy: z.enum(['value', 'frequency', 'recency']).optional(),
    format: z.enum(['json', 'excel']).optional(),
  }),
});

const inventoryTurnoverSchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    categoryIds: z.union([z.string(), z.array(z.string())]).optional(),
    format: z.enum(['json', 'excel']).optional(),
  }),
});

// Generate comprehensive sales report
// GET /api/reports/sales
router.get(
  "/sales",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(reportsQuerySchema),
  generateSalesReport
);

// Generate customer analytics report
// GET /api/reports/customers
router.get(
  "/customers",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(customerAnalyticsSchema),
  generateCustomerAnalytics
);

// Generate inventory turnover report
// GET /api/reports/inventory-turnover
router.get(
  "/inventory-turnover",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(inventoryTurnoverSchema),
  generateInventoryTurnoverReport
);

export default router;

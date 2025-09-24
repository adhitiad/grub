// Enhanced Search & Filtering Routes
import { Router } from "express";
import {
  searchProducts,
  getSearchSuggestions,
  saveSearch,
  getSavedSearches,
  getSearchHistory,
} from "../controllers/search.controller";
import { protect, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/enhancedValidation";
import { z } from "zod";

const router = Router();

// Validation schemas
const searchProductsSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    priceMin: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    priceMax: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    availability: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'all']).optional(),
    stores: z.union([z.string(), z.array(z.string())]).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest', 'popularity', 'rating']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    latitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    longitude: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    radius: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  }),
});

const searchSuggestionsSchema = z.object({
  query: z.object({
    q: z.string().min(2, "Query must be at least 2 characters long"),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

const saveSearchSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Search name is required"),
    filters: z.object({
      query: z.string().optional(),
      categoryIds: z.array(z.string()).optional(),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      availability: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'all']).optional(),
      storeIds: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest', 'popularity', 'rating']).optional(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        radius: z.number(),
      }).optional(),
    }),
    notifyOnNewResults: z.boolean().optional(),
  }),
});

const searchHistorySchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

// Advanced product search with full-text search and filtering
// GET /api/search/products
router.get(
  "/products",
  validateRequest(searchProductsSchema),
  searchProducts
);

// Get search suggestions and autocomplete
// GET /api/search/suggestions
router.get(
  "/suggestions",
  validateRequest(searchSuggestionsSchema),
  getSearchSuggestions
);

// Save search for later
// POST /api/search/saved
router.post(
  "/saved",
  protect,
  validateRequest(saveSearchSchema),
  saveSearch
);

// Get user's saved searches
// GET /api/search/saved
router.get(
  "/saved",
  protect,
  getSavedSearches
);

// Get search history
// GET /api/search/history
router.get(
  "/history",
  protect,
  validateRequest(searchHistorySchema),
  getSearchHistory
);

export default router;

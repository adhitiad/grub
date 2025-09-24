// Product Image Upload Routes
import { Router } from "express";
import {
  upload,
  uploadProductImages,
  getProductImages,
  updateImageMetadata,
  deleteProductImage,
} from "../controllers/imageUpload.controller";
import { protect, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/enhancedValidation";
import { z } from "zod";

const router = Router();

// Validation schemas
const uploadImagesSchema = z.object({
  params: z.object({
    productId: z.string().min(1, "Product ID is required"),
  }),
});

const getImagesSchema = z.object({
  params: z.object({
    productId: z.string().min(1, "Product ID is required"),
  }),
  query: z.object({
    includeThumbnails: z.enum(['true', 'false']).optional(),
  }),
});

const updateImageMetadataSchema = z.object({
  params: z.object({
    imageId: z.string().min(1, "Image ID is required"),
  }),
  body: z.object({
    alt: z.string().optional(),
    caption: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isPrimary: z.boolean().optional(),
  }),
});

const deleteImageSchema = z.object({
  params: z.object({
    imageId: z.string().min(1, "Image ID is required"),
  }),
});

// Upload product images
// POST /api/images/products/:productId/upload
router.post(
  "/products/:productId/upload",
  protect,
  authorize("admin", "owner", "staff"),
  upload.array('images', 5), // Max 5 images
  validateRequest(uploadImagesSchema),
  uploadProductImages
);

// Get product images
// GET /api/images/products/:productId
router.get(
  "/products/:productId",
  validateRequest(getImagesSchema),
  getProductImages
);

// Update image metadata
// PUT /api/images/:imageId/metadata
router.put(
  "/:imageId/metadata",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(updateImageMetadataSchema),
  updateImageMetadata
);

// Delete product image
// DELETE /api/images/:imageId
router.delete(
  "/:imageId",
  protect,
  authorize("admin", "owner", "staff"),
  validateRequest(deleteImageSchema),
  deleteProductImage
);

export default router;

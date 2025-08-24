import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategoryId,
  searchProducts,
  updateProduct,
} from "../controllers/product.controller";
import { authorize, protect } from "../middleware/auth";

const router = Router();

// Siapa saja yang login bisa lihat semua produk
router.get("/", protect, getAllProducts);

// Search products
router.get("/search", protect, searchProducts);

// Hanya admin, owner, atau staff yang bisa membuat produk
router.post("/", protect, authorize("admin", "owner"), createProduct);
router.get("/category/:categoryId", protect, getProductsByCategoryId);
router.put(
  "/:id",
  protect,
  authorize("admin", "owner", "staff"),
  updateProduct
);
router.delete("/:id", protect, authorize("admin", "owner"), deleteProduct);

export default router;

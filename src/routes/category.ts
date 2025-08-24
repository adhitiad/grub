import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  searchCategories,
  updateCategory,
} from "../controllers/category.controller";
import { authorize, protect } from "../middleware/auth";

const router = Router();

// Siapa saja yang sudah login bisa melihat semua kategori
router.get("/", protect, getAllCategories);

// Search categories
router.get("/search", protect, searchCategories);

// Hanya admin atau owner yang bisa membuat kategori baru
router.post("/", protect, authorize("admin", "owner", "staff"), createCategory);

// Hanya admin atau owner yang bisa mengubah kategori
router.put("/:id", protect, authorize("admin", "owner"), updateCategory);

// Hanya admin atau owner yang bisa menghapus kategori
router.delete("/:id", protect, authorize("admin", "owner"), deleteCategory);

// Hanya admin atau owner yang bisa melihat detail kategori
router.get("/:id", protect, authorize("admin", "owner"), getCategoryById);

export default router;

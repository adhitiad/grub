// src/api/stores/store.routes.ts
import { Router } from "express";
import {
  createStore,
  deleteStore,
  getAllStores,
  getStoreById,
  searchStores,
  updateStore,
  updateStoreStatus,
} from "../controllers/store.controller";
import { authorize, protect } from "../middleware/auth";

const router = Router();

// Semua pengguna yang login bisa melihat daftar toko (logika filter ada di controller)
router.get("/", protect, getAllStores);

// Search stores
router.get("/search", protect, searchStores);

router.get("/:id", protect, getStoreById);

// SEKARANG SALES JUGA BISA MEMBUAT TOKO
router.post("/", protect, authorize("admin", "owner", "sales"), createStore);

// ENDPOINT BARU KHUSUS UNTUK APPROVAL OLEH ADMIN/OWNER
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "owner"),
  updateStoreStatus
);

router.put("/:id", protect, authorize("admin", "owner"), updateStore);
router.delete("/:id", protect, authorize("admin", "owner"), deleteStore);

export default router;

import { Router } from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  searchUsers,
  updateUser,
} from "../controllers/user.controller";
import { authorize, protect } from "../middleware/auth";

const router = Router();

// Semua rute di sini hanya untuk admin dan owner
router.post("/", protect, authorize("admin", "owner"), createUser);
router.put("/:id", protect, authorize("admin", "owner"), updateUser);
router.delete("/:id", protect, authorize("admin", "owner"), deleteUser);
router.get("/search", protect, authorize("admin", "owner"), searchUsers);
router.get("/", getAllUsers);
router.get("/:id", getUserById);

// (Anda bisa menambahkan rute PATCH untuk update role, atau DELETE untuk hapus user)

export default router;

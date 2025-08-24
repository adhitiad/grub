import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { getMe } from "../controllers/user.controller"; // <-- Impor getMe
import { protect } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Rute baru untuk mendapatkan profil user yang sedang login
router.get("/me", protect, getMe); // <-- Tambahkan ini

export default router;

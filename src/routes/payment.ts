import { Router } from "express";
import { handleFlipWebhook } from "../controllers/payment.controller";

const router = Router();

// Endpoint ini HARUS publik, tanpa 'protect' middleware.
// Keamanan ditangani oleh verifikasi signature.
router.post("/flip-webhook", handleFlipWebhook);

export default router;

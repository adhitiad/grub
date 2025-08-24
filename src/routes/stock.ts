import { Router } from "express";
import {
  adjustStock,
  deleteStockMovement,
  getAllStock,
  getStockByProduct,
  getStockMovements,
  getStockMovementsByProduct,
  searchStock,
  searchStockMovements,
} from "../controllers/stock.controller";
import { authorize, protect } from "../middleware/auth";

const router = Router();

router.post("/", protect, authorize("admin", "owner", "staff"), adjustStock);

// Search stock inventory
router.get(
  "/search",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  searchStock
);

router.get(
  "/product/:productId",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  getStockByProduct
);
router.get(
  "/",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  getAllStock
);
router.get(
  "/movements",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  getStockMovements
);

// Search stock movements
router.get(
  "/movements/search",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  searchStockMovements
);

router.get(
  "/movements/:productId",
  protect,
  authorize("admin", "owner", "staff", "sales"),
  getStockMovementsByProduct
);
router.delete(
  "/movements/:id",
  protect,
  authorize("admin", "owner"),
  deleteStockMovement
);

export default router;

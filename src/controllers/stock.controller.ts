import { Request, Response } from "express";
import { StockInventory, StockMovement } from "../models/stock";
import { User } from "../models/user.model";
import { db } from "../utils/firebase";

const inventoryCollection = db.collection("stock_inventory");
const movementsCollection = db.collection("stock_movements");
const usersCollection = db.collection("users");

// Fungsi utama untuk menambah atau mengurangi stok
export const adjustStock = async (req: Request, res: Response) => {
  try {
    const {
      productId,
      warehouseId,
      quantityChange,
      type,
      notes,
      productName,
      sku,
      warehouseName,
      status,
    } = req.body;
    const userId = req.user!.id; // Ambil ID user dari middleware 'protect'
    // Ambil detail nama user dari database
    const userDoc = await usersCollection.doc(userId).get();
    const userData = userDoc.data() as User;

    const loggedInUser = req.user!;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }

    // Validasi
    if (
      !productId ||
      !warehouseId ||
      !quantityChange ||
      !type ||
      !productName ||
      !warehouseName
    ) {
      return res.status(400).send({ message: "Input tidak lengkap." });
    }

    const change = Number(quantityChange);

    // ID unik untuk dokumen inventaris
    const inventoryId = `${productId}_${warehouseId}`;
    const inventoryRef = inventoryCollection.doc(inventoryId);

    // Gunakan Transaksi Firestore untuk menjaga konsistensi data
    await db.runTransaction(async (transaction) => {
      const inventoryDoc = await transaction.get(inventoryRef);
      let currentQuantity = 0;

      if (inventoryDoc.exists) {
        currentQuantity = inventoryDoc.data()!.quantity;
      }

      const newQuantity = currentQuantity + change;
      if (newQuantity < 0) {
        throw new Error("Stok tidak mencukupi.");
      }

      let initialStatus: "pending" | "approved" = "pending";
      if (loggedInUser.role === "admin" || loggedInUser.role === "owner") {
        initialStatus = "approved";
      }
      if (status) {
        initialStatus = status;
      }

      // Data untuk dokumen inventaris
      const inventoryData: StockInventory = {
        productId,
        productName, // Sebaiknya ambil dari db produk
        sku, // Sebaiknya ambil dari db produk
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        warehouseId,
        warehouseName, // Sebaiknya ambil dari db warehouse
        quantity: newQuantity,
        status: initialStatus, // Status dinamis
        submittedBy: {
          id: userId,
          name: userData.name || "N/A",
        },
        approvedBy: {
          id: loggedInUser.id,
          name: userData.name || "N/A",
        },
        approvedAt: new Date(),
      };

      // 1. Update atau buat dokumen inventaris
      transaction.set(inventoryRef, inventoryData, { merge: true });

      // 2. Buat dokumen riwayat pergerakan stok
      const movementRef = movementsCollection.doc();
      const movementData: StockMovement = {
        id: movementRef.id,
        productId,
        warehouseId,
        type,
        quantityChange: change,
        notes,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: initialStatus, // Status dinamis
        submittedBy: {
          id: userId,
          name: userData.name || "N/A",
        },
        approvedBy: {
          id: loggedInUser.id,
          name: userData.name || "N/A",
        },
        approvedAt: new Date(),
      };
      transaction.set(movementRef, movementData);
    });

    res.status(200).send({ message: "Stok berhasil diperbarui." });
  } catch (error: any) {
    res.status(500).send({ message: error.message || "Error server" });
  }
};

// Fungsi untuk melihat stok sebuah produk di semua gudang
export const getStockByProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const loggedInUser = req.user!;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    const snapshot = await inventoryCollection
      .where("productId", "==", productId)
      .get();
    const stock = snapshot.docs.map((doc) => doc.data());
    res.status(200).send(stock);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Fungsi untuk melihat stok di semua gudang untuk semua produk
export const getAllStock = async (_req: Request, res: Response) => {
  try {
    const snapshot = await inventoryCollection.get();
    const stock = snapshot.docs.map((doc) => doc.data());
    res.status(200).send(stock);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Search stock inventory
export const searchStock = async (req: Request, res: Response) => {
  try {
    const {
      q,
      productId,
      warehouseId,
      minQuantity,
      maxQuantity,
      lowStock,
      limit = 20,
      offset = 0,
    } = req.query;

    let query: FirebaseFirestore.Query = inventoryCollection;

    // Filter by product ID
    if (productId && typeof productId === "string") {
      query = query.where("productId", "==", productId);
    }

    // Filter by warehouse ID
    if (warehouseId && typeof warehouseId === "string") {
      query = query.where("warehouseId", "==", warehouseId);
    }

    // Filter for low stock items
    if (lowStock === "true") {
      query = query.where("quantity", "<=", 10); // Consider items with 10 or less as low stock
    }

    // Apply pagination
    query = query.limit(parseInt(limit as string));
    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    const snapshot = await query.get();
    let stockItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Client-side filtering for quantity range and text search
    if (minQuantity || maxQuantity) {
      stockItems = stockItems.filter((item: any) => {
        const quantity = item.quantity || 0;
        const min = minQuantity ? parseInt(minQuantity as string) : 0;
        const max = maxQuantity ? parseInt(maxQuantity as string) : Infinity;
        return quantity >= min && quantity <= max;
      });
    }

    // Text search in product name, SKU, or warehouse name
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      stockItems = stockItems.filter(
        (item: any) =>
          item.productName?.toLowerCase().includes(searchTerm) ||
          item.sku?.toLowerCase().includes(searchTerm) ||
          item.warehouseName?.toLowerCase().includes(searchTerm) ||
          item.productId?.toLowerCase().includes(searchTerm)
      );
    }

    res.status(200).json({
      success: true,
      message: "Pencarian stok berhasil",
      data: stockItems,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: stockItems.length,
      },
      filters: {
        searchTerm: q,
        productId,
        warehouseId,
        minQuantity,
        maxQuantity,
        lowStock,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari stok",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Fungsi untuk melihat riwayat pergerakan stok
export const getStockMovements = async (_req: Request, res: Response) => {
  try {
    const snapshot = await movementsCollection
      .orderBy("timestamp", "desc")
      .get();
    const movements = snapshot.docs.map((doc) => doc.data());
    res.status(200).send(movements);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Search stock movements
export const searchStockMovements = async (req: Request, res: Response) => {
  try {
    const {
      q,
      productId,
      warehouseId,
      type,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
    } = req.query;

    let query: FirebaseFirestore.Query = movementsCollection;

    // Filter by product ID
    if (productId && typeof productId === "string") {
      query = query.where("productId", "==", productId);
    }

    // Filter by warehouse ID
    if (warehouseId && typeof warehouseId === "string") {
      query = query.where("warehouseId", "==", warehouseId);
    }

    // Filter by movement type
    if (type && typeof type === "string") {
      const validTypes = [
        "initial",
        "purchase",
        "sale",
        "transfer",
        "adjustment",
      ];
      if (validTypes.includes(type)) {
        query = query.where("type", "==", type);
      }
    }

    // Apply pagination and ordering
    query = query.orderBy("timestamp", "desc").limit(parseInt(limit as string));

    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    const snapshot = await query.get();
    let movements = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Client-side filtering for date range
    if (dateFrom || dateTo) {
      movements = movements.filter((movement: any) => {
        const movementDate = movement.timestamp?.toDate
          ? movement.timestamp.toDate()
          : new Date(movement.timestamp);
        const from = dateFrom
          ? new Date(dateFrom as string)
          : new Date("1970-01-01");
        const to = dateTo ? new Date(dateTo as string) : new Date();
        return movementDate >= from && movementDate <= to;
      });
    }

    // Text search in product name, notes, or related order ID
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      movements = movements.filter(
        (movement: any) =>
          movement.productName?.toLowerCase().includes(searchTerm) ||
          movement.notes?.toLowerCase().includes(searchTerm) ||
          movement.relatedOrderId?.toLowerCase().includes(searchTerm) ||
          movement.warehouseName?.toLowerCase().includes(searchTerm)
      );
    }

    res.status(200).json({
      success: true,
      message: "Pencarian pergerakan stok berhasil",
      data: movements,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: movements.length,
      },
      filters: {
        searchTerm: q,
        productId,
        warehouseId,
        type,
        dateFrom,
        dateTo,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search stock movements error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari pergerakan stok",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Fungsi untuk melihat riwayat pergerakan stok berdasarkan ID produk
export const getStockMovementsByProduct = async (
  req: Request,
  res: Response
) => {
  try {
    const { productId } = req.params;

    const loggedInUser = req.user!;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    const snapshot = await movementsCollection
      .where("productId", "==", productId)
      .get();
    const movements = snapshot.docs.map((doc) => doc.data());
    res.status(200).send(movements);
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

// Fungsi untuk menghapus riwayat pergerakan stok
export const deleteStockMovement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user!;
    if (!loggedInUser) {
      return res.status(401).send({ message: "Akses ditolak." });
    }
    if (loggedInUser.role !== "admin" && loggedInUser.role !== "owner") {
      return res.status(403).send({ message: "Akses ditolak." });
    }
    await movementsCollection.doc(id).delete();
    res
      .status(200)
      .send({ message: "Riwayat pergerakan stok berhasil dihapus." });
  } catch (error) {
    res.status(500).send({ message: "Error server", error });
  }
};

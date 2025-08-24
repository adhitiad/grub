import { Request, Response } from "express";
import { Order } from "../models/orders";
import { Product } from "../models/product";
import { db } from "../utils/firebase";
// Nanti kita akan impor fungsi untuk membuat tagihan Flip di sini
import { createFlipBill } from "../services/flip";

const ordersCollection = db.collection("orders");
const productsCollection = db.collection("products");
const inventoryCollection = db.collection("stock_inventory");
const movementsCollection = db.collection("stock_movements");

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, shippingAddress, warehouseId } = req.body; // Asumsi 'items' adalah array [{ productId, quantity }]
    const user = req.user!;

    if (!items || items.length === 0 || !warehouseId) {
      return res
        .status(400)
        .send({ message: "Item pesanan dan gudang tidak boleh kosong." });
    }

    let orderId = "";
    let totalAmount = 0;
    let finalOrderData: Order;

    // --- MULAI TRANSAKSI ---
    await db.runTransaction(async (transaction) => {
      const productRefs = items.map((item: any) =>
        productsCollection.doc(item.productId)
      );
      const productDocs = await transaction.getAll(...productRefs);

      const orderItems = [];

      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        if (!productDoc.exists)
          throw new Error(
            `Produk dengan ID ${items[i].productId} tidak ditemukan.`
          );

        const productData = productDoc.data() as Product;
        const quantity = items[i].quantity;

        // Cek Stok di Inventaris
        const inventoryId = `${productData.id!}_${warehouseId}`;
        const inventoryRef = inventoryCollection.doc(inventoryId);
        const inventoryDoc = await transaction.get(inventoryRef);

        if (!inventoryDoc.exists || inventoryDoc.data()!.quantity < quantity) {
          throw new Error(
            `Stok untuk produk ${productData.name} tidak mencukupi.`
          );
        }

        const currentQuantity = inventoryDoc.data()!.quantity;
        transaction.update(inventoryRef, {
          quantity: currentQuantity - quantity,
        });

        // Catat pergerakan stok
        const movementRef = movementsCollection.doc();
        transaction.set(movementRef, {
          productId: productData.id,
          warehouseId,
          type: "sale",
          quantityChange: -quantity,
          userId: user.id,
          createdAt: new Date(),
        });

        orderItems.push({
          productId: productData.id!,
          productName: productData.name,
          sku: productData.sku,
          quantity,
          priceAtTimeOfOrder: productData.sellingPrice,
        });
        totalAmount += productData.sellingPrice * quantity;
      }

      // Buat dokumen order
      const orderRef = ordersCollection.doc();
      orderId = orderRef.id;

      finalOrderData = {
        userId: user.id,
        userName: "Nama User Nanti Diambil Dari DB", // Ambil nama user dari DB jika perlu
        items: orderItems,
        totalAmount,
        shippingAddress,
        status: "pending_payment",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      transaction.set(orderRef, finalOrderData);
    });

    // Panggil API Flip setelah transaksi database berhasil
    const flipBill = await createFlipBill(orderId!, finalOrderData!);

    // Update dokumen order dengan detail pembayaran dari Flip
    await ordersCollection.doc(orderId!).update({
      "paymentDetails.method": "flip",
      "paymentDetails.flipBillId": flipBill.bill_id,
      "paymentDetails.paymentUrl": flipBill.link_url,
    });

    finalOrderData!.paymentDetails = {
      method: "flip",
      flipBillId: flipBill.bill_id,
      paymentUrl: flipBill.link_url,
    };

    res.status(201).send({
      message: "Order berhasil dibuat. Silakan lakukan pembayaran.",
      orderId,
      paymentUrl: flipBill.link_url,
      order: finalOrderData!,
    });
  } catch (error: any) {
    res
      .status(500)
      .send({ message: error.message || "Gagal membuat pesanan." });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const orderDoc = await ordersCollection.doc(id).get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan",
        timestamp: new Date().toISOString(),
      });
    }

    const orderData = orderDoc.data();

    // Check if user can access this order
    if (user.role === "customer" && orderData?.userId !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Anda hanya dapat melihat pesanan sendiri.",
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Pesanan ditemukan",
      data: { id: orderDoc.id, ...orderData },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mengambil pesanan",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Search orders
export const searchOrders = async (req: Request, res: Response) => {
  try {
    const {
      q,
      status,
      userId,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      limit = 20,
      offset = 0,
    } = req.query;
    const user = req.user!;

    let query: FirebaseFirestore.Query = ordersCollection;

    // Role-based filtering
    if (user.role === "customer") {
      // Customers can only see their own orders
      query = query.where("userId", "==", user.id);
    } else if (
      userId &&
      typeof userId === "string" &&
      (user.role === "admin" || user.role === "owner" || user.role === "staff")
    ) {
      // Admin, owner, staff can filter by specific user
      query = query.where("userId", "==", userId);
    }

    // Filter by status
    if (status && typeof status === "string") {
      const validStatuses = [
        "pending_payment",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];
      if (validStatuses.includes(status)) {
        query = query.where("status", "==", status);
      }
    }

    // Apply pagination
    query = query.limit(parseInt(limit as string));
    if (parseInt(offset as string) > 0) {
      query = query.offset(parseInt(offset as string));
    }

    // Order by creation date (most recent first)
    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();
    let orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Client-side filtering for date range and amount
    if (dateFrom || dateTo) {
      orders = orders.filter((order: any) => {
        const orderDate = order.createdAt?.toDate
          ? order.createdAt.toDate()
          : new Date(order.createdAt);
        const from = dateFrom
          ? new Date(dateFrom as string)
          : new Date("1970-01-01");
        const to = dateTo ? new Date(dateTo as string) : new Date();
        return orderDate >= from && orderDate <= to;
      });
    }

    // Filter by amount range
    if (minAmount || maxAmount) {
      orders = orders.filter((order: any) => {
        const amount = order.totalAmount || 0;
        const min = minAmount ? parseFloat(minAmount as string) : 0;
        const max = maxAmount ? parseFloat(maxAmount as string) : Infinity;
        return amount >= min && amount <= max;
      });
    }

    // Text search in order items or shipping address
    if (q && typeof q === "string") {
      const searchTerm = q.toLowerCase();
      orders = orders.filter(
        (order: any) =>
          order.shippingAddress?.toLowerCase().includes(searchTerm) ||
          order.items?.some((item: any) =>
            item.productName?.toLowerCase().includes(searchTerm)
          ) ||
          order.id?.toLowerCase().includes(searchTerm)
      );
    }

    res.status(200).json({
      success: true,
      message: "Pencarian pesanan berhasil",
      data: orders,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: orders.length,
      },
      filters: {
        searchTerm: q,
        status,
        userId: user.role === "customer" ? user.id : userId,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error server saat mencari pesanan",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

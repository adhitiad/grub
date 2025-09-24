// Analytics Controller for Dashboard Statistics
import { Request, Response } from "express";
import { db } from "../utils/firebase";

const usersCollection = db.collection("users");
const productsCollection = db.collection("products");
const ordersCollection = db.collection("orders");
const storesCollection = db.collection("stores");
const stockCollection = db.collection("stock_inventory");

// Get dashboard statistics
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Get basic counts
    const [usersSnapshot, productsSnapshot, ordersSnapshot, storesSnapshot] =
      await Promise.all([
        usersCollection.get(),
        productsCollection.get(),
        ordersCollection.get(),
        storesCollection.get(),
      ]);

    // Calculate revenue from completed orders
    const completedOrders = ordersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => order.status === "completed");

    const totalRevenue = completedOrders.reduce(
      (sum: number, order: any) => sum + (order.totalAmount || 0),
      0
    );

    // Get recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOrdersSnapshot = await ordersCollection
      .where("createdAt", ">=", sevenDaysAgo)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const recentOrders = recentOrdersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get low stock products (stock < 10)
    const lowStockSnapshot = await stockCollection
      .where("currentStock", "<", 10)
      .get();

    const lowStockProducts = lowStockSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get pending orders
    const pendingOrdersSnapshot = await ordersCollection
      .where("status", "==", "pending_payment")
      .get();

    const stats = {
      totalUsers: usersSnapshot.size,
      totalProducts: productsSnapshot.size,
      totalOrders: ordersSnapshot.size,
      totalStores: storesSnapshot.size,
      totalRevenue,
      pendingOrders: pendingOrdersSnapshot.size,
      completedOrders: completedOrders.length,
      recentOrders: recentOrders.slice(0, 5), // Latest 5 orders
      lowStockProducts: lowStockProducts.slice(0, 10), // Top 10 low stock items
      monthlyRevenue: await getMonthlyRevenue(),
      topProducts: await getTopProducts(),
    };

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard statistics",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Get monthly revenue for the last 12 months
const getMonthlyRevenue = async () => {
  try {
    const monthlyData = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const ordersSnapshot = await ordersCollection
        .where("status", "==", "completed")
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .get();

      const monthRevenue = ordersSnapshot.docs.reduce((sum, doc) => {
        const order = doc.data();
        return sum + (order.totalAmount || 0);
      }, 0);

      monthlyData.push({
        month: startDate.toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        }),
        revenue: monthRevenue,
        orders: ordersSnapshot.size,
      });
    }

    return monthlyData;
  } catch (error) {
    console.error("Monthly revenue error:", error);
    return [];
  }
};

// Get top selling products
const getTopProducts = async () => {
  try {
    const ordersSnapshot = await ordersCollection
      .where("status", "==", "completed")
      .get();

    const productSales: {
      [key: string]: { name: string; quantity: number; revenue: number };
    } = {};

    ordersSnapshot.docs.forEach((doc) => {
      const order = doc.data();
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              name: item.productName || "Unknown Product",
              quantity: 0,
              revenue: 0,
            };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue +=
            item.priceAtTimeOfOrder * item.quantity;
        });
      }
    });

    // Convert to array and sort by quantity
    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        ...data,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return topProducts;
  } catch (error) {
    console.error("Top products error:", error);
    return [];
  }
};

// Get sales analytics
export const getSalesAnalytics = async (req: Request, res: Response) => {
  try {
    const { period = "30", startDate, endDate } = req.query;

    let start: Date;
    let end: Date = new Date();

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      start = new Date();
      start.setDate(start.getDate() - parseInt(period as string));
    }

    const ordersSnapshot = await ordersCollection
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .orderBy("createdAt", "desc")
      .get();

    const orders = ordersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate analytics
    const totalOrders = orders.length;
    const completedOrders = orders.filter(
      (order: any) => order.status === "completed"
    );
    const totalRevenue = completedOrders.reduce(
      (sum, order: any) => sum + (order.totalAmount || 0),
      0
    );
    const averageOrderValue =
      completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Daily sales data
    const dailySales: { [key: string]: { orders: number; revenue: number } } =
      {};

    completedOrders.forEach((order: any) => {
      const date = new Date(order.createdAt.toDate())
        .toISOString()
        .split("T")[0];
      if (!dailySales[date]) {
        dailySales[date] = { orders: 0, revenue: 0 };
      }
      dailySales[date].orders += 1;
      dailySales[date].revenue += order.totalAmount || 0;
    });

    const salesData = Object.entries(dailySales)
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      message: "Sales analytics retrieved successfully",
      data: {
        summary: {
          totalOrders,
          completedOrders: completedOrders.length,
          totalRevenue,
          averageOrderValue,
          conversionRate:
            totalOrders > 0 ? (completedOrders.length / totalOrders) * 100 : 0,
        },
        dailySales: salesData,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          days: Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sales analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving sales analytics",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Get inventory analytics
export const getInventoryAnalytics = async (req: Request, res: Response) => {
  try {
    const stockSnapshot = await stockCollection.get();
    const productsSnapshot = await productsCollection.get();

    const stockData = stockSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate inventory metrics
    const totalProducts = products.length;
    const lowStockItems = stockData.filter(
      (item: any) => item.currentStock < 10
    );
    const outOfStockItems = stockData.filter(
      (item: any) => item.currentStock === 0
    );
    const totalStockValue = stockData.reduce((sum, item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      return sum + item.currentStock * ((product as any)?.purchasePrice || 0);
    }, 0);

    // Stock distribution by category
    const categoryStock: {
      [key: string]: { items: number; totalStock: number };
    } = {};

    stockData.forEach((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      if (product && (product as any).category) {
        const categoryName = (product as any).category.name || "Uncategorized";
        if (!categoryStock[categoryName]) {
          categoryStock[categoryName] = { items: 0, totalStock: 0 };
        }
        categoryStock[categoryName].items += 1;
        categoryStock[categoryName].totalStock += item.currentStock;
      }
    });

    const categoryDistribution = Object.entries(categoryStock)
      .map(([category, data]) => ({
        category,
        ...data,
      }))
      .sort((a, b) => b.totalStock - a.totalStock);

    res.status(200).json({
      success: true,
      message: "Inventory analytics retrieved successfully",
      data: {
        summary: {
          totalProducts,
          lowStockItems: lowStockItems.length,
          outOfStockItems: outOfStockItems.length,
          totalStockValue,
          averageStockPerProduct:
            totalProducts > 0
              ? stockData.reduce(
                  (sum, item: any) => sum + item.currentStock,
                  0
                ) / totalProducts
              : 0,
        },
        lowStockItems: lowStockItems.slice(0, 20),
        outOfStockItems: outOfStockItems.slice(0, 20),
        categoryDistribution,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Inventory analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving inventory analytics",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};

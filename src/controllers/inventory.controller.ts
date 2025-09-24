// Inventory Management Controller with Advanced Alerts
import { Request, Response } from "express";
import { db } from "../config/firebase";
import { enhancedLogger, createSuccessResponse, createErrorResponse } from "../utils/enhancedLogger";

const inventoryCollection = db.collection("inventory");
const productsCollection = db.collection("products");
const alertsCollection = db.collection("inventory_alerts");
const stockMovementsCollection = db.collection("stock_movements");
const usersCollection = db.collection("users");

interface InventoryAlert {
  id?: string;
  productId: string;
  productName: string;
  currentStock: number;
  minThreshold: number;
  alertType: 'low_stock' | 'out_of_stock' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  notificationsSent: string[]; // Array of user IDs who were notified
}

interface StockAdjustment {
  productId: string;
  adjustmentType: 'increase' | 'decrease' | 'set';
  quantity: number;
  reason: string;
  notes?: string;
  userId: string;
  batchNumber?: string;
  expiryDate?: Date;
}

interface InventoryForecast {
  productId: string;
  productName: string;
  currentStock: number;
  averageDailySales: number;
  daysUntilStockout: number;
  recommendedRestockDate: Date;
  recommendedOrderQuantity: number;
  confidence: number; // 0-1 confidence score
}

// Get inventory alerts with filtering and pagination
export const getInventoryAlerts = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    
    const {
      status = 'active',
      severity,
      productId,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = alertsCollection.orderBy(sortBy as string, sortOrder as any);

    // Apply filters
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    if (severity) {
      query = query.where('severity', '==', severity);
    }
    if (productId) {
      query = query.where('productId', '==', productId);
    }

    // Apply pagination
    if (offset && parseInt(offset as string) > 0) {
      const offsetSnapshot = await query.limit(parseInt(offset as string)).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(parseInt(limit as string)).get();
    const alerts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      acknowledgedAt: doc.data().acknowledgedAt?.toDate?.() || doc.data().acknowledgedAt,
      resolvedAt: doc.data().resolvedAt?.toDate?.() || doc.data().resolvedAt,
    }));

    // Get total count for pagination
    const totalSnapshot = await alertsCollection.where('status', '==', status || 'active').get();
    const total = totalSnapshot.size;

    enhancedLogger.info('Inventory alerts retrieved', context, {
      alertsCount: alerts.length,
      filters: { status, severity, productId },
      userId: user.id
    });

    res.status(200).json(createSuccessResponse(
      'Inventory alerts retrieved successfully',
      {
        alerts,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: alerts.length === parseInt(limit as string)
        }
      },
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to retrieve inventory alerts', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve inventory alerts',
      error as Error,
      context
    ));
  }
};

// Create or update inventory thresholds
export const updateInventoryThresholds = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { productId } = req.params;
    const { minThreshold, maxThreshold, reorderPoint, reorderQuantity } = req.body;

    // Validate input
    if (!minThreshold || minThreshold < 0) {
      return res.status(400).json(createErrorResponse(
        'Invalid minimum threshold',
        new Error('Minimum threshold must be a positive number'),
        context,
        400
      ));
    }

    // Check if product exists
    const productDoc = await productsCollection.doc(productId).get();
    if (!productDoc.exists) {
      return res.status(404).json(createErrorResponse(
        'Product not found',
        new Error(`Product with ID ${productId} not found`),
        context,
        404
      ));
    }

    // Update or create inventory record
    const inventoryRef = inventoryCollection.doc(productId);
    const inventoryDoc = await inventoryRef.get();

    const updateData = {
      productId,
      minThreshold: parseInt(minThreshold),
      maxThreshold: maxThreshold ? parseInt(maxThreshold) : null,
      reorderPoint: reorderPoint ? parseInt(reorderPoint) : minThreshold,
      reorderQuantity: reorderQuantity ? parseInt(reorderQuantity) : null,
      updatedAt: new Date(),
      updatedBy: user.id
    };

    if (inventoryDoc.exists) {
      await inventoryRef.update(updateData);
    } else {
      await inventoryRef.set({
        ...updateData,
        createdAt: new Date(),
        createdBy: user.id
      });
    }

    // Check if current stock is below new threshold and create alert if needed
    const currentStock = productDoc.data()?.stock || 0;
    if (currentStock <= minThreshold) {
      await createStockAlert(productId, productDoc.data()?.name, currentStock, minThreshold);
    }

    enhancedLogger.info('Inventory thresholds updated', context, {
      productId,
      thresholds: updateData,
      userId: user.id
    });

    res.status(200).json(createSuccessResponse(
      'Inventory thresholds updated successfully',
      { productId, thresholds: updateData },
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to update inventory thresholds', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to update inventory thresholds',
      error as Error,
      context
    ));
  }
};

// Acknowledge inventory alert
export const acknowledgeAlert = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { alertId } = req.params;
    const { notes } = req.body;

    const alertRef = alertsCollection.doc(alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      return res.status(404).json(createErrorResponse(
        'Alert not found',
        new Error(`Alert with ID ${alertId} not found`),
        context,
        404
      ));
    }

    await alertRef.update({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: user.id,
      acknowledgedNotes: notes || null,
      updatedAt: new Date()
    });

    enhancedLogger.info('Inventory alert acknowledged', context, {
      alertId,
      userId: user.id,
      notes
    });

    res.status(200).json(createSuccessResponse(
      'Alert acknowledged successfully',
      { alertId, acknowledgedBy: user.id },
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to acknowledge alert', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to acknowledge alert',
      error as Error,
      context
    ));
  }
};

// Get inventory forecasting data
export const getInventoryForecast = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    const { productId, days = 30 } = req.query;

    let query = productsCollection.where('isActive', '==', true);
    if (productId) {
      query = productsCollection.where('__name__', '==', productId);
    }

    const productsSnapshot = await query.get();
    const forecasts: InventoryForecast[] = [];

    for (const productDoc of productsSnapshot.docs) {
      const product = productDoc.data();
      const forecast = await calculateInventoryForecast(productDoc.id, product, parseInt(days as string));
      if (forecast) {
        forecasts.push(forecast);
      }
    }

    // Sort by days until stockout (ascending)
    forecasts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

    enhancedLogger.info('Inventory forecast generated', context, {
      productsAnalyzed: forecasts.length,
      forecastDays: days,
      userId: user.id
    });

    res.status(200).json(createSuccessResponse(
      'Inventory forecast generated successfully',
      { forecasts, generatedAt: new Date() },
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to generate inventory forecast', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to generate inventory forecast',
      error as Error,
      context
    ));
  }
};

// Helper function to create stock alert
async function createStockAlert(productId: string, productName: string, currentStock: number, minThreshold: number) {
  const alertType = currentStock === 0 ? 'out_of_stock' : 'low_stock';
  const severity = currentStock === 0 ? 'critical' : currentStock <= minThreshold * 0.5 ? 'high' : 'medium';

  // Check if similar alert already exists
  const existingAlertQuery = await alertsCollection
    .where('productId', '==', productId)
    .where('status', '==', 'active')
    .where('alertType', '==', alertType)
    .limit(1)
    .get();

  if (!existingAlertQuery.empty) {
    // Update existing alert
    const existingAlert = existingAlertQuery.docs[0];
    await existingAlert.ref.update({
      currentStock,
      severity,
      updatedAt: new Date()
    });
  } else {
    // Create new alert
    const alert: InventoryAlert = {
      productId,
      productName,
      currentStock,
      minThreshold,
      alertType,
      severity,
      status: 'active',
      createdAt: new Date(),
      notificationsSent: []
    };

    await alertsCollection.add(alert);
  }

  // Send notifications to relevant users
  await sendStockAlertNotifications(productId, productName, currentStock, alertType, severity);
}

// Helper function to send stock alert notifications
async function sendStockAlertNotifications(
  productId: string, 
  productName: string, 
  currentStock: number, 
  alertType: string, 
  severity: string
) {
  try {
    // Get users who should receive notifications (admin, owner, staff)
    const usersSnapshot = await usersCollection
      .where('role', 'in', ['admin', 'owner', 'staff'])
      .where('isActive', '==', true)
      .get();

    const notificationPromises = usersSnapshot.docs.map(async (userDoc) => {
      const user = userDoc.data();
      // This would integrate with email/SMS service
      console.log(`Sending ${alertType} notification to ${user.email} for product ${productName}`);
      
      // TODO: Implement actual notification sending
      // await sendEmail(user.email, 'Stock Alert', `Product ${productName} is ${alertType}`);
      // await sendSMS(user.phone, `Stock Alert: ${productName} is ${alertType}`);
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Failed to send stock alert notifications:', error);
  }
}

// Helper function to calculate inventory forecast
async function calculateInventoryForecast(
  productId: string, 
  product: any, 
  forecastDays: number
): Promise<InventoryForecast | null> {
  try {
    // Get sales data from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersSnapshot = await db.collection('orders')
      .where('createdAt', '>=', thirtyDaysAgo)
      .where('status', 'in', ['completed', 'processing', 'shipped'])
      .get();

    let totalSold = 0;
    let salesDays = 0;

    ordersSnapshot.docs.forEach(orderDoc => {
      const order = orderDoc.data();
      const productItem = order.items?.find((item: any) => item.productId === productId);
      if (productItem) {
        totalSold += productItem.quantity;
        salesDays++;
      }
    });

    if (salesDays === 0) {
      return null; // No sales data available
    }

    const averageDailySales = totalSold / 30; // Average over 30 days
    const currentStock = product.stock || 0;
    const daysUntilStockout = averageDailySales > 0 ? Math.floor(currentStock / averageDailySales) : 999;
    
    // Calculate recommended restock date (when stock reaches 20% of current level)
    const restockThreshold = Math.max(1, Math.floor(currentStock * 0.2));
    const daysUntilRestock = averageDailySales > 0 ? Math.floor((currentStock - restockThreshold) / averageDailySales) : 999;
    
    const recommendedRestockDate = new Date();
    recommendedRestockDate.setDate(recommendedRestockDate.getDate() + daysUntilRestock);
    
    // Calculate recommended order quantity (30 days of sales + safety stock)
    const recommendedOrderQuantity = Math.ceil(averageDailySales * 30 * 1.2); // 20% safety stock
    
    // Calculate confidence based on data consistency
    const confidence = Math.min(1, salesDays / 30);

    return {
      productId,
      productName: product.name,
      currentStock,
      averageDailySales,
      daysUntilStockout,
      recommendedRestockDate,
      recommendedOrderQuantity,
      confidence
    };
  } catch (error) {
    console.error(`Failed to calculate forecast for product ${productId}:`, error);
    return null;
  }
}

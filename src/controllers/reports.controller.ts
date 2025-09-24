// Advanced Reporting & Analytics Controller
import { Request, Response } from "express";
import { db } from "../config/firebase";
import { enhancedLogger, createSuccessResponse, createErrorResponse } from "../utils/enhancedLogger";
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const ordersCollection = db.collection("orders");
const productsCollection = db.collection("products");
const usersCollection = db.collection("users");
const stockMovementsCollection = db.collection("stock_movements");

interface SalesReportData {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  salesByCategory: Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    percentage: number;
  }>;
}

interface CustomerAnalyticsData {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  customerLifetimeValue: {
    average: number;
    median: number;
    top10Percent: number;
  };
  customerSegments: Array<{
    segment: string;
    count: number;
    percentage: number;
    averageOrderValue: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: Date;
  }>;
}

interface InventoryTurnoverData {
  period: string;
  products: Array<{
    productId: string;
    productName: string;
    averageStock: number;
    totalSold: number;
    turnoverRate: number;
    daysInStock: number;
    category: 'fast-moving' | 'medium-moving' | 'slow-moving' | 'dead-stock';
    revenueContribution: number;
  }>;
  overallTurnoverRate: number;
  stockEfficiency: number;
}

// Generate comprehensive sales report
export const generateSalesReport = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    
    const {
      startDate,
      endDate,
      groupBy = 'day', // day, week, month
      productIds,
      categoryIds,
      format = 'json' // json, pdf, excel
    } = req.query;

    // Validate date range
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (start >= end) {
      return res.status(400).json(createErrorResponse(
        'Invalid date range',
        new Error('Start date must be before end date'),
        context,
        400
      ));
    }

    // Build query
    let ordersQuery = ordersCollection
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .where('status', 'in', ['completed', 'processing', 'shipped']);

    const ordersSnapshot = await ordersQuery.get();
    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    // Generate report data
    const reportData = await generateSalesReportData(orders, start, end, groupBy as string);

    // Handle different output formats
    if (format === 'pdf') {
      const pdfBuffer = await generateSalesReportPDF(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="sales-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.pdf"`);
      return res.send(pdfBuffer);
    }

    if (format === 'excel') {
      const excelBuffer = await generateSalesReportExcel(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="sales-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.xlsx"`);
      return res.send(excelBuffer);
    }

    enhancedLogger.info('Sales report generated', context, {
      period: `${start.toISOString()} to ${end.toISOString()}`,
      ordersAnalyzed: orders.length,
      format,
      userId: user.id
    });

    res.status(200).json(createSuccessResponse(
      'Sales report generated successfully',
      reportData,
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to generate sales report', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to generate sales report',
      error as Error,
      context
    ));
  }
};

// Generate customer analytics report
export const generateCustomerAnalytics = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    
    const {
      startDate,
      endDate,
      segmentBy = 'value', // value, frequency, recency
      format = 'json'
    } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get all customers
    const customersSnapshot = await usersCollection
      .where('role', '==', 'customer')
      .where('isActive', '==', true)
      .get();

    // Get orders for the period
    const ordersSnapshot = await ordersCollection
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .where('status', 'in', ['completed'])
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    const analyticsData = await generateCustomerAnalyticsData(
      customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      orders,
      start,
      end,
      segmentBy as string
    );

    if (format === 'excel') {
      const excelBuffer = await generateCustomerAnalyticsExcel(analyticsData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="customer-analytics-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.xlsx"`);
      return res.send(excelBuffer);
    }

    enhancedLogger.info('Customer analytics generated', context, {
      period: `${start.toISOString()} to ${end.toISOString()}`,
      customersAnalyzed: customersSnapshot.size,
      ordersAnalyzed: orders.length,
      userId: user.id
    });

    res.status(200).json(createSuccessResponse(
      'Customer analytics generated successfully',
      analyticsData,
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to generate customer analytics', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to generate customer analytics',
      error as Error,
      context
    ));
  }
};

// Generate inventory turnover report
export const generateInventoryTurnoverReport = async (req: Request, res: Response) => {
  try {
    const context = enhancedLogger.extractRequestContext(req);
    const user = req.user!;
    
    const {
      startDate,
      endDate,
      categoryIds,
      format = 'json'
    } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get products
    let productsQuery = productsCollection.where('isActive', '==', true);
    if (categoryIds) {
      const categoryArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
      productsQuery = productsQuery.where('categoryId', 'in', categoryArray);
    }

    const productsSnapshot = await productsQuery.get();
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get stock movements for the period
    const stockMovementsSnapshot = await stockMovementsCollection
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .get();

    const stockMovements = stockMovementsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    // Get sales data
    const ordersSnapshot = await ordersCollection
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .where('status', 'in', ['completed'])
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));

    const turnoverData = await generateInventoryTurnoverData(products, stockMovements, orders, start, end);

    if (format === 'excel') {
      const excelBuffer = await generateInventoryTurnoverExcel(turnoverData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="inventory-turnover-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.xlsx"`);
      return res.send(excelBuffer);
    }

    enhancedLogger.info('Inventory turnover report generated', context, {
      period: `${start.toISOString()} to ${end.toISOString()}`,
      productsAnalyzed: products.length,
      userId: user.id
    });

    res.status(200).json(createSuccessResponse(
      'Inventory turnover report generated successfully',
      turnoverData,
      context
    ));
  } catch (error) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.error('Failed to generate inventory turnover report', context, error as Error);
    res.status(500).json(createErrorResponse(
      'Failed to generate inventory turnover report',
      error as Error,
      context
    ));
  }
};

// Helper function to generate sales report data
async function generateSalesReportData(
  orders: any[],
  startDate: Date,
  endDate: Date,
  groupBy: string
): Promise<SalesReportData> {
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate top products
  const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
  
  orders.forEach(order => {
    order.items?.forEach((item: any) => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = {
          name: item.productName,
          quantity: 0,
          revenue: 0
        };
      }
      productSales[item.productId].quantity += item.quantity;
      productSales[item.productId].revenue += item.quantity * item.priceAtTimeOfOrder;
    });
  });

  const topProducts = Object.entries(productSales)
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantitySold: data.quantity,
      revenue: data.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Calculate sales by day/week/month
  const salesByPeriod: { [key: string]: { revenue: number; orders: number } } = {};
  
  orders.forEach(order => {
    const date = new Date(order.createdAt);
    let periodKey: string;
    
    switch (groupBy) {
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default: // day
        periodKey = date.toISOString().split('T')[0];
    }
    
    if (!salesByPeriod[periodKey]) {
      salesByPeriod[periodKey] = { revenue: 0, orders: 0 };
    }
    
    salesByPeriod[periodKey].revenue += order.totalAmount || 0;
    salesByPeriod[periodKey].orders += 1;
  });

  const salesByDay = Object.entries(salesByPeriod)
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalRevenue,
    totalOrders,
    averageOrderValue,
    topProducts,
    salesByDay,
    salesByCategory: [] // Would be populated with category data
  };
}

// Helper function to generate customer analytics data
async function generateCustomerAnalyticsData(
  customers: any[],
  orders: any[],
  startDate: Date,
  endDate: Date,
  segmentBy: string
): Promise<CustomerAnalyticsData> {
  const totalCustomers = customers.length;
  
  // Calculate customer metrics
  const customerMetrics: { [key: string]: { orders: number; totalSpent: number; lastOrder: Date } } = {};
  
  orders.forEach(order => {
    if (!customerMetrics[order.userId]) {
      customerMetrics[order.userId] = {
        orders: 0,
        totalSpent: 0,
        lastOrder: new Date(order.createdAt)
      };
    }
    
    customerMetrics[order.userId].orders += 1;
    customerMetrics[order.userId].totalSpent += order.totalAmount || 0;
    
    const orderDate = new Date(order.createdAt);
    if (orderDate > customerMetrics[order.userId].lastOrder) {
      customerMetrics[order.userId].lastOrder = orderDate;
    }
  });

  const activeCustomers = Object.keys(customerMetrics).length;
  const customerValues = Object.values(customerMetrics).map(m => m.totalSpent).sort((a, b) => b - a);
  
  const averageCLV = customerValues.length > 0 ? customerValues.reduce((sum, val) => sum + val, 0) / customerValues.length : 0;
  const medianCLV = customerValues.length > 0 ? customerValues[Math.floor(customerValues.length / 2)] : 0;
  const top10PercentCLV = customerValues.length > 0 ? customerValues.slice(0, Math.ceil(customerValues.length * 0.1)).reduce((sum, val) => sum + val, 0) / Math.ceil(customerValues.length * 0.1) : 0;

  // Generate top customers
  const topCustomers = Object.entries(customerMetrics)
    .map(([customerId, metrics]) => {
      const customer = customers.find(c => c.id === customerId);
      return {
        customerId,
        customerName: customer?.name || 'Unknown',
        totalOrders: metrics.orders,
        totalSpent: metrics.totalSpent,
        lastOrderDate: metrics.lastOrder
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 20);

  return {
    totalCustomers,
    activeCustomers,
    newCustomers: 0, // Would calculate based on registration date
    customerLifetimeValue: {
      average: averageCLV,
      median: medianCLV,
      top10Percent: top10PercentCLV
    },
    customerSegments: [], // Would segment customers based on segmentBy parameter
    topCustomers
  };
}

// Helper function to generate inventory turnover data
async function generateInventoryTurnoverData(
  products: any[],
  stockMovements: any[],
  orders: any[],
  startDate: Date,
  endDate: Date
): Promise<InventoryTurnoverData> {
  const productTurnover = products.map(product => {
    // Calculate average stock
    const productMovements = stockMovements.filter(m => m.productId === product.id);
    const averageStock = product.stock || 0; // Simplified - would calculate actual average

    // Calculate total sold
    let totalSold = 0;
    orders.forEach(order => {
      const productItem = order.items?.find((item: any) => item.productId === product.id);
      if (productItem) {
        totalSold += productItem.quantity;
      }
    });

    // Calculate turnover rate
    const turnoverRate = averageStock > 0 ? totalSold / averageStock : 0;
    const daysInStock = turnoverRate > 0 ? 365 / turnoverRate : 365;

    // Categorize product
    let category: 'fast-moving' | 'medium-moving' | 'slow-moving' | 'dead-stock';
    if (turnoverRate >= 12) category = 'fast-moving';
    else if (turnoverRate >= 6) category = 'medium-moving';
    else if (turnoverRate >= 2) category = 'slow-moving';
    else category = 'dead-stock';

    return {
      productId: product.id,
      productName: product.name,
      averageStock,
      totalSold,
      turnoverRate,
      daysInStock,
      category,
      revenueContribution: totalSold * (product.price || 0)
    };
  });

  const overallTurnoverRate = productTurnover.reduce((sum, p) => sum + p.turnoverRate, 0) / productTurnover.length;
  const stockEfficiency = productTurnover.filter(p => p.category === 'fast-moving' || p.category === 'medium-moving').length / productTurnover.length;

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    products: productTurnover.sort((a, b) => b.turnoverRate - a.turnoverRate),
    overallTurnoverRate,
    stockEfficiency
  };
}

// Helper functions for PDF and Excel generation would be implemented here
async function generateSalesReportPDF(reportData: SalesReportData): Promise<Buffer> {
  // PDF generation implementation
  return Buffer.from('PDF content placeholder');
}

async function generateSalesReportExcel(reportData: SalesReportData): Promise<Buffer> {
  // Excel generation implementation
  return Buffer.from('Excel content placeholder');
}

async function generateCustomerAnalyticsExcel(analyticsData: CustomerAnalyticsData): Promise<Buffer> {
  // Excel generation implementation
  return Buffer.from('Excel content placeholder');
}

async function generateInventoryTurnoverExcel(turnoverData: InventoryTurnoverData): Promise<Buffer> {
  // Excel generation implementation
  return Buffer.from('Excel content placeholder');
}

// src/app.ts
import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { config } from "./config/env";
import "./config/firebase";
import { db } from "./config/firebase";

// Import routes
import analyticsRoutes from "./routes/analytics";
import authRoutes from "./routes/auth";
import categoryRoutes from "./routes/category";
import deviceRoutes from "./routes/device";
import healthRoutes from "./routes/health";
import imageUploadRoutes from "./routes/imageUpload";
import inventoryRoutes from "./routes/inventory";
import orderRoutes from "./routes/order";
import paymentRoutes from "./routes/payment";
import productRoutes from "./routes/product";
import reportsRoutes from "./routes/reports";
import searchRoutes from "./routes/search";
import stockRoutes from "./routes/stock";
import storeRoutes from "./routes/store";
import userRoutes from "./routes/user";

// Import middleware
import { createDeviceRateLimit } from "./middleware/deviceRateLimit";
import { requestLogger } from "./middleware/requestLogger";

const app: Application = express();
const port = config.server.port;

// Configure CORS
app.use(
  cors({
    origin: ["https://grub-frontend.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-ID"],
  })
);

// Configure rate limiting based on environment settings
let rateLimitMiddleware;

if (config.deviceRateLimit.enabled) {
  // Use device-based rate limiting
  rateLimitMiddleware = createDeviceRateLimit({
    windowMs: config.deviceRateLimit.windowMs,
    maxRequests: config.deviceRateLimit.maxRequests,
    requireDeviceId: config.deviceRateLimit.requireDeviceId,
    fallbackToIp: config.deviceRateLimit.fallbackToIp,
    message: "Too many requests from this device, please try again later.",
    statusCode: 429,
    trustProxy: true, // Trust proxy headers for IP extraction
    deviceIdHeaders: ["x-device-id", "device-id", "x-client-id", "client-id"],
    onLimitReached: (req, res) => {
      console.warn(
        `Rate limit exceeded for device: ${
          req.deviceId || "unknown"
        } at ${new Date().toISOString()}`
      );
    },
  });
} else {
  // Fallback to IP-based rate limiting
  rateLimitMiddleware = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      error: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// Middleware - Order is important for security and logging!
// Enhanced middleware will be integrated in next phase
// app.use(healthCheckMiddleware); // Skip logging for health checks
// app.use(correlationIdMiddleware); // Add correlation IDs first
// app.use(securityHeadersMiddleware); // Add security headers
// app.use(deviceIdMiddleware); // Extract device ID
// app.use(rateLimitLoggingMiddleware); // Log rate limit events
app.use(rateLimitMiddleware); // Apply rate limiting

// Configure Helmet for security while allowing frontend access
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("combined"));
app.use(requestLogger);
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      // Store raw body for webhook verification
      (req as any).rawBody = buf;
    },
  })
);
// Enhanced logging middleware will be integrated in next phase
// app.use(requestCompletionMiddleware); // Log request completion
// app.use(authEventMiddleware); // Log auth events

// Health check endpoints
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Selamat Datang di API Distributor!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    documentation: "/api/docs",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      products: "/api/products",
      categories: "/api/categories",
      stores: "/api/stores",
      orders: "/api/orders",
      payments: "/api/payments",
      stock: "/api/stock",
      device: "/api/device",
      inventory: "/api/inventory",
      reports: "/api/reports",
      images: "/api/images",
      search: "/api/search",
      health: "/health",
    },
    features: {
      authentication: "JWT-based authentication with role-based access control",
      rateLimit: "Device-based rate limiting with IP fallback",
      search: "Advanced search with filtering and pagination",
      payments: "Flip payment gateway integration",
      realtime: "Firebase Firestore real-time updates",
      monitoring: "Comprehensive health checks and observability",
      security: "Enhanced input validation and security headers",
    },
  });
});

app.get("/api/docs", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API Documentation",
    version: "1.0.0",
    baseUrl: config.server.apiBaseUrl,
    authentication: "Bearer Token (JWT)",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register new user",
        "POST /api/auth/login": "User login",
        "GET /api/auth/me": "Get current user profile (requires auth)",
      },
      users: {
        "GET /api/users": "Get all users (admin only)",
        "GET /api/users/:id": "Get user by ID",
        "POST /api/users": "Create user (admin only)",
        "PUT /api/users/:id": "Update user (admin only)",
        "DELETE /api/users/:id": "Delete user (admin only)",
      },
      products: {
        "GET /api/products": "Get all products (requires auth)",
        "POST /api/products": "Create product (admin/owner)",
        "PUT /api/products/:id": "Update product (admin/owner/staff)",
        "DELETE /api/products/:id": "Delete product (admin/owner)",
      },
      categories: {
        "GET /api/categories": "Get all categories (requires auth)",
        "POST /api/categories": "Create category (admin/owner/staff)",
        "PUT /api/categories/:id": "Update category (admin/owner)",
        "DELETE /api/categories/:id": "Delete category (admin/owner)",
      },
      stores: {
        "GET /api/stores": "Get all stores (requires auth)",
        "POST /api/stores": "Create store (admin/owner/sales)",
        "PATCH /api/stores/:id/status": "Update store status (admin/owner)",
      },
      orders: {
        "POST /api/orders": "Create new order (requires auth)",
      },
      stock: {
        "GET /api/stock": "Get all stock inventory",
        "POST /api/stock": "Adjust stock (admin/owner/staff)",
      },
      payments: {
        "POST /api/payments/flip-webhook": "Flip payment webhook (public)",
      },
      device: {
        "GET /api/device/generate": "Generate secure device ID (public)",
        "POST /api/device/validate": "Validate device ID (public)",
        "GET /api/device/info": "Get device information (public)",
        "GET /api/device/rate-limit": "Get rate limit status (public)",
        "POST /api/device/:deviceId/reset-rate-limit":
          "Reset device rate limit (admin/owner)",
      },
    },
    userRoles: ["customer", "staff", "kasir", "sales", "admin", "owner"],
    timestamp: new Date().toISOString(),
  });
});

app.get("/test", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Test Berhasil!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/test-firebase", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({
      success: true,
      message: "Firebase connection successful",
      data: users,
    });
  } catch (error) {
    console.error("Firebase test error:", error);
    res.status(500).json({
      success: false,
      message: "Firebase connection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API Routes
app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/images", imageUploadRoutes);
app.use("/api/search", searchRoutes);

// 404 handler
app.use("*", (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    timestamp: new Date().toISOString(),
  });
});

// Enhanced error handling with correlation context will be integrated in next phase
// app.use(errorCorrelationMiddleware);

// Global error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Global error handler:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
  console.log(`📚 Environment: ${config.server.nodeEnv}`);
  console.log(`🔒 JWT configured: ${config.jwt.secret ? "Yes" : "No"}`);
  console.log(`💳 Flip configured: ${config.flip.secretKey ? "Yes" : "No"}`);
});

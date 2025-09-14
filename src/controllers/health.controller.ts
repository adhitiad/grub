import { Request, Response } from "express";
import { config } from "../config/env";
import { db } from "../config/firebase";
import {
  createErrorResponse,
  createSuccessResponse,
  enhancedLogger,
} from "../utils/enhancedLogger";

interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    memory: ServiceHealth;
    disk?: ServiceHealth;
    external?: {
      flip?: ServiceHealth;
    };
  };
  performance: {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

interface ServiceHealth {
  status: "healthy" | "unhealthy" | "degraded";
  responseTime?: number;
  error?: string;
  details?: any;
}

/**
 * Basic health check endpoint
 */
export const healthCheck = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const context = enhancedLogger.extractRequestContext(req);

  try {
    const healthResult: HealthCheckResult = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: config.server.nodeEnv,
      services: {
        database: await checkDatabaseHealth(),
        memory: checkMemoryHealth(),
      },
      performance: {
        responseTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
      },
    };

    // Determine overall health status
    const serviceStatuses = Object.values(healthResult.services).map(
      (service) =>
        typeof service === "object" && "status" in service
          ? service.status
          : "healthy"
    );

    if (serviceStatuses.includes("unhealthy")) {
      healthResult.status = "unhealthy";
    } else if (serviceStatuses.includes("degraded")) {
      healthResult.status = "degraded";
    }

    // Set appropriate HTTP status code
    const httpStatus =
      healthResult.status === "healthy"
        ? 200
        : healthResult.status === "degraded"
        ? 200
        : 503;

    // Log health check if there are issues
    if (healthResult.status !== "healthy") {
      enhancedLogger.warn(
        `Health check failed: ${healthResult.status}`,
        context,
        healthResult
      );
    }

    res
      .status(httpStatus)
      .json(
        createSuccessResponse("Health check completed", healthResult, context)
      );
  } catch (error) {
    const errorResult = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };

    enhancedLogger.error(
      "Health check failed",
      context,
      error instanceof Error ? error : new Error(String(error))
    );
    res
      .status(503)
      .json(
        createErrorResponse(
          "Health check failed",
          error instanceof Error ? error : new Error(String(error)),
          context,
          503
        )
      );
  }
};

/**
 * Detailed health check with all services
 */
export const detailedHealthCheck = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const context = enhancedLogger.extractRequestContext(req);

  try {
    const healthResult: HealthCheckResult = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: config.server.nodeEnv,
      services: {
        database: await checkDatabaseHealth(),
        memory: checkMemoryHealth(),
        external: {
          flip: await checkFlipApiHealth(),
        },
      },
      performance: {
        responseTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };

    // Add disk health check in production
    if (config.server.nodeEnv === "production") {
      healthResult.services.disk = await checkDiskHealth();
    }

    // Determine overall health status
    const allServices = [
      healthResult.services.database,
      healthResult.services.memory,
      healthResult.services.disk,
      ...Object.values(healthResult.services.external || {}),
    ].filter(Boolean);

    const serviceStatuses = allServices.map((service) => service!.status);

    if (serviceStatuses.includes("unhealthy")) {
      healthResult.status = "unhealthy";
    } else if (serviceStatuses.includes("degraded")) {
      healthResult.status = "degraded";
    }

    // Set appropriate HTTP status code
    const httpStatus =
      healthResult.status === "healthy"
        ? 200
        : healthResult.status === "degraded"
        ? 200
        : 503;

    // Log detailed health check results
    enhancedLogger.info(
      `Detailed health check: ${healthResult.status}`,
      context,
      {
        services: Object.keys(healthResult.services),
        responseTime: healthResult.performance.responseTime,
      }
    );

    res
      .status(httpStatus)
      .json(
        createSuccessResponse(
          "Detailed health check completed",
          healthResult,
          context
        )
      );
  } catch (error) {
    enhancedLogger.error(
      "Detailed health check failed",
      context,
      error instanceof Error ? error : new Error(String(error))
    );
    res
      .status(503)
      .json(
        createErrorResponse(
          "Detailed health check failed",
          error instanceof Error ? error : new Error(String(error)),
          context,
          503
        )
      );
  }
};

/**
 * Readiness probe for Kubernetes
 */
export const readinessCheck = async (req: Request, res: Response) => {
  const context = enhancedLogger.extractRequestContext(req);

  try {
    // Check critical services that must be available for the app to serve traffic
    const databaseHealth = await checkDatabaseHealth();

    if (databaseHealth.status === "unhealthy") {
      res
        .status(503)
        .json(
          createErrorResponse(
            "Service not ready",
            "Database unavailable",
            context,
            503
          )
        );
      return;
    }

    res.status(200).json(
      createSuccessResponse(
        "Service is ready",
        {
          status: "ready",
          timestamp: new Date().toISOString(),
        },
        context
      )
    );
  } catch (error) {
    enhancedLogger.error(
      "Readiness check failed",
      context,
      error instanceof Error ? error : new Error(String(error))
    );
    res
      .status(503)
      .json(
        createErrorResponse(
          "Service not ready",
          error instanceof Error ? error : new Error(String(error)),
          context,
          503
        )
      );
  }
};

/**
 * Liveness probe for Kubernetes
 */
export const livenessCheck = async (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

/**
 * Check database connectivity and performance
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Simple database connectivity test
    const testCollection = db.collection("health_check");
    const testDoc = testCollection.doc("test");

    await testDoc.set({
      timestamp: new Date().toISOString(),
      test: true,
    });

    await testDoc.delete();

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 1000 ? "healthy" : "degraded",
      responseTime,
      details: {
        type: "firebase_firestore",
        responseTime,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : "Database connection failed",
      details: {
        type: "firebase_firestore",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Check memory usage
 */
function checkMemoryHealth(): ServiceHealth {
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent =
    (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (memoryUsagePercent > 90) {
    status = "unhealthy";
  } else if (memoryUsagePercent > 75) {
    status = "degraded";
  }

  return {
    status,
    details: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      usagePercent: Math.round(memoryUsagePercent * 100) / 100,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
    },
  };
}

/**
 * Check disk space (for production environments)
 */
async function checkDiskHealth(): Promise<ServiceHealth> {
  try {
    const fs = require("fs").promises;
    const stats = await fs.statfs(".");

    const totalSpace = stats.blocks * stats.blksize;
    const freeSpace = stats.bavail * stats.blksize;
    const usedPercent = ((totalSpace - freeSpace) / totalSpace) * 100;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (usedPercent > 95) {
      status = "unhealthy";
    } else if (usedPercent > 85) {
      status = "degraded";
    }

    return {
      status,
      details: {
        totalSpace,
        freeSpace,
        usedPercent: Math.round(usedPercent * 100) / 100,
      },
    };
  } catch (error) {
    return {
      status: "degraded",
      error: "Could not check disk space",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Check Flip API connectivity
 */
async function checkFlipApiHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // This would be a simple ping to Flip API if available
    // For now, we'll just check if the configuration is present
    if (!config.flip.secretKey || !config.flip.validationToken) {
      return {
        status: "degraded",
        error: "Flip API configuration incomplete",
        details: {
          hasSecretKey: !!config.flip.secretKey,
          hasValidationToken: !!config.flip.validationToken,
        },
      };
    }

    return {
      status: "healthy",
      responseTime: Date.now() - startTime,
      details: {
        configured: true,
        responseTime: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Flip API check failed",
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

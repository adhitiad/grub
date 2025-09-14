import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { enhancedLogger } from "../utils/enhancedLogger";

// Extend Request interface for correlation tracking
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      traceId?: string;
      spanId?: string;
      deviceId?: string;
      skipLogging?: boolean;
    }
  }
}

// Extend Express Request interface to include correlation tracking
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      traceId?: string;
      spanId?: string;
      startTime?: number;
      deviceId?: string;
      rateLimitInfo?: {
        deviceId: string;
        remaining: number;
        resetTime: Date;
        total: number;
      };
    }
  }
}

/**
 * Middleware to add correlation ID to requests for distributed tracing
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate or extract correlation ID
  const correlationId =
    req.get("x-correlation-id") ||
    req.get("x-request-id") ||
    req.get("request-id") ||
    enhancedLogger.generateCorrelationId();

  // Generate trace ID for distributed tracing
  const traceId = req.get("x-trace-id") || enhancedLogger.generateTraceId();

  // Generate span ID for this request
  const spanId = enhancedLogger.generateSpanId();

  // Store in request object
  req.correlationId = correlationId;
  req.traceId = traceId;
  req.spanId = spanId;
  req.startTime = Date.now();

  // Add to response headers for client tracking
  res.set({
    "X-Correlation-ID": correlationId,
    "X-Trace-ID": traceId,
    "X-Span-ID": spanId,
  });

  // Store correlation ID for async operations
  enhancedLogger.setCorrelationId(correlationId, correlationId);

  next();
};

/**
 * Middleware to log request completion with correlation context
 */
export const requestCompletionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send to capture response
  res.send = function (body: any) {
    logRequestCompletion(req, res);
    return originalSend.call(this, body);
  };

  // Override res.json to capture response
  res.json = function (body: any) {
    logRequestCompletion(req, res);
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Log request completion with full context
 */
function logRequestCompletion(req: Request, res: Response) {
  const responseTime = req.startTime ? Date.now() - req.startTime : 0;
  const context = enhancedLogger.extractRequestContext(req);

  context.statusCode = res.statusCode;
  context.responseTime = responseTime;

  // Log the request completion
  enhancedLogger.logRequest(req, res, responseTime);

  // Log performance metrics if response is slow
  if (responseTime > 1000) {
    enhancedLogger.logPerformance(
      `${req.method} ${req.originalUrl || req.url}`,
      {
        responseTime,
        memoryUsage: process.memoryUsage(),
      },
      context
    );
  }

  // Clean up correlation ID from store
  if (req.correlationId) {
    setTimeout(() => {
      enhancedLogger.setCorrelationId(req.correlationId!, ""); // Clean up after 1 minute
    }, 60000);
  }
}

/**
 * Error handling middleware with correlation context
 */
export const errorCorrelationMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const context = enhancedLogger.extractRequestContext(req);

  // Log the error with full context
  enhancedLogger.error(
    `Unhandled error in ${req.method} ${req.originalUrl || req.url}`,
    context,
    error,
    {
      stack: error.stack,
      name: error.name,
    }
  );

  // If response hasn't been sent, send error response
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  next(error);
};

/**
 * Middleware to extract and validate device ID
 */
export const deviceIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extract device ID from various headers
  const deviceId =
    req.get("x-device-id") ||
    req.get("device-id") ||
    req.get("x-client-id") ||
    req.get("client-id");

  if (deviceId) {
    req.deviceId = deviceId;

    // Log device registration/usage
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.logDeviceEvent("device_registered", deviceId, context, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });
  }

  next();
};

/**
 * Middleware to add security headers and log security events
 */
export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Add security headers
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  });

  // Remove server information
  res.removeHeader("X-Powered-By");

  // Log security-relevant headers
  const suspiciousHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "x-originating-ip",
    "x-remote-ip",
    "x-client-ip",
  ];

  const foundSuspiciousHeaders = suspiciousHeaders.filter((header) =>
    req.get(header)
  );

  if (foundSuspiciousHeaders.length > 0) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.logSecurityEvent(
      {
        type: "suspicious_activity",
        severity: "low",
        details: {
          suspiciousHeaders: foundSuspiciousHeaders.map((header) => ({
            name: header,
            value: req.get(header),
          })),
          reason: "Multiple IP forwarding headers detected",
        },
      },
      context
    );
  }

  next();
};

/**
 * Middleware to log authentication events
 */
export const authEventMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalJson = res.json;

  res.json = function (body: any) {
    const context = enhancedLogger.extractRequestContext(req);

    // Log authentication events based on endpoint and response
    if (req.path.includes("/auth/login")) {
      if (res.statusCode === 200 && body.success) {
        enhancedLogger.logAuthEvent(
          "login_success",
          body.data?.user?.id,
          context,
          {
            userAgent: req.get("user-agent"),
            ip: req.ip,
          }
        );
      } else {
        enhancedLogger.logAuthEvent("login_failure", undefined, context, {
          reason: body.message || "Unknown error",
          userAgent: req.get("user-agent"),
          ip: req.ip,
        });
      }
    } else if (req.path.includes("/auth/logout")) {
      enhancedLogger.logAuthEvent("logout", req.user?.id, context);
    }

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Health check middleware that doesn't log routine health checks
 */
export const healthCheckMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip logging for health check endpoints
  if (
    req.path === "/health" ||
    req.path === "/ping" ||
    req.path === "/status"
  ) {
    req.skipLogging = true;
  }

  next();
};

/**
 * Rate limit logging middleware
 */
export const rateLimitLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalStatus = res.status;

  res.status = function (statusCode: number) {
    if (statusCode === 429) {
      const context = enhancedLogger.extractRequestContext(req);
      enhancedLogger.logRateLimitEvent(
        req.deviceId || "unknown",
        req.ip || "unknown",
        req.originalUrl || req.url,
        context
      );
    }
    return originalStatus.call(this, statusCode);
  };

  next();
};

// Export all middleware functions
export default {
  correlationIdMiddleware,
  requestCompletionMiddleware,
  errorCorrelationMiddleware,
  deviceIdMiddleware,
  securityHeadersMiddleware,
  authEventMiddleware,
  healthCheckMiddleware,
  rateLimitLoggingMiddleware,
};

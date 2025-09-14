import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";

export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
}

interface EnhancedLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  service: string;
  environment: string;
  traceId?: string;
  spanId?: string;
}

interface LogContext {
  userId?: string;
  requestId?: string;
  correlationId?: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  traceId?: string;
  spanId?: string;
}

interface SecurityEvent {
  type:
    | "auth_failure"
    | "rate_limit_exceeded"
    | "suspicious_activity"
    | "access_denied"
    | "input_validation_failed";
  severity: "low" | "medium" | "high" | "critical";
  details: any;
}

interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

class EnhancedLogger {
  private isDevelopment = config.server.nodeEnv === "development";
  private logDirectory = "logs";
  private correlationStore = new Map<string, string>();

  constructor() {
    // Ensure logs directory exists
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  // Generate correlation ID for request tracking
  generateCorrelationId(): string {
    return uuidv4();
  }

  // Generate trace ID for distributed tracing
  generateTraceId(): string {
    return uuidv4().replace(/-/g, "");
  }

  // Generate span ID for distributed tracing
  generateSpanId(): string {
    return Math.random().toString(16).substring(2, 18);
  }

  // Extract context from Express request
  extractRequestContext(req: any): LogContext {
    const correlationId = req.correlationId || this.generateCorrelationId();
    const traceId = req.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    return {
      correlationId,
      traceId,
      spanId,
      requestId: req.requestId || correlationId,
      userId: req.user?.id,
      deviceId: req.deviceId || req.get("x-device-id") || req.get("device-id"),
      userAgent: req.get("user-agent"),
      ip: req.ip || req.connection.remoteAddress,
      method: req.method,
      url: req.originalUrl || req.url,
    };
  }

  // Store correlation ID for async operations
  setCorrelationId(key: string, correlationId: string): void {
    this.correlationStore.set(key, correlationId);
  }

  // Retrieve correlation ID for async operations
  getCorrelationId(key: string): string | undefined {
    return this.correlationStore.get(key);
  }

  private formatLog(entry: EnhancedLogEntry): string {
    if (this.isDevelopment) {
      return this.formatConsoleLog(entry);
    } else {
      return this.formatStructuredLog(entry);
    }
  }

  private formatConsoleLog(entry: EnhancedLogEntry): string {
    const {
      timestamp,
      level,
      message,
      correlationId,
      userId,
      deviceId,
      method,
      url,
      responseTime,
    } = entry;

    let logMessage = `[${timestamp}] ${level}:`;

    if (correlationId) logMessage += ` [${correlationId.substring(0, 8)}]`;
    if (method && url) logMessage += ` ${method} ${url}`;
    if (responseTime) logMessage += ` ${responseTime}ms`;
    if (userId) logMessage += ` user:${userId}`;
    if (deviceId) logMessage += ` device:${deviceId.substring(0, 8)}`;

    logMessage += ` ${message}`;

    return logMessage;
  }

  private formatStructuredLog(entry: EnhancedLogEntry): string {
    const structuredEntry = {
      ...entry,
      service: "grub-api",
      environment: config.server.nodeEnv || "development",
    };

    // Remove undefined values
    Object.keys(structuredEntry).forEach((key) => {
      if ((structuredEntry as any)[key] === undefined) {
        delete (structuredEntry as any)[key];
      }
    });

    return JSON.stringify(structuredEntry);
  }

  private writeToFile(entry: EnhancedLogEntry): void {
    const logFile =
      entry.level === LogLevel.ERROR ? "error.log" : "combined.log";
    const logPath = path.join(this.logDirectory, logFile);
    const formattedLog = this.formatStructuredLog(entry) + "\n";

    fs.appendFileSync(logPath, formattedLog);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: any,
    error?: Error
  ) {
    const entry: EnhancedLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error,
      service: "grub-api",
      environment: config.server.nodeEnv || "development",
      ...context,
    };

    const formattedLog = this.formatLog(entry);

    // Console output
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedLog);
        }
        break;
    }

    // File output (in production or when explicitly enabled)
    if (!this.isDevelopment || process.env.LOG_TO_FILE === "true") {
      this.writeToFile(entry);
    }
  }

  // Enhanced logging methods with context support
  error(message: string, context?: LogContext, error?: Error, data?: any) {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  warn(message: string, context?: LogContext, data?: any) {
    this.log(LogLevel.WARN, message, context, data);
  }

  info(message: string, context?: LogContext, data?: any) {
    this.log(LogLevel.INFO, message, context, data);
  }

  debug(message: string, context?: LogContext, data?: any) {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  // Request logging with automatic context extraction
  logRequest(req: Request, res: Response, responseTime?: number) {
    const context = this.extractRequestContext(req);
    context.statusCode = res.statusCode;
    context.responseTime = responseTime;

    const message = `${req.method} ${req.originalUrl || req.url} - ${
      res.statusCode
    }`;

    if (res.statusCode >= 400) {
      this.error(message, context);
    } else {
      this.info(message, context);
    }
  }

  // Security event logging
  logSecurityEvent(
    event: SecurityEvent,
    context?: LogContext,
    additionalData?: any
  ) {
    const message = `Security Event: ${event.type} - ${event.severity}`;
    const data = {
      securityEvent: event,
      ...additionalData,
    };

    if (event.severity === "critical" || event.severity === "high") {
      this.error(message, context, undefined, data);
    } else {
      this.warn(message, context, data);
    }
  }

  // Performance logging
  logPerformance(
    operation: string,
    metrics: PerformanceMetrics,
    context?: LogContext
  ) {
    const message = `Performance: ${operation} - ${metrics.responseTime}ms`;
    const data = {
      performance: metrics,
      operation,
    };

    if (metrics.responseTime > 5000) {
      // Slow operation threshold
      this.warn(message, context, data);
    } else {
      this.debug(message, context, data);
    }
  }

  // Database operation logging
  logDatabaseOperation(
    operation: string,
    collection: string,
    duration: number,
    context?: LogContext,
    error?: Error
  ) {
    const message = `Database: ${operation} on ${collection} - ${duration}ms`;
    const data = {
      database: {
        operation,
        collection,
        duration,
      },
    };

    if (error) {
      this.error(message, context, error, data);
    } else if (duration > 1000) {
      // Slow query threshold
      this.warn(message, context, data);
    } else {
      this.debug(message, context, data);
    }
  }

  // External API call logging
  logExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
    error?: Error
  ) {
    const message = `External API: ${method} ${service}${endpoint} - ${statusCode} - ${duration}ms`;
    const data = {
      externalApi: {
        service,
        endpoint,
        method,
        statusCode,
        duration,
      },
    };

    if (error || statusCode >= 400) {
      this.error(message, context, error, data);
    } else if (duration > 3000) {
      // Slow API call threshold
      this.warn(message, context, data);
    } else {
      this.info(message, context, data);
    }
  }

  // Rate limiting event logging
  logRateLimitEvent(
    deviceId: string,
    ip: string,
    endpoint: string,
    context?: LogContext
  ) {
    const message = `Rate limit exceeded for device ${deviceId} from IP ${ip} on ${endpoint}`;
    const data = {
      rateLimit: {
        deviceId,
        ip,
        endpoint,
        timestamp: new Date().toISOString(),
      },
    };

    this.logSecurityEvent(
      {
        type: "rate_limit_exceeded",
        severity: "medium",
        details: data.rateLimit,
      },
      context,
      data
    );
  }

  // Authentication event logging
  logAuthEvent(
    event: "login_success" | "login_failure" | "logout" | "token_refresh",
    userId?: string,
    context?: LogContext,
    additionalData?: any
  ) {
    const message = `Auth Event: ${event}${
      userId ? ` for user ${userId}` : ""
    }`;
    const data = {
      authEvent: {
        event,
        userId,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    };

    if (event === "login_failure") {
      this.logSecurityEvent(
        {
          type: "auth_failure",
          severity: "medium",
          details: data.authEvent,
        },
        context,
        data
      );
    } else {
      this.info(message, context, data);
    }
  }

  // Device tracking event logging
  logDeviceEvent(
    event: "device_registered" | "device_validated" | "device_suspicious",
    deviceId: string,
    context?: LogContext,
    additionalData?: any
  ) {
    const message = `Device Event: ${event} for device ${deviceId}`;
    const data = {
      deviceEvent: {
        event,
        deviceId,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    };

    if (event === "device_suspicious") {
      this.logSecurityEvent(
        {
          type: "suspicious_activity",
          severity: "high",
          details: data.deviceEvent,
        },
        context,
        data
      );
    } else {
      this.info(message, context, data);
    }
  }
}

// Create singleton instance
export const enhancedLogger = new EnhancedLogger();

// Export types for use in other modules
export type { LogContext, PerformanceMetrics, SecurityEvent };

// Utility functions for creating success/error responses with logging
export const createSuccessResponse = (
  message: string,
  data?: any,
  context?: LogContext
) => {
  if (context) {
    enhancedLogger.info(`Success: ${message}`, context, data);
  }

  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const createErrorResponse = (
  message: string,
  error?: string | Error,
  context?: LogContext,
  statusCode?: number
) => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorObj = error instanceof Error ? error : undefined;

  if (context) {
    enhancedLogger.error(`Error: ${message}`, context, errorObj, {
      statusCode,
      errorMessage,
    });
  }

  return {
    success: false,
    message,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };
};

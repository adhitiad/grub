import { config } from "../config/env";

export enum LogLevel {
  ERROR = "⛔ERROR",
  WARN = "⚠️ WARN",
  INFO = "ℹ️ INFO",
  DEBUG = "🐞 DEBUG",
}

interface LogEntry {
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
}

class Logger {
  private isDevelopment = config.server.nodeEnv === "development";

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, data, error, userId, requestId } = entry;

    let logMessage = `[${timestamp}] ${level}: ${message}`;

    if (userId) logMessage += ` | User: ${userId}`;
    if (requestId) logMessage += ` | Request: ${requestId}`;

    if (data && this.isDevelopment) {
      logMessage += ` | Data: ${JSON.stringify(data, null, 2)}`;
    }

    if (error) {
      logMessage += ` | Error: ${error.message}`;
      if (this.isDevelopment && error.stack) {
        logMessage += `\nStack: ${error.stack}`;
      }
    }

    return logMessage;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: any,
    error?: Error,
    userId?: string,
    requestId?: string
  ) {
    const entry: LogEntry = {
      service: "grub-api",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error,
      userId,
      requestId,
    };

    const formattedLog = this.formatLog(entry);

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
  }

  error(
    message: string,
    error?: Error,
    data?: any,
    userId?: string,
    requestId?: string
  ) {
    this.log(LogLevel.ERROR, message, data, error, userId, requestId);
  }

  warn(message: string, data?: any, userId?: string, requestId?: string) {
    this.log(LogLevel.WARN, message, data, undefined, userId, requestId);
  }

  info(message: string, data?: any, userId?: string, requestId?: string) {
    this.log(LogLevel.INFO, message, data, undefined, userId, requestId);
  }

  debug(message: string, data?: any, userId?: string, requestId?: string) {
    this.log(LogLevel.DEBUG, message, data, undefined, userId, requestId);
  }

  // Specific logging methods for common scenarios
  authSuccess(userId: string, action: string, requestId?: string) {
    this.info(
      `Authentication successful: ${action}`,
      { userId },
      userId,
      requestId
    );
  }

  authFailure(action: string, reason: string, requestId?: string) {
    this.warn(
      `Authentication failed: ${action}`,
      { reason },
      undefined,
      requestId
    );
  }

  apiRequest(
    method: string,
    path: string,
    userId?: string,
    requestId?: string
  ) {
    this.info(`API Request: ${method} ${path}`, undefined, userId, requestId);
  }

  apiResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    requestId?: string
  ) {
    this.info(
      `API Response: ${method} ${path} - ${statusCode} (${duration}ms)`,
      undefined,
      userId,
      requestId
    );
  }

  databaseOperation(
    operation: string,
    collection: string,
    success: boolean,
    userId?: string,
    requestId?: string
  ) {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Database ${operation} on ${collection}: ${
      success ? "SUCCESS" : "FAILED"
    }`;
    this.log(level, message, undefined, undefined, userId, requestId);
  }

  paymentOperation(
    operation: string,
    orderId: string,
    amount?: number,
    success?: boolean,
    userId?: string,
    requestId?: string
  ) {
    const level = success === false ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Payment ${operation} for order ${orderId}${
      amount ? ` (${amount})` : ""
    }`;
    this.log(
      level,
      message,
      { orderId, amount, success },
      undefined,
      userId,
      requestId
    );
  }
}

export const logger = new Logger();

// Response helper functions
export const createSuccessResponse = (message: string, data?: any) => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const createErrorResponse = (
  message: string,
  error?: string,
  details?: any
) => ({
  success: false,
  message,
  error,
  details,
  timestamp: new Date().toISOString(),
});

// Error classes for better error handling
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict") {
    super(message, 409);
  }
}

export default logger;

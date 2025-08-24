import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

// Extend Request interface to include device information
declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
      deviceFingerprint?: string;
      rateLimitInfo?: {
        deviceId: string;
        remaining: number;
        resetTime: Date;
        total: number;
      };
    }
  }
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface DeviceRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  trustProxy?: boolean;
  requireDeviceId?: boolean;
  fallbackToIp?: boolean;
  deviceIdHeaders?: string[];
}

class DeviceRateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private windowMs: number) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      this.set(key, existing);
      return existing;
    } else {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
        firstRequest: now,
      };
      this.set(key, newEntry);
      return newEntry;
    }
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

export class DeviceRateLimit {
  private store: DeviceRateLimitStore;
  private options: Required<DeviceRateLimitOptions>;

  constructor(options: DeviceRateLimitOptions) {
    this.options = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      maxRequests: options.maxRequests || 100,
      message:
        options.message ||
        "Too many requests from this device, please try again later.",
      statusCode: options.statusCode || 429,
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator.bind(this),
      onLimitReached: options.onLimitReached || (() => {}),
      trustProxy: options.trustProxy || false,
      requireDeviceId: options.requireDeviceId || false,
      fallbackToIp: options.fallbackToIp || true,
      deviceIdHeaders: options.deviceIdHeaders || [
        "x-device-id",
        "device-id",
        "x-client-id",
      ],
    };

    this.store = new DeviceRateLimitStore(this.options.windowMs);
  }

  private extractDeviceId(req: Request): string | null {
    // Try to get device ID from headers
    for (const header of this.options.deviceIdHeaders) {
      const deviceId = req.get(header);
      if (deviceId && this.isValidDeviceId(deviceId)) {
        return deviceId;
      }
    }
    return null;
  }

  private isValidDeviceId(deviceId: string): boolean {
    // Validate device ID format and security
    if (!deviceId || typeof deviceId !== "string") {
      return false;
    }

    // Check length (should be reasonable, not too short or too long)
    if (deviceId.length < 8 || deviceId.length > 128) {
      return false;
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9\-_]+$/.test(deviceId)) {
      return false;
    }

    // Prevent obvious spoofing attempts
    const suspiciousPatterns = [
      /^(test|fake|dummy|null|undefined|admin|root)$/i,
      /^(.)\1{7,}$/, // Repeated characters
      /^(0+|1+|a+|z+)$/i, // All same character
    ];

    return !suspiciousPatterns.some((pattern) => pattern.test(deviceId));
  }

  private generateDeviceFingerprint(req: Request): string {
    // Create a device fingerprint based on headers and other request properties
    const components = [
      req.get("user-agent") || "",
      req.get("accept-language") || "",
      req.get("accept-encoding") || "",
      req.get("accept") || "",
      this.getClientIp(req),
    ];

    const fingerprint = components.join("|");
    return createHash("sha256")
      .update(fingerprint)
      .digest("hex")
      .substring(0, 16);
  }

  private getClientIp(req: Request): string {
    if (this.options.trustProxy) {
      return req.ip || req.connection.remoteAddress || "unknown";
    }
    return (
      req.connection.remoteAddress || req.socket.remoteAddress || "unknown"
    );
  }

  private defaultKeyGenerator(req: Request): string {
    const deviceId = this.extractDeviceId(req);

    if (deviceId) {
      // Use device ID as primary key
      req.deviceId = deviceId;
      return `device:${deviceId}`;
    }

    if (this.options.requireDeviceId) {
      throw new Error("Device ID is required but not provided");
    }

    if (this.options.fallbackToIp) {
      // Fallback to IP-based limiting
      const ip = this.getClientIp(req);
      logger.warn(
        "Device ID not provided, falling back to IP-based rate limiting",
        { ip },
        req.user?.id,
        req.requestId
      );
      return `ip:${ip}`;
    }

    // Generate a temporary device fingerprint
    const fingerprint = this.generateDeviceFingerprint(req);
    req.deviceFingerprint = fingerprint;
    logger.warn(
      "Device ID not provided, using device fingerprint",
      { fingerprint },
      req.user?.id,
      req.requestId
    );
    return `fingerprint:${fingerprint}`;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.options.keyGenerator(req);
        const entry = this.store.increment(key);

        const remaining = Math.max(0, this.options.maxRequests - entry.count);
        const resetTime = new Date(entry.resetTime);

        // Add rate limit info to request
        req.rateLimitInfo = {
          deviceId: req.deviceId || "unknown",
          remaining,
          resetTime,
          total: this.options.maxRequests,
        };

        // Set rate limit headers
        res.set({
          "X-RateLimit-Limit": this.options.maxRequests.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": Math.ceil(entry.resetTime / 1000).toString(),
          "X-RateLimit-Window": this.options.windowMs.toString(),
        });

        if (entry.count > this.options.maxRequests) {
          // Rate limit exceeded
          logger.warn(
            "Rate limit exceeded",
            {
              key,
              count: entry.count,
              limit: this.options.maxRequests,
              resetTime: resetTime.toISOString(),
            },
            req.user?.id,
            req.requestId
          );

          this.options.onLimitReached(req, res);

          return res.status(this.options.statusCode).json({
            success: false,
            message: this.options.message,
            rateLimitInfo: {
              limit: this.options.maxRequests,
              remaining: 0,
              resetTime: resetTime.toISOString(),
              retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
            },
            timestamp: new Date().toISOString(),
          });
        }

        // Log successful rate limit check
        if (req.deviceId) {
          logger.debug(
            "Rate limit check passed",
            {
              deviceId: req.deviceId,
              count: entry.count,
              remaining,
            },
            req.user?.id,
            req.requestId
          );
        }

        next();
      } catch (error: any) {
        logger.error(
          "Rate limit middleware error",
          error,
          undefined,
          req.user?.id,
          req.requestId
        );

        if (
          error instanceof Error &&
          error.message.includes("Device ID is required")
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Device ID is required. Please include a valid device ID in the request headers.",
            requiredHeaders: this.options.deviceIdHeaders,
            timestamp: new Date().toISOString(),
          });
        }

        // On error, allow the request to proceed (fail open)
        next();
      }
    };
  }

  // Method to reset rate limit for a specific device
  resetDevice(deviceId: string): void {
    const key = `device:${deviceId}`;
    this.store.reset(key);
    logger.info("Rate limit reset for device", { deviceId });
  }

  // Method to get current rate limit status for a device
  getDeviceStatus(
    deviceId: string
  ): { count: number; remaining: number; resetTime: Date } | null {
    const key = `device:${deviceId}`;
    const entry = this.store.get(key);

    if (!entry) {
      return {
        count: 0,
        remaining: this.options.maxRequests,
        resetTime: new Date(Date.now() + this.options.windowMs),
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.options.maxRequests - entry.count),
      resetTime: new Date(entry.resetTime),
    };
  }

  // Cleanup method
  destroy(): void {
    this.store.destroy();
  }
}

// Factory function to create device rate limiter
export const createDeviceRateLimit = (options: DeviceRateLimitOptions) => {
  const rateLimiter = new DeviceRateLimit(options);
  return rateLimiter.middleware();
};

export default createDeviceRateLimit;

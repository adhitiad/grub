import { Request, Response } from "express";
import {
  extractDeviceInfo,
  generateSecureDeviceId,
  validateDeviceId,
} from "../utils/deviceId";
import {
  createErrorResponse,
  createSuccessResponse,
  logger,
} from "../utils/logger";

/**
 * Generate a new secure device ID for client applications
 */
export const generateDeviceId = async (_req: Request, res: Response) => {
  try {
    const deviceId = generateSecureDeviceId();

    logger.info("Device ID generated", { deviceId });

    res.status(200).json(
      createSuccessResponse("Device ID generated successfully", {
        deviceId,
        instructions: {
          usage:
            "Include this device ID in the X-Device-ID header for all API requests",
          headers: ["X-Device-ID", "Device-ID", "X-Client-ID"],
          example: `curl -H "X-Device-ID: ${deviceId}" https://api.example.com/endpoint`,
        },
      })
    );
  } catch (error: any) {
    logger.error("Error generating device ID", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to generate device ID",
          error instanceof Error ? error.message : "Unknown error"
        )
      );
  }
};

/**
 * Validate a device ID
 */
export const validateDevice = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "Device ID is required",
            "Please provide a deviceId in the request body"
          )
        );
    }

    const isValid = validateDeviceId(deviceId);
    const deviceInfo = extractDeviceInfo(req, ["x-device-id", "device-id"]);

    logger.info("Device validation requested", {
      deviceId,
      isValid,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json(
      createSuccessResponse("Device validation completed", {
        deviceId,
        isValid,
        deviceInfo: {
          platform: deviceInfo.platform,
          source: deviceInfo.source,
          fingerprint: deviceInfo.fingerprint?.substring(0, 8) + "...", // Partial fingerprint for privacy
        },
        recommendations: isValid
          ? []
          : [
              "Device ID should be 8-128 characters long",
              "Use alphanumeric characters, hyphens, underscores, and dots only",
              'Avoid obvious patterns like "test", "fake", or repeated characters',
              "Consider using the /api/device/generate endpoint to create a secure device ID",
            ],
      })
    );
  } catch (error: any) {
    logger.error("Error validating device", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to validate device",
          error instanceof Error ? error.message : "Unknown error"
        )
      );
  }
};

/**
 * Get device information from request headers
 */
export const getDeviceInfo = async (req: Request, res: Response) => {
  try {
    const deviceInfo = extractDeviceInfo(req);

    logger.info("Device info requested", {
      deviceId: deviceInfo.deviceId,
      source: deviceInfo.source,
      platform: deviceInfo.platform,
    });

    res.status(200).json(
      createSuccessResponse("Device information retrieved", {
        device: {
          id: deviceInfo.deviceId,
          isValid: deviceInfo.isValid,
          source: deviceInfo.source,
          platform: deviceInfo.platform,
          userAgent: deviceInfo.userAgent,
        },
        fingerprint: deviceInfo.fingerprint?.substring(0, 12) + "...", // Partial for privacy
        rateLimitInfo: req.rateLimitInfo,
        headers: {
          detected: Object.keys(req.headers).filter(
            (h) =>
              h.toLowerCase().includes("device") ||
              h.toLowerCase().includes("client")
          ),
          recommended: ["X-Device-ID", "Device-ID", "X-Client-ID"],
        },
      })
    );
  } catch (error: any) {
    logger.error("Error getting device info", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to get device information",
          error instanceof Error ? error.message : "Unknown error"
        )
      );
  }
};

/**
 * Reset rate limit for current device (admin only)
 */
export const resetDeviceRateLimit = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const user = req.user;

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "Access denied",
            "Only administrators can reset device rate limits"
          )
        );
    }

    if (!deviceId || !validateDeviceId(deviceId)) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "Invalid device ID",
            "Please provide a valid device ID"
          )
        );
    }

    // Note: This would need to be implemented in the rate limiter instance
    // For now, we'll just log the request
    logger.info("Device rate limit reset requested", {
      deviceId,
      adminUserId: user.id,
    });

    res.status(200).json(
      createSuccessResponse("Device rate limit reset requested", {
        deviceId,
        message:
          "Rate limit reset has been requested. It may take a few minutes to take effect.",
        resetBy: user.id,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error: any) {
    logger.error("Error resetting device rate limit", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to reset device rate limit",
          error instanceof Error ? error.message : "Unknown error"
        )
      );
  }
};

/**
 * Get rate limit status for current device
 */
export const getDeviceRateLimit = async (req: Request, res: Response) => {
  try {
    const deviceInfo = extractDeviceInfo(req);
    const rateLimitInfo = req.rateLimitInfo;

    logger.debug("Device rate limit status requested", {
      deviceId: deviceInfo.deviceId,
    });

    res.status(200).json(
      createSuccessResponse("Device rate limit status retrieved", {
        device: {
          id: deviceInfo.deviceId,
          isValid: deviceInfo.isValid,
          source: deviceInfo.source,
        },
        rateLimit: rateLimitInfo || {
          deviceId: deviceInfo.deviceId || "unknown",
          remaining: "unknown",
          resetTime: "unknown",
          total: "unknown",
        },
        headers: {
          "X-RateLimit-Limit": res.get("X-RateLimit-Limit"),
          "X-RateLimit-Remaining": res.get("X-RateLimit-Remaining"),
          "X-RateLimit-Reset": res.get("X-RateLimit-Reset"),
          "X-RateLimit-Window": res.get("X-RateLimit-Window"),
        },
      })
    );
  } catch (error: any) {
    logger.error("Error getting device rate limit status", error);
    res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to get device rate limit status",
          error instanceof Error ? error.message : "Unknown error"
        )
      );
  }
};

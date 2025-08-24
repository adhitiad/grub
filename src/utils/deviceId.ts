import { createHash, randomBytes } from 'crypto';
import { Request } from 'express';

export interface DeviceInfo {
  deviceId?: string;
  fingerprint?: string;
  userAgent?: string;
  platform?: string;
  isValid: boolean;
  source: 'header' | 'fingerprint' | 'generated';
}

/**
 * Validates a device ID for security and format compliance
 */
export function validateDeviceId(deviceId: string): boolean {
  if (!deviceId || typeof deviceId !== 'string') {
    return false;
  }

  // Check length constraints
  if (deviceId.length < 8 || deviceId.length > 128) {
    return false;
  }

  // Allow alphanumeric characters, hyphens, underscores, and dots
  if (!/^[a-zA-Z0-9\-_.]+$/.test(deviceId)) {
    return false;
  }

  // Prevent obvious spoofing attempts
  const suspiciousPatterns = [
    /^(test|fake|dummy|null|undefined|admin|root|anonymous|guest)$/i,
    /^(.)\1{7,}$/, // Repeated characters (8 or more)
    /^(0+|1+|a+|z+|x+)$/i, // All same character
    /^(12345|abcde|qwerty|password|default)$/i, // Common patterns
    /^[0-9]{1,10}$/, // Simple sequential numbers
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(deviceId));
}

/**
 * Generates a device fingerprint based on request headers
 */
export function generateDeviceFingerprint(req: Request): string {
  const components = [
    req.get('user-agent') || '',
    req.get('accept-language') || '',
    req.get('accept-encoding') || '',
    req.get('accept') || '',
    req.get('sec-ch-ua') || '',
    req.get('sec-ch-ua-platform') || '',
    req.ip || req.connection.remoteAddress || '',
  ];

  const fingerprint = components.join('|');
  return createHash('sha256').update(fingerprint).digest('hex').substring(0, 24);
}

/**
 * Extracts device information from request headers
 */
export function extractDeviceInfo(req: Request, deviceIdHeaders: string[] = ['x-device-id', 'device-id']): DeviceInfo {
  // Try to extract device ID from headers
  let deviceId: string | undefined;
  let source: 'header' | 'fingerprint' | 'generated' = 'header';

  for (const header of deviceIdHeaders) {
    const headerValue = req.get(header);
    if (headerValue && validateDeviceId(headerValue)) {
      deviceId = headerValue;
      break;
    }
  }

  // If no valid device ID found, generate fingerprint
  if (!deviceId) {
    deviceId = generateDeviceFingerprint(req);
    source = 'fingerprint';
  }

  return {
    deviceId,
    fingerprint: source === 'fingerprint' ? deviceId : generateDeviceFingerprint(req),
    userAgent: req.get('user-agent'),
    platform: req.get('sec-ch-ua-platform') || extractPlatformFromUserAgent(req.get('user-agent')),
    isValid: source === 'header' && validateDeviceId(deviceId),
    source
  };
}

/**
 * Extracts platform information from User-Agent string
 */
function extractPlatformFromUserAgent(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();
  
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('chrome os')) return 'Chrome OS';
  
  return 'unknown';
}

/**
 * Generates a secure device ID for client applications
 */
export function generateSecureDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(16).toString('hex');
  return `${timestamp}-${randomPart}`;
}

/**
 * Creates a device tracking key for rate limiting
 */
export function createDeviceTrackingKey(deviceInfo: DeviceInfo): string {
  if (deviceInfo.isValid && deviceInfo.deviceId) {
    return `device:${deviceInfo.deviceId}`;
  }
  
  // Fallback to fingerprint-based tracking
  return `fingerprint:${deviceInfo.fingerprint}`;
}

/**
 * Validates device ID format for different platforms
 */
export function validatePlatformDeviceId(deviceId: string, platform?: string): boolean {
  if (!validateDeviceId(deviceId)) {
    return false;
  }

  // Platform-specific validation rules
  switch (platform?.toLowerCase()) {
    case 'android':
      // Android device IDs are typically UUIDs or similar
      return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(deviceId) ||
             /^[a-f0-9]{16}$/i.test(deviceId);
    
    case 'ios':
      // iOS identifierForVendor format
      return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(deviceId);
    
    case 'web':
      // Web-based device IDs can be more flexible
      return deviceId.length >= 16 && deviceId.length <= 64;
    
    default:
      // Generic validation
      return true;
  }
}

/**
 * Sanitizes device ID to prevent injection attacks
 */
export function sanitizeDeviceId(deviceId: string): string {
  if (!deviceId) return '';
  
  // Remove any potentially dangerous characters
  return deviceId.replace(/[^a-zA-Z0-9\-_.]/g, '').substring(0, 128);
}

/**
 * Checks if a device ID appears to be spoofed or fake
 */
export function detectSpoofedDeviceId(deviceId: string, userAgent?: string): boolean {
  if (!validateDeviceId(deviceId)) {
    return true;
  }

  // Check for patterns that suggest spoofing
  const spoofingIndicators = [
    // Too simple patterns
    /^(.)\1+$/, // All same character
    /^(abc|123|test|fake|null|undefined)$/i,
    
    // Sequential patterns
    /^(abcdef|123456|qwerty)$/i,
    
    // Common test values
    /^(device|client|mobile|browser)$/i,
  ];

  if (spoofingIndicators.some(pattern => pattern.test(deviceId))) {
    return true;
  }

  // Check consistency with User-Agent
  if (userAgent) {
    const platform = extractPlatformFromUserAgent(userAgent);
    if (!validatePlatformDeviceId(deviceId, platform)) {
      return true;
    }
  }

  return false;
}

export default {
  validateDeviceId,
  generateDeviceFingerprint,
  extractDeviceInfo,
  generateSecureDeviceId,
  createDeviceTrackingKey,
  validatePlatformDeviceId,
  sanitizeDeviceId,
  detectSpoofedDeviceId
};

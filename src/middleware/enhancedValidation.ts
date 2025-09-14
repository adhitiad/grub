import { NextFunction, Request, Response } from "express";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import { createErrorResponse, enhancedLogger } from "../utils/enhancedLogger";

// Extend Request interface for file upload support
declare global {
  namespace Express {
    interface Request {
      files?: any;
      file?: any;
    }
  }
}

// Security patterns for input validation
const SECURITY_PATTERNS = {
  SQL_INJECTION: [
    new RegExp(
      "('|\\\\')|(;|\\\\;)|(--|/\\*)|\\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UNION|UPDATE)\\b",
      "i"
    ),
    new RegExp("\\b(OR|AND)\\b\\s*\\d+\\s*=\\s*\\d+", "i"),
    new RegExp("\\b(OR|AND)\\b\\s*['\"]\\w+['\"]\\s*=\\s*['\"]\\w+['\"]", "i"),
    new RegExp("union\\s+select|union\\s+all\\s+select", "i"),
    new RegExp("drop\\s+table|truncate\\s+table", "i"),
  ],
  XSS: [
    new RegExp("<script\\b[^<]*(?:(?!</script>)<[^<]*)*</script>", "gi"),
    new RegExp("<iframe\\b[^<]*(?:(?!</iframe>)<[^<]*)*</iframe>", "gi"),
    new RegExp("javascript:", "gi"),
    new RegExp("on\\w+\\s*=", "gi"),
    new RegExp("<img[^>]+src\\s*=\\s*[\"']javascript:", "gi"),
    new RegExp("<svg[^>]*onload[^>]*>", "gi"),
    new RegExp("<object[^>]*data[^>]*>", "gi"),
  ],
  COMMAND_INJECTION: [
    new RegExp("[;&|`$(){}\\[\\]\\\\]"),
    new RegExp(
      "\\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|curl|wget|nc|nmap|rm|mv|cp|chmod|chown)\\b",
      "i"
    ),
    new RegExp("(\\||&&|;|\\$\\(|`)"),
  ],
  PATH_TRAVERSAL: [
    new RegExp("\\.\\.[/\\\\]"),
    new RegExp("[/\\\\]\\.\\.[/\\\\]"),
    new RegExp("%2e%2e[/\\\\]", "i"),
    new RegExp("%252e%252e[/\\\\]", "i"),
    new RegExp("\\.\\.%2f", "i"),
    new RegExp("\\.\\.%5c", "i"),
  ],
  LDAP_INJECTION: [
    new RegExp("[()=*!&|]"),
    new RegExp("\\*\\)"),
    new RegExp("\\(\\|"),
  ],
  NOSQL_INJECTION: [
    new RegExp("\\$where", "i"),
    new RegExp("\\$ne", "i"),
    new RegExp("\\$gt", "i"),
    new RegExp("\\$lt", "i"),
    new RegExp("\\$regex", "i"),
    new RegExp("\\$or", "i"),
    new RegExp("\\$and", "i"),
  ],
};

// Suspicious patterns that might indicate malicious intent
const SUSPICIOUS_PATTERNS = [
  new RegExp(
    "\\b(admin|root|administrator|system|test|demo|guest|null|undefined)\\b",
    "i"
  ),
  new RegExp("\\b(password|passwd|pwd|secret|key|token|auth)\\b", "i"),
  new RegExp("^(.)\\1{10,}$"), // Repeated characters (10 or more)
  new RegExp("[^\\x20-\\x7E\\u00A0-\\uFFFF]", "g"), // Non-printable characters (excluding Unicode)
  new RegExp("\\b(eval|exec|system|shell_exec|passthru|proc_open)\\b", "i"),
  new RegExp("(base64_decode|base64_encode|urldecode|urlencode)", "i"),
];

interface ValidationOptions {
  sanitize?: boolean;
  maxLength?: number;
  allowHtml?: boolean;
  strictMode?: boolean;
  logSuspicious?: boolean;
  checkSqlInjection?: boolean;
  checkXss?: boolean;
  checkCommandInjection?: boolean;
  checkPathTraversal?: boolean;
}

interface SecurityIssue {
  type: string;
  field: string;
  pattern: string;
  value: string;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Enhanced request validation middleware with comprehensive security checks
 */
export const enhancedValidateRequest = (
  schema: z.ZodSchema,
  options: ValidationOptions = {}
) => {
  const defaultOptions: ValidationOptions = {
    sanitize: true,
    maxLength: 10000,
    allowHtml: false,
    strictMode: false,
    logSuspicious: true,
    checkSqlInjection: true,
    checkXss: true,
    checkCommandInjection: true,
    checkPathTraversal: true,
    ...options,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const context = enhancedLogger.extractRequestContext(req);

    try {
      // Pre-validation security checks
      const securityIssues = performSecurityValidation(
        req.body,
        defaultOptions
      );

      if (securityIssues.length > 0) {
        const criticalIssues = securityIssues.filter(
          (issue) => issue.severity === "critical"
        );
        const highIssues = securityIssues.filter(
          (issue) => issue.severity === "high"
        );

        if (criticalIssues.length > 0 || highIssues.length > 0) {
          enhancedLogger.logSecurityEvent(
            {
              type: "input_validation_failed",
              severity: criticalIssues.length > 0 ? "critical" : "high",
              details: {
                issues: securityIssues,
                body: defaultOptions.strictMode ? "[REDACTED]" : req.body,
                endpoint: req.originalUrl,
                userAgent: req.get("user-agent"),
                ip: req.ip,
              },
            },
            context
          );

          return res
            .status(400)
            .json(
              createErrorResponse(
                "Input validation failed",
                "Potentially malicious input detected",
                context,
                400
              )
            );
        } else if (defaultOptions.logSuspicious) {
          // Log medium/low severity issues but don't block
          enhancedLogger.logSecurityEvent(
            {
              type: "suspicious_activity",
              severity: "medium",
              details: {
                issues: securityIssues,
                endpoint: req.originalUrl,
              },
            },
            context
          );
        }
      }

      // Check input length limits
      const lengthIssues = checkInputLengths(
        req.body,
        defaultOptions.maxLength!
      );
      if (lengthIssues.length > 0) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "Input too long",
              `Maximum input length is ${defaultOptions.maxLength} characters`,
              context,
              400
            )
          );
      }

      // Sanitize input if requested
      if (defaultOptions.sanitize) {
        req.body = sanitizeInput(req.body, defaultOptions);
      }

      // Validate with Zod schema
      const validatedData = schema.parse(req.body);
      req.body = validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const zodError = error as any; // Type assertion for Zod error
        enhancedLogger.warn("Validation error", context, {
          errors: zodError.errors || zodError.issues || [],
          body: defaultOptions.strictMode ? "[REDACTED]" : req.body,
        });

        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: (zodError.errors || zodError.issues || []).map(
            (err: any) => ({
              field: err.path.join("."),
              message: err.message,
              code: err.code,
            })
          ),
          correlationId: (req as any).correlationId,
          timestamp: new Date().toISOString(),
        });
      }

      enhancedLogger.error(
        "Unexpected validation error",
        context,
        error instanceof Error ? error : new Error(String(error))
      );
      next(error);
    }
  };
};

/**
 * Perform comprehensive security validation on input data
 */
function performSecurityValidation(
  data: any,
  options: ValidationOptions
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  function checkValue(value: any, field: string) {
    if (typeof value !== "string") return;

    // SQL Injection checks
    if (options.checkSqlInjection) {
      SECURITY_PATTERNS.SQL_INJECTION.forEach((pattern, index) => {
        if (pattern.test(value)) {
          issues.push({
            type: "sql_injection",
            field,
            pattern: pattern.toString(),
            value: value.substring(0, 100),
            severity: "critical",
          });
        }
      });
    }

    // XSS checks
    if (options.checkXss) {
      SECURITY_PATTERNS.XSS.forEach((pattern, index) => {
        if (pattern.test(value)) {
          issues.push({
            type: "xss",
            field,
            pattern: pattern.toString(),
            value: value.substring(0, 100),
            severity: "high",
          });
        }
      });
    }

    // Command Injection checks
    if (options.checkCommandInjection) {
      SECURITY_PATTERNS.COMMAND_INJECTION.forEach((pattern, index) => {
        if (pattern.test(value)) {
          issues.push({
            type: "command_injection",
            field,
            pattern: pattern.toString(),
            value: value.substring(0, 100),
            severity: "critical",
          });
        }
      });
    }

    // Path Traversal checks
    if (options.checkPathTraversal) {
      SECURITY_PATTERNS.PATH_TRAVERSAL.forEach((pattern, index) => {
        if (pattern.test(value)) {
          issues.push({
            type: "path_traversal",
            field,
            pattern: pattern.toString(),
            value: value.substring(0, 100),
            severity: "high",
          });
        }
      });
    }

    // NoSQL Injection checks
    SECURITY_PATTERNS.NOSQL_INJECTION.forEach((pattern, index) => {
      if (pattern.test(value)) {
        issues.push({
          type: "nosql_injection",
          field,
          pattern: pattern.toString(),
          value: value.substring(0, 100),
          severity: "high",
        });
      }
    });

    // LDAP Injection checks
    SECURITY_PATTERNS.LDAP_INJECTION.forEach((pattern, index) => {
      if (pattern.test(value)) {
        issues.push({
          type: "ldap_injection",
          field,
          pattern: pattern.toString(),
          value: value.substring(0, 100),
          severity: "medium",
        });
      }
    });

    // Suspicious pattern checks
    if (options.logSuspicious) {
      SUSPICIOUS_PATTERNS.forEach((pattern, index) => {
        if (pattern.test(value)) {
          issues.push({
            type: "suspicious_pattern",
            field,
            pattern: pattern.toString(),
            value: value.substring(0, 100),
            severity: "low",
          });
        }
      });
    }
  }

  function traverse(obj: any, path: string = "") {
    if (obj === null || obj === undefined) return;

    if (typeof obj === "string") {
      checkValue(obj, path);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    } else if (typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        const newPath = path ? `${path}.${key}` : key;
        traverse(obj[key], newPath);
      });
    }
  }

  traverse(data);
  return issues;
}

/**
 * Check input length limits
 */
function checkInputLengths(data: any, maxLength: number): string[] {
  const issues: string[] = [];

  function traverse(obj: any, path: string = "") {
    if (obj === null || obj === undefined) return;

    if (typeof obj === "string" && obj.length > maxLength) {
      issues.push(`${path}: ${obj.length} characters (max: ${maxLength})`);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    } else if (typeof obj === "object") {
      Object.keys(obj).forEach((key) => {
        const newPath = path ? `${path}.${key}` : key;
        traverse(obj[key], newPath);
      });
    }
  }

  traverse(data);
  return issues;
}

/**
 * Sanitize input data
 */
function sanitizeInput(data: any, options: ValidationOptions): any {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    let sanitized = data;

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, "");

    // HTML sanitization
    if (!options.allowHtml) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
    } else {
      sanitized = DOMPurify.sanitize(sanitized);
    }

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  } else if (Array.isArray(data)) {
    return data.map((item) => sanitizeInput(item, options));
  } else if (typeof data === "object") {
    const sanitized: any = {};
    Object.keys(data).forEach((key) => {
      sanitized[key] = sanitizeInput(data[key], options);
    });
    return sanitized;
  }

  return data;
}

/**
 * Middleware for rate limiting validation requests
 */
export const validationRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // This would integrate with the device-based rate limiting
  // For now, we'll just add headers to track validation attempts
  const validationAttempts =
    parseInt(req.get("x-validation-attempts") || "0") + 1;

  if (validationAttempts > 10) {
    const context = enhancedLogger.extractRequestContext(req);
    enhancedLogger.logSecurityEvent(
      {
        type: "suspicious_activity",
        severity: "medium",
        details: {
          reason: "Excessive validation attempts",
          attempts: validationAttempts,
          endpoint: req.originalUrl,
        },
      },
      context
    );
  }

  res.set("X-Validation-Attempts", validationAttempts.toString());
  next();
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    maxFiles?: number;
  } = {}
) => {
  const defaultOptions = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
    maxFiles: 5,
    ...options,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const context = enhancedLogger.extractRequestContext(req);

    // This would be implemented when file upload is added
    // For now, just log the attempt
    if (req.files || req.file) {
      enhancedLogger.info("File upload attempt detected", context, {
        files: req.files,
        file: req.file,
      });
    }

    next();
  };
};

export default {
  enhancedValidateRequest,
  validationRateLimit,
  validateFileUpload,
};

import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().default("8520").transform(Number),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Firebase Configuration
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  FIREBASE_CLIENT_EMAIL: z
    .string()
    .email("FIREBASE_CLIENT_EMAIL must be a valid email"),

  // JWT Configuration
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_EXPIRES_IN: z.string().default("1d"),

  // Flip Payment Configuration
  FLIP_SECRET_KEY: z.string().optional(),
  FLIP_VALIDATION_TOKEN: z.string().optional(),

  // API Configuration
  API_BASE_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default("900000").transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100").transform(Number),

  // Device-based Rate Limiting
  DEVICE_RATE_LIMIT_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  DEVICE_RATE_LIMIT_REQUIRE_DEVICE_ID: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  DEVICE_RATE_LIMIT_FALLBACK_TO_IP: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  DEVICE_RATE_LIMIT_WINDOW_MS: z.string().default("900000").transform(Number),
  DEVICE_RATE_LIMIT_MAX_REQUESTS: z.string().default("100").transform(Number),

  // Email Configuration
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.string().default("587").transform(Number),
  EMAIL_SECURE: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("Grub Distributor"),
});

// Validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Environment validation failed:");
    error.issues.forEach((err: z.ZodIssue) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Export validated environment variables
export const config = {
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    apiBaseUrl: env.API_BASE_URL,
    frontendUrl: env.FRONTEND_URL,
    baseUrl: env.API_BASE_URL,
  },
  email: {
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    user: env.EMAIL_USER,
    password: env.EMAIL_PASSWORD,
    from: env.EMAIL_FROM,
    fromName: env.EMAIL_FROM_NAME,
  },
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  flip: {
    secretKey: env.FLIP_SECRET_KEY,
    validationToken: env.FLIP_VALIDATION_TOKEN,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  deviceRateLimit: {
    enabled: env.DEVICE_RATE_LIMIT_ENABLED,
    requireDeviceId: env.DEVICE_RATE_LIMIT_REQUIRE_DEVICE_ID,
    fallbackToIp: env.DEVICE_RATE_LIMIT_FALLBACK_TO_IP,
    windowMs: env.DEVICE_RATE_LIMIT_WINDOW_MS,
    maxRequests: env.DEVICE_RATE_LIMIT_MAX_REQUESTS,
  },
};

// Validate critical configurations
if (config.server.nodeEnv === "production") {
  if (!config.flip.secretKey || !config.flip.validationToken) {
    console.warn(
      "⚠️  Warning: Flip payment configuration is missing in production"
    );
  }

  if (config.jwt.secret.length < 64) {
    console.warn(
      "⚠️  Warning: JWT_SECRET should be at least 64 characters in production"
    );
  }
}

console.log("✅ Environment configuration loaded successfully");
export default config;

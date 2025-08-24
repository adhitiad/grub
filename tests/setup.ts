// Test setup file
import dotenv from "dotenv";

// Load test environment variables first
dotenv.config({ path: ".env.test" });

// Mock the config module before it's imported
jest.mock("../src/config/env", () => ({
  config: {
    server: {
      port: 3001,
      nodeEnv: "test",
      apiBaseUrl: "http://localhost:3001",
      frontendUrl: "http://localhost:3000",
    },
    firebase: {
      projectId: "test-project",
      privateKey: "test-private-key",
      clientEmail: "test@test.com",
    },
    jwt: {
      secret: "test-jwt-secret-key-for-testing-purposes-only-minimum-32-chars",
      expiresIn: "1h",
    },
    flip: {
      secretKey: "test-flip-secret",
      validationToken: "test-flip-token",
    },
    rateLimit: {
      windowMs: 900000,
      maxRequests: 1000,
    },
    deviceRateLimit: {
      enabled: false,
      requireDeviceId: false,
      fallbackToIp: true,
      windowMs: 900000,
      maxRequests: 1000,
    },
  },
}));

// Mock Firebase Admin SDK for tests
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      add: jest.fn(),
      get: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn(),
        limit: jest.fn(() => ({
          get: jest.fn(),
        })),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

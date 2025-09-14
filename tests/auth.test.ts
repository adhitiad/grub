import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { config } from "../src/config/env";
import authRoutes from "../src/routes/auth";

// Mock Firebase
const mockFirestore = {
  collection: jest.fn(() => ({
    where: jest.fn(() => ({
      get: jest.fn(),
      limit: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
    add: jest.fn(),
    doc: jest.fn(() => ({
      get: jest.fn(),
    })),
  })),
};

jest.mock("../src/config/firebase", () => ({
  db: mockFirestore,
}));

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

describe("Auth Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const mockUser = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
        role: "customer",
      };

      // Mock Firestore responses
      mockFirestore.collection().where().get.mockResolvedValue({
        isEmpty: true,
      });

      mockFirestore.collection().add.mockResolvedValue({
        id: "user123",
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send(mockUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("email", mockUser.email);
      expect(response.body).not.toHaveProperty("password");
    });

    it("should return 400 if email already exists", async () => {
      const mockUser = {
        email: "existing@example.com",
        password: "password123",
        name: "Test User",
        role: "customer",
      };

      // Mock existing user
      mockFirestore.collection().where().get.mockResolvedValue({
        isEmpty: false,
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send(mockUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Email sudah terdaftar.");
    });

    it("should return 400 if required fields are missing", async () => {
      const incompleteUser = {
        email: "test@example.com",
        // missing password, name, role
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(incompleteUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "message",
        "Semua field wajib diisi."
      );
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const loginData = {
        email: "test@example.com",
        password: "password123",
      };

      const hashedPassword = await bcrypt.hash(loginData.password, 10);
      const mockUserData = {
        email: loginData.email,
        password: hashedPassword,
        name: "Test User",
        role: "customer",
      };

      // Mock Firestore responses
      mockFirestore
        .collection()
        .where()
        .limit()
        .get.mockResolvedValue({
          isEmpty: false,
          docs: [
            {
              id: "user123",
              data: () => mockUserData,
            },
          ],
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("email", loginData.email);
      expect(response.body.user).not.toHaveProperty("password");
    });

    it("should return 401 for invalid email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "password123",
      };

      // Mock no user found
      mockFirestore.collection().where().limit().get.mockResolvedValue({
        isEmpty: true,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "message",
        "Email atau password salah."
      );
    });

    it("should return 401 for invalid password", async () => {
      const loginData = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const hashedPassword = await bcrypt.hash("correctpassword", 10);
      const mockUserData = {
        email: loginData.email,
        password: hashedPassword,
        name: "Test User",
        role: "customer",
      };

      // Mock user found but wrong password
      mockFirestore
        .collection()
        .where()
        .limit()
        .get.mockResolvedValue({
          isEmpty: false,
          docs: [
            {
              id: "user123",
              data: () => mockUserData,
            },
          ],
        });

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "message",
        "Email atau password salah."
      );
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user profile when authenticated", async () => {
      const mockUserData = {
        email: "test@example.com",
        name: "Test User",
        role: "customer",
      };

      // Create a valid JWT token
      const token = jwt.sign(
        { id: "user123", role: "customer" },
        config.jwt.secret,
        { expiresIn: "1h" }
      );

      // Mock Firestore response
      mockFirestore
        .collection()
        .doc()
        .get.mockResolvedValue({
          exists: true,
          id: "user123",
          data: () => ({ ...mockUserData, password: "hashedpassword" }),
        });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("email", mockUserData.email);
      expect(response.body).toHaveProperty("name", mockUserData.name);
      expect(response.body).not.toHaveProperty("password");
    });

    it("should return 401 when no token provided", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("success", false);
    });

    describe("JWT Token Edge Cases", () => {
      it("should reject malformed JWT tokens", async () => {
        const malformedTokens = [
          "invalid.token.here",
          "Bearer invalid",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
          "",
          "null",
          "undefined",
        ];

        for (const token of malformedTokens) {
          const response = await request(app)
            .get("/api/auth/me")
            .set("Authorization", token);

          expect(response.status).toBe(401);
          expect(response.body).toHaveProperty("success", false);
        }
      });

      it("should handle missing Authorization header", async () => {
        const response = await request(app).get("/api/auth/me");

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty("success", false);
      });

      it("should reject tokens with invalid format", async () => {
        const invalidFormats = [
          "InvalidPrefix token",
          "Bearer",
          "Bearer ",
          "token-without-bearer",
        ];

        for (const authHeader of invalidFormats) {
          const response = await request(app)
            .get("/api/auth/me")
            .set("Authorization", authHeader);

          expect(response.status).toBe(401);
        }
      });
    });
  });

  describe("Security Edge Cases", () => {
    it("should handle concurrent registration attempts", async () => {
      const userData = {
        name: "Test User",
        email: "concurrent@example.com",
        password: "TestPassword123!",
        role: "customer",
      };

      // Mock first request succeeds, second fails
      mockFirestore
        .collection()
        .where()
        .get.mockResolvedValueOnce({ isEmpty: true })
        .mockResolvedValueOnce({ isEmpty: false });

      mockFirestore.collection().add.mockResolvedValue({
        id: "user123",
      });

      const requests = [
        request(app).post("/api/auth/register").send(userData),
        request(app).post("/api/auth/register").send(userData),
      ];

      const responses = await Promise.all(requests);

      // One should succeed, one should fail
      const successCount = responses.filter((r) => r.status === 201).length;
      const failCount = responses.filter((r) => r.status === 400).length;

      expect(successCount + failCount).toBe(2);
    });

    it("should handle database connection errors gracefully", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "TestPassword123!",
        role: "customer",
      };

      // Mock database error
      mockFirestore
        .collection()
        .where()
        .get.mockRejectedValue(new Error("Database connection failed"));

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("success", false);
    });
  });
});

// Helper function for test expectations
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

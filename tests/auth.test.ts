import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRoutes from '../src/routes/auth';
import { config } from '../src/config/env';

// Mock Firebase
const mockFirestore = {
  collection: jest.fn(() => ({
    where: jest.fn(() => ({
      get: jest.fn(),
      limit: jest.fn(() => ({
        get: jest.fn()
      }))
    })),
    add: jest.fn(),
    doc: jest.fn(() => ({
      get: jest.fn()
    }))
  }))
};

jest.mock('../src/config/firebase', () => ({
  db: mockFirestore
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'customer'
      };

      // Mock Firestore responses
      mockFirestore.collection().where().get.mockResolvedValue({
        isEmpty: true
      });
      
      mockFirestore.collection().add.mockResolvedValue({
        id: 'user123'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', mockUser.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 400 if email already exists', async () => {
      const mockUser = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'customer'
      };

      // Mock existing user
      mockFirestore.collection().where().get.mockResolvedValue({
        isEmpty: false
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email sudah terdaftar.');
    });

    it('should return 400 if required fields are missing', async () => {
      const incompleteUser = {
        email: 'test@example.com'
        // missing password, name, role
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Semua field wajib diisi.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const hashedPassword = await bcrypt.hash(loginData.password, 10);
      const mockUserData = {
        email: loginData.email,
        password: hashedPassword,
        name: 'Test User',
        role: 'customer'
      };

      // Mock Firestore responses
      mockFirestore.collection().where().limit().get.mockResolvedValue({
        isEmpty: false,
        docs: [{
          id: 'user123',
          data: () => mockUserData
        }]
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', loginData.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 for invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Mock no user found
      mockFirestore.collection().where().limit().get.mockResolvedValue({
        isEmpty: true
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Email atau password salah.');
    });

    it('should return 401 for invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUserData = {
        email: loginData.email,
        password: hashedPassword,
        name: 'Test User',
        role: 'customer'
      };

      // Mock user found but wrong password
      mockFirestore.collection().where().limit().get.mockResolvedValue({
        isEmpty: false,
        docs: [{
          id: 'user123',
          data: () => mockUserData
        }]
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Email atau password salah.');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile when authenticated', async () => {
      const mockUserData = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'customer'
      };

      // Create a valid JWT token
      const token = jwt.sign(
        { id: 'user123', role: 'customer' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Mock Firestore response
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        id: 'user123',
        data: () => ({ ...mockUserData, password: 'hashedpassword' })
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', mockUserData.email);
      expect(response.body).toHaveProperty('name', mockUserData.name);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when no token provided', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 when invalid token provided', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});

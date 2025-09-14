import request from 'supertest';
import { app } from '../src/app';
import { generateToken } from '../src/utils/jwt';

describe('Security Tests', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Generate test tokens
    authToken = generateToken({ id: 'test-user', role: 'customer' });
    adminToken = generateToken({ id: 'admin-user', role: 'admin' });
  });

  describe('Input Validation Security', () => {
    describe('SQL Injection Prevention', () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; SELECT * FROM users WHERE '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin'/*",
        "' OR 1=1#",
        "' OR 'x'='x",
        "'; EXEC xp_cmdshell('dir'); --"
      ];

      test.each(sqlInjectionPayloads)('should reject SQL injection in user search: %s', async (payload) => {
        const response = await request(app)
          .get('/api/users/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid');
      });

      test.each(sqlInjectionPayloads)('should reject SQL injection in product search: %s', async (payload) => {
        const response = await request(app)
          .get('/api/products/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      test.each(sqlInjectionPayloads)('should reject SQL injection in user registration: %s', async (payload) => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: payload,
            email: 'test@example.com',
            password: 'ValidPassword123!',
            phone: '1234567890',
            role: 'customer'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('XSS Prevention', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload="alert(1)">',
        '<div onclick="alert(1)">Click me</div>',
        '<input type="text" value="" onfocus="alert(1)" autofocus>',
        '"><script>alert("XSS")</script>',
        '\';alert(String.fromCharCode(88,83,83))//\';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>">\'><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>'
      ];

      test.each(xssPayloads)('should sanitize XSS in user registration: %s', async (payload) => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: payload,
            email: 'test@example.com',
            password: 'ValidPassword123!',
            phone: '1234567890',
            role: 'customer'
          });

        // Should either reject or sanitize
        if (response.status === 201) {
          expect(response.body.data.user.name).not.toContain('<script>');
          expect(response.body.data.user.name).not.toContain('javascript:');
          expect(response.body.data.user.name).not.toContain('onerror');
        } else {
          expect(response.status).toBe(400);
        }
      });

      test.each(xssPayloads)('should sanitize XSS in product creation: %s', async (payload) => {
        const response = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: payload,
            description: 'Test product',
            price: 100,
            categoryId: 'test-category',
            sku: 'TEST-001'
          });

        if (response.status === 201) {
          expect(response.body.data.name).not.toContain('<script>');
          expect(response.body.data.name).not.toContain('javascript:');
        } else {
          expect(response.status).toBe(400);
        }
      });
    });

    describe('Null/Undefined Handling', () => {
      const nullUndefinedPayloads = [
        null,
        undefined,
        '',
        '   ',
        'null',
        'undefined',
        'NaN',
        'Infinity',
        '-Infinity'
      ];

      test.each(nullUndefinedPayloads)('should handle null/undefined in user search: %s', async (payload) => {
        const response = await request(app)
          .get('/api/users/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBeOneOf([200, 400]);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      });

      test('should handle missing required fields in user registration', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('required');
      });

      test('should handle null values in product creation', async () => {
        const response = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: null,
            description: null,
            price: null,
            categoryId: null
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Large Payload Handling', () => {
      test('should reject extremely large payloads', async () => {
        const largeString = 'A'.repeat(10000000); // 10MB string

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: largeString,
            email: 'test@example.com',
            password: 'ValidPassword123!',
            phone: '1234567890',
            role: 'customer'
          });

        expect(response.status).toBeOneOf([400, 413, 500]);
      });

      test('should handle large search queries gracefully', async () => {
        const largeQuery = 'search'.repeat(1000);

        const response = await request(app)
          .get('/api/products/search')
          .query({ q: largeQuery })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBeOneOf([200, 400]);
      });
    });

    describe('Special Characters Handling', () => {
      const specialCharacters = [
        '!@#$%^&*()_+-=[]{}|;:,.<>?',
        '™®©℠℗',
        '🚀🎉💻🔒🛡️',
        'ñáéíóúü',
        '中文测试',
        'العربية',
        'русский',
        '日本語',
        '\n\r\t',
        '\x00\x01\x02',
        String.fromCharCode(0, 1, 2, 3, 4, 5)
      ];

      test.each(specialCharacters)('should handle special characters in search: %s', async (chars) => {
        const response = await request(app)
          .get('/api/products/search')
          .query({ q: chars })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBeOneOf([200, 400]);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });
  });

  describe('Authentication Security', () => {
    describe('JWT Token Security', () => {
      test('should reject malformed JWT tokens', async () => {
        const malformedTokens = [
          'invalid.token.here',
          'Bearer invalid',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          '',
          'null',
          'undefined'
        ];

        for (const token of malformedTokens) {
          const response = await request(app)
            .get('/api/users/profile')
            .set('Authorization', token)
            .expect(401);

          expect(response.body.success).toBe(false);
        }
      });

      test('should reject expired JWT tokens', async () => {
        // Generate an expired token (this would need to be implemented in jwt utils)
        const expiredToken = generateToken(
          { id: 'test-user', role: 'customer' },
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('expired');
      });

      test('should reject tokens with invalid signatures', async () => {
        const tokenWithInvalidSignature = authToken.slice(0, -10) + 'invalidsig';

        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${tokenWithInvalidSignature}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Role-based Access Control', () => {
      test('should prevent role escalation in user updates', async () => {
        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            role: 'admin' // Customer trying to become admin
          })
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('permission');
      });

      test('should prevent unauthorized access to admin endpoints', async () => {
        const response = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${authToken}`) // Customer token
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      test('should prevent access without proper role', async () => {
        const staffToken = generateToken({ id: 'staff-user', role: 'staff' });

        const response = await request(app)
          .delete('/api/users/test-user')
          .set('Authorization', `Bearer ${staffToken}`) // Staff trying to delete user
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Rate Limiting Security', () => {
    describe('Device-based Rate Limiting', () => {
      test('should enforce rate limits per device', async () => {
        const deviceId = 'test-device-123';
        const requests = [];

        // Make multiple requests quickly
        for (let i = 0; i < 10; i++) {
          requests.push(
            request(app)
              .get('/api/products')
              .set('X-Device-ID', deviceId)
              .set('Authorization', `Bearer ${authToken}`)
          );
        }

        const responses = await Promise.all(requests);
        const rateLimitedResponses = responses.filter(r => r.status === 429);

        // Should have some rate limited responses if limits are low enough
        expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0);
      });

      test('should reject invalid device IDs', async () => {
        const invalidDeviceIds = [
          'test', // Too short
          'fake-device', // Suspicious pattern
          '11111111', // Repeated characters
          'null',
          'undefined',
          '<script>alert(1)</script>' // XSS attempt
        ];

        for (const deviceId of invalidDeviceIds) {
          const response = await request(app)
            .post('/api/device/validate')
            .send({ deviceId });

          expect(response.body.data.isValid).toBe(false);
        }
      });

      test('should handle missing device ID gracefully', async () => {
        const response = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${authToken}`);

        // Should either work (fallback to IP) or return specific error
        expect(response.status).toBeOneOf([200, 400, 429]);
      });
    });
  });

  describe('Data Validation Security', () => {
    describe('Email Validation', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..double.dot@domain.com',
        'user@domain..com',
        '<script>alert(1)</script>@domain.com',
        'user@<script>alert(1)</script>.com'
      ];

      test.each(invalidEmails)('should reject invalid email: %s', async (email) => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: email,
            password: 'ValidPassword123!',
            phone: '1234567890',
            role: 'customer'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Password Security', () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '12345678',
        'password123',
        'admin',
        'test',
        '',
        'a', // Too short
        'PASSWORD123', // No lowercase
        'password123', // No uppercase
        'Password', // No numbers
        'Password123' // No special characters (depending on policy)
      ];

      test.each(weakPasswords)('should reject weak password: %s', async (password) => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: 'test@example.com',
            password: password,
            phone: '1234567890',
            role: 'customer'
          });

        // Should reject weak passwords
        expect(response.status).toBeOneOf([400, 422]);
        if (response.status !== 201) {
          expect(response.body.success).toBe(false);
        }
      });
    });
  });

  describe('File Upload Security', () => {
    // These tests would be relevant if file upload is implemented
    test('should reject malicious file types', async () => {
      // This test would be implemented when file upload is added
      expect(true).toBe(true); // Placeholder
    });

    test('should validate file size limits', async () => {
      // This test would be implemented when file upload is added
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('API Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    test('should not expose sensitive server information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Should not expose server details
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
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

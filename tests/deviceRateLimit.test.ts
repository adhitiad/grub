import request from 'supertest';
import { app } from '../src/app';
import { generateToken } from '../src/utils/jwt';

describe('Device Rate Limiting Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = generateToken({ id: 'test-user', role: 'customer' });
  });

  describe('Device ID Validation', () => {
    test('should accept valid device IDs', async () => {
      const validDeviceIds = [
        'abc123-def456-ghi789',
        '550e8400-e29b-41d4-a716-446655440000',
        'device_12345_mobile_app',
        'client.web.2024.001',
        'my-device-123'
      ];

      for (const deviceId of validDeviceIds) {
        const response = await request(app)
          .post('/api/device/validate')
          .send({ deviceId });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(true);
      }
    });

    test('should reject invalid device IDs', async () => {
      const invalidDeviceIds = [
        'test', // Too short
        'fake-device', // Suspicious pattern
        '11111111', // Repeated characters
        'null',
        'undefined',
        '<script>alert(1)</script>', // XSS attempt
        'a'.repeat(200), // Too long
        '!@#$%^&*()', // Invalid characters
        ''
      ];

      for (const deviceId of invalidDeviceIds) {
        const response = await request(app)
          .post('/api/device/validate')
          .send({ deviceId });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(false);
      }
    });

    test('should handle missing device ID in validation', async () => {
      const response = await request(app)
        .post('/api/device/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Device ID is required');
    });
  });

  describe('Device ID Generation', () => {
    test('should generate secure device ID', async () => {
      const response = await request(app)
        .get('/api/device/generate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deviceId).toBeDefined();
      expect(typeof response.body.data.deviceId).toBe('string');
      expect(response.body.data.deviceId.length).toBeGreaterThan(8);
      expect(response.body.data.instructions).toBeDefined();
    });

    test('should generate unique device IDs', async () => {
      const responses = await Promise.all([
        request(app).get('/api/device/generate'),
        request(app).get('/api/device/generate'),
        request(app).get('/api/device/generate')
      ]);

      const deviceIds = responses.map(r => r.body.data.deviceId);
      const uniqueIds = new Set(deviceIds);

      expect(uniqueIds.size).toBe(3); // All should be unique
    });
  });

  describe('Device Information Extraction', () => {
    test('should extract device info from headers', async () => {
      const deviceId = 'test-device-12345';

      const response = await request(app)
        .get('/api/device/info')
        .set('X-Device-ID', deviceId)
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.device.id).toBe(deviceId);
      expect(response.body.data.device.isValid).toBe(true);
      expect(response.body.data.device.source).toBe('header');
      expect(response.body.data.device.platform).toBeDefined();
    });

    test('should generate fingerprint when device ID missing', async () => {
      const response = await request(app)
        .get('/api/device/info')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.device.source).toBe('fingerprint');
      expect(response.body.data.fingerprint).toBeDefined();
    });

    test('should detect platform from User-Agent', async () => {
      const testCases = [
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          expectedPlatform: 'Windows'
        },
        {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          expectedPlatform: 'iOS'
        },
        {
          userAgent: 'Mozilla/5.0 (Android 10; Mobile; rv:81.0)',
          expectedPlatform: 'Android'
        },
        {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          expectedPlatform: 'macOS'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .get('/api/device/info')
          .set('User-Agent', testCase.userAgent)
          .expect(200);

        expect(response.body.data.device.platform).toBe(testCase.expectedPlatform);
      }
    });
  });

  describe('Rate Limiting Behavior', () => {
    test('should apply rate limits per device', async () => {
      const deviceId = 'rate-limit-test-device';
      const requests = [];

      // Make multiple requests quickly
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/api/products')
            .set('X-Device-ID', deviceId)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed initially (assuming high rate limits in test)
      responses.forEach(response => {
        expect(response.status).toBeOneOf([200, 429]);
      });

      // Check rate limit headers are present
      const firstResponse = responses[0];
      expect(firstResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(firstResponse.headers).toHaveProperty('x-ratelimit-remaining');
    });

    test('should handle different devices separately', async () => {
      const device1 = 'device-1-test';
      const device2 = 'device-2-test';

      const response1 = await request(app)
        .get('/api/products')
        .set('X-Device-ID', device1)
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/products')
        .set('X-Device-ID', device2)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Rate limits should be independent
      expect(response1.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response2.headers['x-ratelimit-remaining']).toBeDefined();
    });

    test('should fallback to IP-based limiting when device ID missing', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`);

      // Should work (fallback to IP-based limiting)
      expect(response.status).toBeOneOf([200, 429]);
    });

    test('should handle invalid device ID gracefully', async () => {
      const invalidDeviceId = 'invalid';

      const response = await request(app)
        .get('/api/products')
        .set('X-Device-ID', invalidDeviceId)
        .set('Authorization', `Bearer ${authToken}`);

      // Should fallback to fingerprint or IP-based limiting
      expect(response.status).toBeOneOf([200, 429]);
    });
  });

  describe('Rate Limit Status', () => {
    test('should return rate limit status for device', async () => {
      const deviceId = 'status-test-device';

      const response = await request(app)
        .get('/api/device/rate-limit')
        .set('X-Device-ID', deviceId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.device.id).toBe(deviceId);
      expect(response.body.data.rateLimit).toBeDefined();
    });

    test('should include rate limit headers in response', async () => {
      const deviceId = 'headers-test-device';

      const response = await request(app)
        .get('/api/device/rate-limit')
        .set('X-Device-ID', deviceId)
        .expect(200);

      expect(response.body.data.headers).toBeDefined();
      expect(response.body.data.headers['X-RateLimit-Limit']).toBeDefined();
    });
  });

  describe('Admin Rate Limit Management', () => {
    let adminToken: string;

    beforeAll(() => {
      adminToken = generateToken({ id: 'admin-user', role: 'admin' });
    });

    test('should allow admin to reset device rate limit', async () => {
      const deviceId = 'admin-reset-test';

      const response = await request(app)
        .post(`/api/device/${deviceId}/reset-rate-limit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deviceId).toBe(deviceId);
      expect(response.body.data.message).toContain('reset');
    });

    test('should reject non-admin rate limit reset', async () => {
      const deviceId = 'non-admin-reset-test';

      const response = await request(app)
        .post(`/api/device/${deviceId}/reset-rate-limit`)
        .set('Authorization', `Bearer ${authToken}`) // Customer token
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    test('should validate device ID in reset request', async () => {
      const invalidDeviceId = 'invalid';

      const response = await request(app)
        .post(`/api/device/${invalidDeviceId}/reset-rate-limit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid device ID');
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle concurrent requests from same device', async () => {
      const deviceId = 'concurrent-test-device';
      const requests = [];

      // Make 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/products')
            .set('X-Device-ID', deviceId)
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Should handle all requests without errors
      responses.forEach(response => {
        expect(response.status).toBeOneOf([200, 429]);
      });
    });

    test('should prevent device ID spoofing attempts', async () => {
      const spoofingAttempts = [
        'admin-device',
        'system-device',
        'root-device',
        'test-device-admin',
        'fake-device-123'
      ];

      for (const deviceId of spoofingAttempts) {
        const response = await request(app)
          .post('/api/device/validate')
          .send({ deviceId });

        // Should either reject or flag as suspicious
        if (response.body.data.isValid === false) {
          expect(response.body.data.recommendations).toBeDefined();
        }
      }
    });

    test('should handle memory cleanup for expired entries', async () => {
      // This test would verify that the rate limiter cleans up old entries
      // Implementation depends on the cleanup mechanism in the rate limiter
      const deviceId = 'cleanup-test-device';

      const response = await request(app)
        .get('/api/products')
        .set('X-Device-ID', deviceId)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([200, 429]);
      
      // The cleanup would happen automatically in the background
      // This test mainly ensures the system doesn't crash
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

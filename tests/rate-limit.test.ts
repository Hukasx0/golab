/**
 * Tests for rate limiting functionality
 */

import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import type { Environment } from '@/types';

// Mock Redis
const mockRedisGet = mock(() => Promise.resolve(0));
const mockRedisIncr = mock(() => Promise.resolve(1));
const mockRedisExpire = mock(() => Promise.resolve(1));
const mockRedisPipeline = mock(() => ({
  incr: mock(),
  expire: mock(),
  exec: mock(() => Promise.resolve([]))
}));

// Mock Upstash Redis
mock.module('@upstash/redis', () => ({
  Redis: mock().mockImplementation(() => ({
    get: mockRedisGet,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    pipeline: mockRedisPipeline
  }))
}));

// Mock email service
const mockSendEmail = mock(() => Promise.resolve(true));
const mockEmailService = {
  sendEmail: mockSendEmail
};

// Mock the email service factory
mock.module('@/services/email', () => ({
  createEmailService: mock(() => mockEmailService)
}));

describe('Rate Limiting Service', () => {
  beforeEach(() => {
    mockRedisGet.mockClear();
    mockRedisIncr.mockClear();
    mockRedisExpire.mockClear();
    mockRedisPipeline.mockClear();
  });

  test('should parse rate limit configuration with defaults', async () => {
    const { parseRateLimitConfig } = await import('@/services/rate-limit');
    
    const env: Environment = {
      TARGET_EMAIL: 'test@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test <noreply@test.com>'
    };

    const config = parseRateLimitConfig(env);

    expect(config.global.enabled).toBe(true);
    expect(config.global.limit).toBe(10);
    expect(config.global.window).toBe(3600);

    expect(config.ip.enabled).toBe(false);
    expect(config.ip.limit).toBe(5);
    expect(config.ip.window).toBe(3600);

    expect(config.email.enabled).toBe(true);
    expect(config.email.limit).toBe(1);
    expect(config.email.window).toBe(3600);
  });

  test('should parse custom rate limit configuration', async () => {
    const { parseRateLimitConfig } = await import('@/services/rate-limit');
    
    const env: Environment = {
      TARGET_EMAIL: 'test@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test <noreply@test.com>',
      RATE_LIMIT_GLOBAL_ENABLED: 'false',
      RATE_LIMIT_GLOBAL_LIMIT: '20',
      RATE_LIMIT_GLOBAL_WINDOW: '7200',
      RATE_LIMIT_IP_ENABLED: 'true',
      RATE_LIMIT_IP_LIMIT: '3',
      RATE_LIMIT_IP_WINDOW: '1800',
      RATE_LIMIT_EMAIL_ENABLED: 'false',
      RATE_LIMIT_EMAIL_LIMIT: '2',
      RATE_LIMIT_EMAIL_WINDOW: '900'
    };

    const config = parseRateLimitConfig(env);

    expect(config.global.enabled).toBe(false);
    expect(config.global.limit).toBe(20);
    expect(config.global.window).toBe(7200);

    expect(config.ip.enabled).toBe(true);
    expect(config.ip.limit).toBe(3);
    expect(config.ip.window).toBe(1800);

    expect(config.email.enabled).toBe(false);
    expect(config.email.limit).toBe(2);
    expect(config.email.window).toBe(900);
  });

  test('should extract real IP from CF-Connecting-IP header', async () => {
    const { extractRealIP } = await import('@/services/rate-limit');
    
    const request = new Request('http://localhost/test', {
      headers: {
        'CF-Connecting-IP': '192.168.1.100',
        'X-Forwarded-For': '10.0.0.1, 192.168.1.100',
        'X-Real-IP': '172.16.0.1'
      }
    });

    const ip = extractRealIP(request);
    expect(ip).toBe('192.168.1.100');
  });

  test('should extract IP from X-Forwarded-For when CF-Connecting-IP is missing', async () => {
    const { extractRealIP } = await import('@/services/rate-limit');
    
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Forwarded-For': '192.168.1.100, 10.0.0.1',
        'X-Real-IP': '172.16.0.1'
      }
    });

    const ip = extractRealIP(request);
    expect(ip).toBe('192.168.1.100');
  });

  test('should extract IP from X-Real-IP when other headers are missing', async () => {
    const { extractRealIP } = await import('@/services/rate-limit');
    
    const request = new Request('http://localhost/test', {
      headers: {
        'X-Real-IP': '172.16.0.1'
      }
    });

    const ip = extractRealIP(request);
    expect(ip).toBe('172.16.0.1');
  });

  test('should return unknown when no IP headers are present', async () => {
    const { extractRealIP } = await import('@/services/rate-limit');
    
    const request = new Request('http://localhost/test');

    const ip = extractRealIP(request);
    expect(ip).toBe('unknown');
  });

  test('should create rate limit service when properly configured', async () => {
    const { createRateLimitService } = await import('@/services/rate-limit');
    
    const env: Environment = {
      TARGET_EMAIL: 'test@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test <noreply@test.com>',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token'
    };

    const service = createRateLimitService(env);
    expect(service).not.toBeNull();
  });

  test('should return null when Redis is not configured', async () => {
    const { createRateLimitService } = await import('@/services/rate-limit');
    
    const env: Environment = {
      TARGET_EMAIL: 'test@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test <noreply@test.com>'
    };

    const service = createRateLimitService(env);
    expect(service).toBeNull();
  });

  test('should return null when all rate limiting is disabled', async () => {
    const { createRateLimitService } = await import('@/services/rate-limit');
    
    const env: Environment = {
      TARGET_EMAIL: 'test@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test <noreply@test.com>',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      RATE_LIMIT_GLOBAL_ENABLED: 'false',
      RATE_LIMIT_IP_ENABLED: 'false',
      RATE_LIMIT_EMAIL_ENABLED: 'false'
    };

    const service = createRateLimitService(env);
    expect(service).toBeNull();
  });
});

describe('Rate Limiting Integration', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    mockSendEmail.mockClear();
    mockSendEmail.mockImplementation(() => Promise.resolve(true));
    mockRedisGet.mockClear();
    mockRedisIncr.mockClear();
    mockRedisExpire.mockClear();
    mockRedisPipeline.mockClear();
    
    // Import after mocking
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should allow request when rate limiting is disabled', async () => {
    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
      // RATE_LIMITING not enabled in build-time config
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('should allow request when Redis is not configured', async () => {
    // Mock RATE_LIMITING_ENABLED to be true for this test
    const originalRateLimitingEnabled = process.env['RATE_LIMITING'];
    process.env['RATE_LIMITING'] = 'true';

    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
      // No Redis configuration
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Restore original value
    if (originalRateLimitingEnabled !== undefined) {
      process.env['RATE_LIMITING'] = originalRateLimitingEnabled;
    } else {
      delete process.env['RATE_LIMITING'];
    }
  });

  test('should allow request when under rate limit', async () => {
    // Mock RATE_LIMITING_ENABLED to be true for this test
    const originalRateLimitingEnabled = process.env['RATE_LIMITING'];
    process.env['RATE_LIMITING'] = 'true';

    // Mock Redis to return count under limit
    mockRedisGet.mockImplementation(() => Promise.resolve(0));

    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Restore original value
    if (originalRateLimitingEnabled !== undefined) {
      process.env['RATE_LIMITING'] = originalRateLimitingEnabled;
    } else {
      delete process.env['RATE_LIMITING'];
    }
  });

  test('should block request when rate limit is exceeded', async () => {
    // Mock RATE_LIMITING_ENABLED to be true for this test
    const originalRateLimitingEnabled = process.env['RATE_LIMITING'];
    process.env['RATE_LIMITING'] = 'true';

    // Mock Redis to return count at limit
    mockRedisGet.mockImplementation(() => Promise.resolve(10)); // At global limit

    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(429);
    expect((responseData as any).error).toBe('Rate limit exceeded');
    expect((responseData as any).details).toBeDefined();
    expect((responseData as any).details[0].field).toBe('rate_limit');
    expect(mockSendEmail).not.toHaveBeenCalled();

    // Restore original value
    if (originalRateLimitingEnabled !== undefined) {
      process.env['RATE_LIMITING'] = originalRateLimitingEnabled;
    } else {
      delete process.env['RATE_LIMITING'];
    }
  });

  test('should include CORS headers in rate limit error response', async () => {
    // Mock RATE_LIMITING_ENABLED to be true for this test
    const originalRateLimitingEnabled = process.env['RATE_LIMITING'];
    process.env['RATE_LIMITING'] = 'true';

    // Mock Redis to return count at limit
    mockRedisGet.mockImplementation(() => Promise.resolve(10));

    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://example.com',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(429);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');

    // Restore original value
    if (originalRateLimitingEnabled !== undefined) {
      process.env['RATE_LIMITING'] = originalRateLimitingEnabled;
    } else {
      delete process.env['RATE_LIMITING'];
    }
  });

  test('should work with other security features', async () => {
    // Mock RATE_LIMITING_ENABLED to be true for this test
    const originalRateLimitingEnabled = process.env['RATE_LIMITING'];
    process.env['RATE_LIMITING'] = 'true';

    // Mock Redis to return count under limit
    mockRedisGet.mockImplementation(() => Promise.resolve(0));

    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      API_KEY: 'test-api-key',
      EMAIL_DOMAIN_WHITELIST: 'example.com'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Restore original value
    if (originalRateLimitingEnabled !== undefined) {
      process.env['RATE_LIMITING'] = originalRateLimitingEnabled;
    } else {
      delete process.env['RATE_LIMITING'];
    }
  });

  test('should fail gracefully when Redis is unavailable', async () => {
    // Mock RATE_LIMITING_ENABLED to be true for this test
    const originalRateLimitingEnabled = process.env['RATE_LIMITING'];
    process.env['RATE_LIMITING'] = 'true';

    // Mock Redis to throw an error
    mockRedisGet.mockImplementation(() => Promise.reject(new Error('Redis connection failed')));

    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.100'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    // Should allow request when Redis fails (fail-open behavior)
    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Restore original value
    if (originalRateLimitingEnabled !== undefined) {
      process.env['RATE_LIMITING'] = originalRateLimitingEnabled;
    } else {
      delete process.env['RATE_LIMITING'];
    }
  });
});
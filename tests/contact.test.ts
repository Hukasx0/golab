/**
 * Tests for contact handler
 */

import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import type { Environment } from '@/types';

// Mock email service
const mockSendEmail = mock(() => Promise.resolve(true));
const mockEmailService = {
  sendEmail: mockSendEmail
};

// Mock the email service factory
mock.module('@/services/email', () => ({
  createEmailService: mock(() => mockEmailService)
}));

describe('Contact API Endpoint', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    mockSendEmail.mockClear();
    
    // Import after mocking
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should handle valid contact form submission', async () => {
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
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect((responseData as any).message).toContain('sent successfully');
    expect((responseData as any).timestamp).toBeDefined();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('should reject invalid email', async () => {
    const invalidData = {
      email: 'invalid-email',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(400);
    expect((responseData as any).error).toBe('Validation failed');
    expect((responseData as any).details).toBeDefined();
    expect((responseData as any).details[0].field).toBe('email');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should reject empty request body', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json'
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(400);
    expect((responseData as any).error).toBe('Invalid JSON payload');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should handle email service failure', async () => {
    mockSendEmail.mockImplementationOnce(() => Promise.resolve(false));

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
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(500);
    expect((responseData as any).error).toContain('Failed to send email');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('should include CORS headers', async () => {
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
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://example.com'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  test('should handle OPTIONS preflight request', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com'
      }
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });
});

describe('Health Check Endpoint', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should return health status', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/health');
    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).status).toBe('healthy');
    expect((responseData as any).service).toBe('Gołąb Contact Form API');
    expect((responseData as any).description).toContain('reliable contact form API');
    expect((responseData as any).timestamp).toBeDefined();
    expect((responseData as any).version).toBeDefined();
  });

  test('should return health status on root path', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/');
    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).status).toBe('healthy');
  });
});

describe('Banned Words Integration', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    mockSendEmail.mockClear();
    
    // Import after mocking
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should allow submission when no banned words are configured', async () => {
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
      // BANNED_WORDS not set
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('should allow submission when banned words are empty', async () => {
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
      BANNED_WORDS: ''
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('should block submission when banned word is in email', async () => {
    const invalidData = {
      email: 'spam@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      BANNED_WORDS: 'spam;badword;casino'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(400);
    expect((responseData as any).error).toBe('Message contains inappropriate content and cannot be sent');
    expect((responseData as any).timestamp).toBeDefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should block submission when banned word is in subject', async () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'Win the lottery now!',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      BANNED_WORDS: 'spam;lottery;casino'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(400);
    expect((responseData as any).error).toBe('Message contains inappropriate content and cannot be sent');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should block submission when banned word is in message', async () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This message contains casino advertisements and enough characters.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      BANNED_WORDS: 'spam;casino;lottery'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(400);
    expect((responseData as any).error).toBe('Message contains inappropriate content and cannot be sent');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should be case-insensitive in blocking', async () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'SPAM Alert',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      BANNED_WORDS: 'spam;badword;casino'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(400);
    expect((responseData as any).error).toBe('Message contains inappropriate content and cannot be sent');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should include CORS headers in banned words error response', async () => {
    const invalidData = {
      email: 'spam@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      BANNED_WORDS: 'spam;badword;casino'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://example.com'
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(400);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  test('should allow submission when content is clean', async () => {
    const validData = {
      email: 'test@example.com',
      subject: 'Clean Subject',
      message: 'This is a completely clean test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      BANNED_WORDS: 'spam;badword;casino;lottery'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});
describe('Auto-Reply Functionality', () => {
  let app: Hono<{ Bindings: Environment }>;

  // Mock email service with auto-reply capability
  const mockSendEmail = mock(() => Promise.resolve(true));
  const mockSendAutoReply = mock(() => Promise.resolve(true));
  const mockEmailServiceWithAutoReply = {
    sendEmail: mockSendEmail,
    sendAutoReply: mockSendAutoReply
  };

  beforeEach(async () => {
    mockSendEmail.mockClear();
    mockSendAutoReply.mockClear();
    
    // Mock the email service factory to return service with auto-reply
    mock.module('@/services/email', () => ({
      createEmailService: mock(() => mockEmailServiceWithAutoReply)
    }));
    
    // Import after mocking
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should handle successful auto-reply sending', async () => {
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
      ENABLE_AUTO_REPLY: 'true'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendAutoReply).toHaveBeenCalledTimes(1);
  });

  test('should handle auto-reply failure (non-critical)', async () => {
    // Mock auto-reply to fail
    mockSendAutoReply.mockImplementationOnce(() => Promise.resolve(false));

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
      ENABLE_AUTO_REPLY: 'true'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    // Should still succeed even if auto-reply fails
    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendAutoReply).toHaveBeenCalledTimes(1);
  });

  test('should handle auto-reply exception (non-critical)', async () => {
    // Mock auto-reply to throw an error
    mockSendAutoReply.mockImplementationOnce(() => Promise.reject(new Error('Auto-reply service error')));

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
      ENABLE_AUTO_REPLY: 'true'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    // Should still succeed even if auto-reply throws an error
    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendAutoReply).toHaveBeenCalledTimes(1);
  });
});

describe('API Key Authentication', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    mockSendEmail.mockClear();
    mockSendEmail.mockImplementation(() => Promise.resolve(true));
    
    // Import after mocking
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should allow requests when API key is not configured (backward compatibility)', async () => {
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
      // API_KEY not set - should allow all requests
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
  });

  test('should allow requests when API key is empty string', async () => {
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
      API_KEY: '' // Empty string - should allow all requests
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
  });

  test('should reject requests without API key header when authentication is enabled', async () => {
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
      API_KEY: 'test-api-key'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(401);
    expect((responseData as any).error).toBe('Unauthorized');
    expect((responseData as any).details).toBeDefined();
    expect((responseData as any).details[0].field).toBe('authentication');
    expect((responseData as any).details[0].message).toContain('API key is required');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should reject requests with invalid API key', async () => {
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
      API_KEY: 'test-api-key'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'wrong-api-key'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(401);
    expect((responseData as any).error).toBe('Unauthorized');
    expect((responseData as any).details).toBeDefined();
    expect((responseData as any).details[0].field).toBe('authentication');
    expect((responseData as any).details[0].message).toContain('Invalid API key');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should accept requests with valid API key', async () => {
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
      API_KEY: 'test-api-key'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
    expect((responseData as any).message).toContain('sent successfully');
  });

  test('should include CORS headers in API key error responses', async () => {
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
      API_KEY: 'test-api-key'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://example.com'
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);

    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  test('should handle case-sensitive API key validation', async () => {
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
      API_KEY: 'test-api-key'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'Test-API-Key' // Different case
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(401);
    expect((responseData as any).error).toBe('Unauthorized');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should handle special characters in API key', async () => {
    const specialApiKey = 'Kx7vQ2mR8nP5wL9sT3uY6bN1cF4hJ0eA2dG8iM7oS5k=';
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
      API_KEY: specialApiKey
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': specialApiKey
      },
      body: JSON.stringify(validData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(200);
    expect((responseData as any).success).toBe(true);
  });

  test('should validate API key before other validations', async () => {
    const invalidData = {
      email: 'invalid-email', // This would normally cause validation error
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      API_KEY: 'test-api-key'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Missing X-API-Key header
      },
      body: JSON.stringify(invalidData)
    });

    const res = await app.fetch(req, env);
    const responseData = await res.json();

    // Should get 401 for missing API key, not 400 for invalid email
    expect(res.status).toBe(401);
    expect((responseData as any).error).toBe('Unauthorized');
    expect((responseData as any).details[0].field).toBe('authentication');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('404 Handler', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should return 404 for unknown routes', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/unknown-route');
    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(404);
    expect((responseData as any).error).toBe('Endpoint not found');
    expect((responseData as any).message).toContain('requested endpoint was not found');
    expect((responseData as any).availableEndpoints).toBeDefined();
    expect((responseData as any).availableEndpoints.length).toBeGreaterThan(0);
  });
});

describe('Email Filtering Integration', () => {
  let app: Hono<{ Bindings: Environment }>;

  beforeEach(async () => {
    mockSendEmail.mockClear();
    mockSendEmail.mockImplementation(() => Promise.resolve(true));
    
    // Import after mocking
    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  describe('Domain Whitelist Integration', () => {
    test('should allow emails from whitelisted domains', async () => {
      const validData = {
        email: 'user@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com;trusted.org'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(200);
      expect((responseData as any).success).toBe(true);
    });

    test('should block emails from non-whitelisted domains', async () => {
      const invalidData = {
        email: 'user@blocked.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com;trusted.org'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Email address is not allowed');
      expect((responseData as any).details).toBeDefined();
      expect((responseData as any).details[0].field).toBe('email');
      expect((responseData as any).details[0].message).toBe('Email domain is not in whitelist');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Domain Blacklist Integration', () => {
    test('should block emails from blacklisted domains', async () => {
      const invalidData = {
        email: 'user@spam.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_BLACKLIST: 'spam.com;malicious.net'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Email address is not allowed');
      expect((responseData as any).details[0].message).toBe('Email domain is blacklisted');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    test('should allow emails from non-blacklisted domains', async () => {
      const validData = {
        email: 'user@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_BLACKLIST: 'spam.com;malicious.net'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(200);
      expect((responseData as any).success).toBe(true);
    });
  });

  describe('Email Address Blacklist Integration', () => {
    test('should block specific blacklisted email addresses', async () => {
      const invalidData = {
        email: 'spammer@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_ADDRESS_BLACKLIST: 'spammer@example.com;bad@domain.com'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Email address is not allowed');
      expect((responseData as any).details[0].message).toBe('Email address is blacklisted');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    test('should allow non-blacklisted email addresses', async () => {
      const validData = {
        email: 'user@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_ADDRESS_BLACKLIST: 'spammer@example.com;bad@domain.com'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(200);
      expect((responseData as any).success).toBe(true);
    });
  });

  describe('Priority Logic Integration', () => {
    test('should prioritize email blacklist over domain whitelist', async () => {
      const invalidData = {
        email: 'spammer@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com', // Domain is whitelisted
        EMAIL_ADDRESS_BLACKLIST: 'spammer@example.com' // But email is blacklisted
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Email address is not allowed');
      expect((responseData as any).details[0].message).toBe('Email address is blacklisted');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    test('should prioritize domain blacklist over domain whitelist', async () => {
      const invalidData = {
        email: 'user@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com', // Domain is whitelisted
        EMAIL_DOMAIN_BLACKLIST: 'example.com'  // But also blacklisted
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Email address is not allowed');
      expect((responseData as any).details[0].message).toBe('Email domain is blacklisted');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Email Filtering with Other Features', () => {
    test('should work with banned words filtering', async () => {
      const invalidData = {
        email: 'user@example.com', // Valid email
        subject: 'Casino promotion', // Contains banned word
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com', // Email domain is whitelisted
        BANNED_WORDS: 'casino;spam;lottery' // But content contains banned words
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Message contains inappropriate content and cannot be sent');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    test('should work with API key authentication', async () => {
      const validData = {
        email: 'user@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com',
        API_KEY: 'test-api-key'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key'
        },
        body: JSON.stringify(validData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(200);
      expect((responseData as any).success).toBe(true);
    });

    test('should include CORS headers in email filtering error responses', async () => {
      const invalidData = {
        email: 'user@blocked.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com'
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://example.com'
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    });
  });

  describe('Case Sensitivity Integration', () => {
    test('should handle case-insensitive domain filtering', async () => {
      const validData = {
        email: 'USER@EXAMPLE.COM', // Uppercase email
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_DOMAIN_WHITELIST: 'example.com' // Lowercase whitelist
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(200);
      expect((responseData as any).success).toBe(true);
    });

    test('should handle case-insensitive email address filtering', async () => {
      const invalidData = {
        email: 'SPAMMER@EXAMPLE.COM', // Uppercase email
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const env: Environment = {
        TARGET_EMAIL: 'target@example.com',
        RESEND_API_KEY: 'test-key',
        FROM_EMAIL: 'Test Form <noreply@test.com>',
        ALLOWED_ORIGINS: '*',
        EMAIL_ADDRESS_BLACKLIST: 'spammer@example.com' // Lowercase blacklist
      };

      const req = new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
      });

      const res = await app.fetch(req, env);
      const responseData = await res.json();

      expect(res.status).toBe(400);
      expect((responseData as any).error).toBe('Email address is not allowed');
      expect((responseData as any).details[0].message).toBe('Email address is blacklisted');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});

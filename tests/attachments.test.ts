/**
 * Tests for single optional attachment handling
 */

import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import type { Environment } from '@/types';

// Utilities for building sample base64 payloads
const b64 = {
  // "{}"
  json: 'e30=',
  // "Hello"
  hello: 'SGVsbG8='
};

// Capture arguments passed to email service
type CapturedArgs = {
  data: any;
  request?: Request;
  attachment?: { filename: string; contentType: string; content: string };
} | null;

describe('Attachments Feature', () => {
  let app: Hono<{ Bindings: Environment }>;
  const mockSendEmail = mock(() => Promise.resolve(true));
  let captured: CapturedArgs = null;

  // Mock email service factory to capture attachment argument
  const mockEmailService = {
    sendEmail: (data: any, request?: Request, attachment?: any) => {
      captured = { data, request, attachment };
      return mockSendEmail();
    },
    sendAutoReply: mock(() => Promise.resolve(true))
  };

  beforeEach(async () => {
    mockSendEmail.mockClear();
    captured = null;

    mock.module('@/services/email', () => ({
      createEmailService: mock(() => mockEmailService)
    }));

    const { default: createApp } = await import('@/index');
    app = createApp;
  });

  test('should return 400 when attachments are disabled and attachment is provided', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      // ATTACHMENTS_ENABLED not set (defaults to disabled)
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length',
        attachment: {
          filename: 'data.json',
          contentType: 'application/json',
          content: b64.json
        }
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect((payload as any).error).toBe('Attachments are disabled');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should accept request without attachment when enabled (backward compatible)', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      ATTACHMENTS_ENABLED: 'true',
      ATTACHMENTS_MIME_WHITELIST: 'application/json;text/plain;image/png;image/jpeg'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length'
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect((payload as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(captured?.attachment).toBeUndefined();
  });

  test('should send with valid attachment when enabled and MIME is whitelisted', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      ATTACHMENTS_ENABLED: 'true',
      ATTACHMENTS_MIME_WHITELIST: 'application/json;text/plain;image/png;image/jpeg'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length',
        attachment: {
          filename: 'data.json',
          contentType: 'application/json',
          content: b64.json
        }
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect((payload as any).success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(captured?.attachment).toBeDefined();
    expect(captured?.attachment?.filename).toBe('data.json');
    expect(captured?.attachment?.contentType).toBe('application/json');
    expect(captured?.attachment?.content).toBe(b64.json);
  });

  test('should reject when MIME not in whitelist', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      ATTACHMENTS_ENABLED: 'true',
      ATTACHMENTS_MIME_WHITELIST: 'application/json;text/plain'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length',
        attachment: {
          filename: 'file.bin',
          contentType: 'application/octet-stream',
          content: b64.hello
        }
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect((payload as any).error).toBe('Validation failed');
    const messages = ((payload as any).details || []).map((d: any) => d.message);
    expect(messages.join(' ')).toContain('whitelist');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should reject when MIME blacklisted even if whitelisted', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      ATTACHMENTS_ENABLED: 'true',
      ATTACHMENTS_MIME_WHITELIST: 'application/json',
      ATTACHMENTS_MIME_BLACKLIST: 'application/json'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length',
        attachment: {
          filename: 'data.json',
          contentType: 'application/json',
          content: b64.json
        }
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect((payload as any).error).toBe('Validation failed');
    const messages = ((payload as any).details || []).map((d: any) => d.message);
    expect(messages.join(' ')).toContain('blacklisted');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should reject unsupported extension regardless of MIME', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      ATTACHMENTS_ENABLED: 'true',
      ATTACHMENTS_MIME_WHITELIST: 'application/json;application/pdf'
    };

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length',
        attachment: {
          filename: 'bad.exe',
          contentType: 'application/pdf',
          content: b64.hello
        }
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect((payload as any).error).toBe('Validation failed');
    const messages = ((payload as any).details || []).map((d: any) => d.message);
    expect(messages.join(' ')).toContain('not supported');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('should enforce per-file size limit', async () => {
    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*',
      ATTACHMENTS_ENABLED: 'true',
      ATTACHMENTS_MIME_WHITELIST: 'text/plain',
      ATTACHMENTS_MAX_FILE_SIZE_BYTES: '3' // 3 bytes max
    };

    // "Hello" => 5 bytes decoded
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        subject: 'Subject',
        message: 'Message with enough length',
        attachment: {
          filename: 'hello.txt',
          contentType: 'text/plain',
          content: b64.hello
        }
      })
    });

    const res = await app.fetch(req, env);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect((payload as any).error).toBe('Validation failed');
    const messages = ((payload as any).details || []).map((d: any) => d.message);
    expect(messages.join(' ')).toContain('exceeds maximum size');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

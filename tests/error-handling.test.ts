/**
 * Tests for error handling scenarios
 */

import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import type { Environment } from '@/types';

describe('Contact Handler Error Handling', () => {
  test('should handle contact handler internal exception', async () => {
    // Mock email service to throw an unexpected error
    const mockEmailService = {
      sendEmail: mock(() => {
        throw new Error('Unexpected email service error');
      })
    };

    mock.module('@/services/email', () => ({
      createEmailService: mock(() => mockEmailService)
    }));

    const { default: createApp } = await import('@/index');
    const app = createApp;

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
    expect((responseData as any).error).toBe('Internal server error');
    expect((responseData as any).timestamp).toBeDefined();
  });
});

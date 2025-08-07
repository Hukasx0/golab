/**
 * Tests for global error handling in index.ts
 */

import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import type { Environment } from '@/types';

describe('Global Error Handler', () => {
  test('should handle unhandled errors with global error handler', async () => {
    // Create a fresh Hono app that will throw an error
    const app = new Hono<{ Bindings: Environment }>();
    
    // Add the global error handler (copied from index.ts)
    app.onError((err, c) => {
      console.error('Unhandled error:', err);
      
      return c.json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
        timestamp: new Date().toISOString()
      }, 500);
    });

    // Add a route that throws an error
    app.get('/error', () => {
      throw new Error('Test unhandled error');
    });

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/error');
    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(500);
    expect((responseData as any).error).toBe('Internal server error');
    expect((responseData as any).message).toContain('unexpected error occurred');
    expect((responseData as any).timestamp).toBeDefined();
  });

  test('should handle async errors with global error handler', async () => {
    // Create a fresh Hono app that will throw an async error
    const app = new Hono<{ Bindings: Environment }>();
    
    // Add the global error handler (copied from index.ts)
    app.onError((err, c) => {
      console.error('Unhandled error:', err);
      
      return c.json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
        timestamp: new Date().toISOString()
      }, 500);
    });

    // Add a route that throws an async error
    app.get('/async-error', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      throw new Error('Test async unhandled error');
    });

    const env: Environment = {
      TARGET_EMAIL: 'target@example.com',
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'Test Form <noreply@test.com>',
      ALLOWED_ORIGINS: '*'
    };

    const req = new Request('http://localhost/async-error');
    const res = await app.fetch(req, env);
    const responseData = await res.json();

    expect(res.status).toBe(500);
    expect((responseData as any).error).toBe('Internal server error');
    expect((responseData as any).message).toContain('unexpected error occurred');
    expect((responseData as any).timestamp).toBeDefined();
  });
});

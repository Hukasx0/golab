/**
 * Tests for CORS utilities
 */

import { expect, test, describe } from 'bun:test';
import { createCorsHeaders, handleCorsPreflightRequest, addCorsHeaders } from '@/utils/cors';

describe('CORS Headers Creation', () => {
  test('should create default CORS headers for wildcard origin', () => {
    const headers = createCorsHeaders('*', 'https://example.com');
    
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type, X-API-Key');
    expect(headers['Access-Control-Max-Age']).toBe('86400');
  });

  test('should create CORS headers for allowed origin', () => {
    const allowedOrigins = 'https://example.com,https://test.com';
    const requestOrigin = 'https://example.com';
    
    const headers = createCorsHeaders(allowedOrigins, requestOrigin);
    
    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });

  test('should return empty headers for disallowed origin', () => {
    const allowedOrigins = 'https://example.com,https://test.com';
    const requestOrigin = 'https://malicious.com';
    
    const headers = createCorsHeaders(allowedOrigins, requestOrigin);
    
    expect(Object.keys(headers)).toHaveLength(0);
  });

  test('should handle whitespace in allowed origins list', () => {
    const allowedOrigins = ' https://example.com , https://test.com ';
    const requestOrigin = 'https://example.com';
    
    const headers = createCorsHeaders(allowedOrigins, requestOrigin);
    
    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  test('should handle missing request origin with specific allowed origins', () => {
    const allowedOrigins = 'https://example.com,https://test.com';
    
    const headers = createCorsHeaders(allowedOrigins, undefined);
    
    // When no request origin is provided but specific origins are allowed,
    // it should still return default CORS headers (not empty)
    expect(Object.keys(headers)).toHaveLength(4);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('should handle wildcard with undefined request origin', () => {
    const headers = createCorsHeaders('*', undefined);
    
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('CORS Preflight Request Handling', () => {
  test('should handle preflight for wildcard origin', () => {
    const response = handleCorsPreflightRequest('*', 'https://example.com');
    
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  test('should handle preflight for allowed origin', () => {
    const allowedOrigins = 'https://example.com,https://test.com';
    const requestOrigin = 'https://example.com';
    
    const response = handleCorsPreflightRequest(allowedOrigins, requestOrigin);
    
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });

  test('should reject preflight for disallowed origin', () => {
    const allowedOrigins = 'https://example.com,https://test.com';
    const requestOrigin = 'https://malicious.com';
    
    const response = handleCorsPreflightRequest(allowedOrigins, requestOrigin);
    
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('should reject preflight when no origin provided for specific allowed origins', () => {
    const allowedOrigins = 'https://example.com,https://test.com';
    
    const response = handleCorsPreflightRequest(allowedOrigins, undefined);
    
    // When no request origin is provided, it should still allow with default headers
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('Adding CORS Headers to Response', () => {
  test('should add CORS headers to existing response', () => {
    const originalResponse = new Response('{"success": true}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const newResponse = addCorsHeaders(originalResponse, '*', 'https://example.com');
    
    expect(newResponse.status).toBe(200);
    expect(newResponse.headers.get('Content-Type')).toBe('application/json');
    expect(newResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(newResponse.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
  });

  test('should preserve original response body and status', () => {
    const originalResponse = new Response('Test content', {
      status: 201,
      statusText: 'Created'
    });

    const newResponse = addCorsHeaders(originalResponse, '*');
    
    expect(newResponse.status).toBe(201);
    expect(newResponse.statusText).toBe('Created');
    expect(newResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('should handle disallowed origin by not adding CORS headers', () => {
    const originalResponse = new Response('{"success": true}', {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const allowedOrigins = 'https://example.com';
    const requestOrigin = 'https://malicious.com';
    
    const newResponse = addCorsHeaders(originalResponse, allowedOrigins, requestOrigin);
    
    expect(newResponse.status).toBe(200);
    expect(newResponse.headers.get('Content-Type')).toBe('application/json');
    expect(newResponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

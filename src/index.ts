/**
 * Gołąb - Contact Form API
 * 
 * A reliable carrier pigeon for your static website contact forms.
 * "Gołąb" means "pigeon" in Polish, specifically a carrier pigeon (gołąb pocztowy)
 * - perfect for a service that delivers messages from your contact forms!
 * 
 * Built with Hono for Cloudflare Workers
 */

import { Hono } from 'hono';
import type { Environment } from '@/types';
import { handleContactSubmission, handleHealthCheck } from '@/handlers/contact';
import { handleCorsPreflightRequest } from '@/utils/cors';

// Create Hono app with environment bindings
const app = new Hono<{ Bindings: Environment }>();

// Global CORS middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS || '*';
  const requestOrigin = c.req.header('Origin');
  
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(allowedOrigins, requestOrigin);
  }
  
  return await next();
});

// Health check endpoint
app.get('/', handleHealthCheck);
app.get('/health', handleHealthCheck);

// API routes
app.post('/api/contact', handleContactSubmission);

// Handle 404 for unknown routes
app.notFound((c) => {
  return c.json({
    error: 'Endpoint not found',
    message: 'The requested endpoint was not found',
    availableEndpoints: [
      'GET / - Health check',
      'GET /health - Health check',
      'POST /api/contact - Submit contact form'
    ],
    timestamp: new Date().toISOString()
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  
  return c.json({
    error: 'Internal server error',
    message: 'An unexpected error occurred while processing your request',
    timestamp: new Date().toISOString()
  }, 500);
});

// Export for Cloudflare Workers
export default app;

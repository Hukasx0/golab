/**
 * CORS configuration for Gołąb contact form API
 */

/**
 * CORS headers for preflight and actual requests
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be overridden by environment variable
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Creates CORS headers with proper origin handling
 * @param allowedOrigins - Comma-separated list of allowed origins or '*'
 * @param requestOrigin - Origin from the request headers
 * @returns CORS headers object
 */
export function createCorsHeaders(
  allowedOrigins: string = '*',
  requestOrigin?: string
): Record<string, string> {
  let origin = '*';
  
  if (allowedOrigins !== '*' && requestOrigin) {
    const origins = allowedOrigins.split(',').map(o => o.trim());
    if (origins.includes(requestOrigin)) {
      origin = requestOrigin;
    } else {
      // If origin is not allowed, don't set CORS headers
      return {};
    }
  }
  
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': origin,
  };
}

/**
 * Handles CORS preflight requests
 * @param allowedOrigins - Comma-separated list of allowed origins or '*'
 * @param requestOrigin - Origin from the request headers
 * @returns Response for preflight request
 */
export function handleCorsPreflightRequest(
  allowedOrigins: string = '*',
  requestOrigin?: string
): Response {
  const headers = createCorsHeaders(allowedOrigins, requestOrigin);
  
  // If no CORS headers were created, the origin is not allowed
  if (Object.keys(headers).length === 0) {
    return new Response('Origin not allowed', { status: 403 });
  }
  
  return new Response(null, {
    status: 204,
    headers
  });
}

/**
 * Adds CORS headers to a response
 * @param response - Original response
 * @param allowedOrigins - Comma-separated list of allowed origins or '*'
 * @param requestOrigin - Origin from the request headers
 * @returns Response with CORS headers
 */
export function addCorsHeaders(
  response: Response,
  allowedOrigins: string = '*',
  requestOrigin?: string
): Response {
  const corsHeaders = createCorsHeaders(allowedOrigins, requestOrigin);
  
  // Create new response with CORS headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      ...corsHeaders
    }
  });
  
  return newResponse;
}

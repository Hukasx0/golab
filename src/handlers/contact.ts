/**
 * Contact form handler for Gołąb API
 */

import type { Context } from 'hono';
import type { ContactFormResponse, ApiError, Environment } from '@/types';
import { validateContactForm, containsBannedWords, validateApiKey, isEmailAllowed } from '@/utils/validation';
import { createEmailService } from '@/services/email';
import { addCorsHeaders } from '@/utils/cors';
import { createRateLimitService, extractRealIP } from '@/services/rate-limit';
import { RATE_LIMITING_ENABLED } from '@/utils/env-config';

/**
 * Handles contact form submission
 * @param c - Hono context
 * @returns JSON response
 */
export async function handleContactSubmission(c: Context<{ Bindings: Environment }>): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Validate API key if configured
    const apiKeyValidation = validateApiKey(c.req.raw, c.env.API_KEY);
    if (!apiKeyValidation.isValid) {
      const errorResponse: ApiError = {
        error: 'Unauthorized',
        details: [{ field: 'authentication', message: apiKeyValidation.error! }],
        timestamp: new Date().toISOString()
      };
      
      return createErrorResponse(errorResponse, 401, c);
    }

    // Get request data
    const requestData = await c.req.json().catch(() => null);
    
    if (!requestData) {
      const errorResponse: ApiError = {
        error: 'Invalid JSON payload',
        timestamp: new Date().toISOString()
      };
      
      return createErrorResponse(errorResponse, 400, c);
    }

    // Validate form data
    const validation = validateContactForm(requestData);
    
    if (!validation.success) {
      const errorResponse: ApiError = {
        error: 'Validation failed',
        details: validation.errors,
        timestamp: new Date().toISOString()
      };
      
      return createErrorResponse(errorResponse, 400, c);
    }

    const formData = validation.data!;

    // Check for banned words
    if (containsBannedWords(formData, c.env.BANNED_WORDS)) {
      const errorResponse: ApiError = {
        error: 'Message contains inappropriate content and cannot be sent',
        timestamp: new Date().toISOString()
      };
      
      // Log banned words detection for monitoring
      console.warn('Contact form blocked due to banned words', {
        email: formData.email,
        subject: formData.subject,
        timestamp: new Date().toISOString()
      });
      
      return createErrorResponse(errorResponse, 400, c);
    }

    // Check email filtering (domain whitelist/blacklist, email blacklist)
    const emailFilterResult = isEmailAllowed(
      formData.email,
      c.env.EMAIL_DOMAIN_WHITELIST,
      c.env.EMAIL_DOMAIN_BLACKLIST,
      c.env.EMAIL_ADDRESS_BLACKLIST
    );

    if (!emailFilterResult.isAllowed) {
      const errorResponse: ApiError = {
        error: 'Email address is not allowed',
        details: [{ field: 'email', message: emailFilterResult.reason || 'Email address is not allowed' }],
        timestamp: new Date().toISOString()
      };
      
      // Log email filtering for monitoring
      console.warn('Contact form blocked due to email filtering', {
        email: formData.email,
        reason: emailFilterResult.reason,
        timestamp: new Date().toISOString()
      });
      
      return createErrorResponse(errorResponse, 400, c);
    }

    // Check rate limiting if enabled
    let rateLimitService = null;
    if (RATE_LIMITING_ENABLED) {
      rateLimitService = createRateLimitService(c.env);
      
      if (rateLimitService) {
        const clientIP = extractRealIP(c.req.raw);
        const rateLimitResult = await rateLimitService.checkRateLimit(clientIP, formData.email);
        
        if (!rateLimitResult.allowed) {
          const errorResponse: ApiError = {
            error: 'Rate limit exceeded',
            details: [{
              field: 'rate_limit',
              message: rateLimitResult.reason || 'Too many requests. Please try again later.'
            }],
            timestamp: new Date().toISOString()
          };
          
          // Log rate limiting for monitoring
          console.warn('Contact form blocked due to rate limiting', {
            email: formData.email,
            ip: clientIP,
            reason: rateLimitResult.reason,
            resetTime: rateLimitResult.resetTime,
            timestamp: new Date().toISOString()
          });
          
          return createErrorResponse(errorResponse, 429, c);
        }
      }
    }

    // Create email service and send email
    const emailService = createEmailService(c.env);
    const emailSent = await emailService.sendEmail(formData, c.req.raw);

    if (!emailSent) {
      const errorResponse: ApiError = {
        error: 'Failed to send email. Please try again later.',
        timestamp: new Date().toISOString()
      };
      
      return createErrorResponse(errorResponse, 500, c);
    }

    // Increment rate limiting counters after successful email send
    if (RATE_LIMITING_ENABLED && rateLimitService) {
      const clientIP = extractRealIP(c.req.raw);
      await rateLimitService.incrementCounters(clientIP, formData.email);
    }

    // Send auto-reply if enabled
    const autoReplyEnabled = c.env.ENABLE_AUTO_REPLY?.toLowerCase() === 'true';
    if (autoReplyEnabled) {
      try {
        const autoReplySent = await emailService.sendAutoReply(formData);
        if (!autoReplySent) {
          console.warn('Auto-reply email failed to send, but main email was successful', {
            email: formData.email,
            subject: formData.subject,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('Auto-reply email sent successfully', {
            to: formData.email,
            originalSubject: formData.subject,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Auto-reply email error (non-critical):', error, {
          email: formData.email,
          subject: formData.subject,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Success response
    const successResponse: ContactFormResponse = {
      success: true,
      message: 'Your message has been sent successfully!',
      timestamp: new Date().toISOString()
    };

    const processingTime = Date.now() - startTime;
    
    // Log successful request
    console.log(`Contact form submitted successfully`, {
      email: formData.email,
      subject: formData.subject,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

    return createSuccessResponse(successResponse, c);

  } catch (error) {
    console.error('Contact form handler error:', error);
    
    const errorResponse: ApiError = {
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    
    return createErrorResponse(errorResponse, 500, c);
  }
}

/**
 * Creates a success response with CORS headers
 */
function createSuccessResponse(
  data: ContactFormResponse, 
  c: Context<{ Bindings: Environment }>
): Response {
  const response = new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });

  const allowedOrigins = c.env.ALLOWED_ORIGINS || '*';
  const requestOrigin = c.req.header('Origin');
  
  return addCorsHeaders(response, allowedOrigins, requestOrigin);
}

/**
 * Creates an error response with CORS headers
 */
function createErrorResponse(
  error: ApiError, 
  status: number, 
  c: Context<{ Bindings: Environment }>
): Response {
  const response = new Response(JSON.stringify(error), {
    status,
    headers: {
      'Content-Type': 'application/json',
    }
  });

  const allowedOrigins = c.env.ALLOWED_ORIGINS || '*';
  const requestOrigin = c.req.header('Origin');
  
  return addCorsHeaders(response, allowedOrigins, requestOrigin);
}

/**
 * Health check endpoint
 */
export async function handleHealthCheck(): Promise<Response> {
  const healthResponse = {
    status: 'healthy',
    service: 'Gołąb Contact Form API',
    description: 'A reliable contact form API for static websites',
    timestamp: new Date().toISOString(),
    version: '0.8'
  };

  return new Response(JSON.stringify(healthResponse), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

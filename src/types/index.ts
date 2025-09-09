/**
 * Gołąb - Contact Form API Types
 *
 * Type definitions for the contact form API service.
 * "Gołąb" means "pigeon" in Polish, specifically a carrier pigeon (gołąb pocztowy)
 */

import type { ExecutionContext } from '@cloudflare/workers-types';

export interface ContactFormData {
  email: string;
  subject: string;
  message: string;
  /**
   * Optional single attachment; only honored when ATTACHMENTS_ENABLED=true.
   * When disabled, presence of this field will cause a 400 error.
   */
  attachment?: AttachmentPayload;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Template data for main contact form email notifications
 */
export interface EmailTemplateData {
  email: string;
  subject: string;
  message: string;
  timestamp: string;
  domain: string;
}

/**
 * Template data for auto-reply emails sent to form submitters
 */
export interface AutoReplyTemplateData {
  senderEmail: string;
  originalSubject: string;
}

/**
 * Single file attachment payload (Base64 content only; remote URLs are not supported)
 */
export interface AttachmentPayload {
  filename: string;     // e.g., "document.json"
  contentType: string;  // MIME type, e.g., "application/json"
  content: string;      // Base64-encoded file content (no data: URI prefix)
}

/**
 * Template function type for generating email content
 */
export interface TemplateFunction<T> {
  (data: T): { html: string; text: string };
}

export interface EmailService {
  sendEmail(data: ContactFormData, request?: Request, attachment?: AttachmentPayload): Promise<boolean>;
  sendAutoReply(data: ContactFormData): Promise<boolean>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  error: string;
  details?: ValidationError[] | undefined;
  timestamp: string;
}

export interface Environment extends Record<string, string> {
  TARGET_EMAIL: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  ALLOWED_ORIGINS?: string;
  ENABLE_AUTO_REPLY?: string;
  AUTO_REPLY_FROM_EMAIL?: string;
  BANNED_WORDS?: string;
  API_KEY?: string;
  EMAIL_DOMAIN_WHITELIST?: string;
  EMAIL_DOMAIN_BLACKLIST?: string;
  EMAIL_ADDRESS_BLACKLIST?: string;
  
  // Rate limiting configuration (runtime)
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // Global rate limiting
  RATE_LIMIT_GLOBAL_ENABLED?: string;
  RATE_LIMIT_GLOBAL_LIMIT?: string;
  RATE_LIMIT_GLOBAL_WINDOW?: string;
  
  // Per-IP rate limiting
  RATE_LIMIT_IP_ENABLED?: string;
  RATE_LIMIT_IP_LIMIT?: string;
  RATE_LIMIT_IP_WINDOW?: string;
  
  // Per-email rate limiting
  RATE_LIMIT_EMAIL_ENABLED?: string;
  RATE_LIMIT_EMAIL_LIMIT?: string;
  RATE_LIMIT_EMAIL_WINDOW?: string;

  // Attachments configuration (runtime)
  ATTACHMENTS_ENABLED?: string;                // "true" | "false" (default: false)
  ATTACHMENTS_MAX_FILE_SIZE_BYTES?: string;    // per-file limit (default: 10485760 = 10MB)
  ATTACHMENTS_MIME_WHITELIST?: string;         // semicolon-separated MIME types
  ATTACHMENTS_MIME_BLACKLIST?: string;         // semicolon-separated MIME types
}

export interface RequestContext {
  request: Request;
  env: Environment;
  ctx: ExecutionContext;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  global: {
    enabled: boolean;
    limit: number;
    window: number; // seconds
  };
  ip: {
    enabled: boolean;
    limit: number;
    window: number; // seconds
  };
  email: {
    enabled: boolean;
    limit: number;
    window: number; // seconds
  };
  redisFailureMode: 'open' | 'closed';
}

/**
 * Rate limiting check result
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  resetTime?: number; // Unix timestamp
  remaining?: number;
}

/**
 * Rate limiting service interface
 */
export interface RateLimitService {
  checkRateLimit(ip: string, email: string): Promise<RateLimitResult>;
  incrementCounters(ip: string, email: string): Promise<void>;
}

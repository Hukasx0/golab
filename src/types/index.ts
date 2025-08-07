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
 * Template function type for generating email content
 */
export interface TemplateFunction<T> {
  (data: T): { html: string; text: string };
}

export interface EmailService {
  sendEmail(data: ContactFormData, request?: Request): Promise<boolean>;
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
  BANNED_WORDS?: string;
  API_KEY?: string;
  EMAIL_DOMAIN_WHITELIST?: string;
  EMAIL_DOMAIN_BLACKLIST?: string;
  EMAIL_ADDRESS_BLACKLIST?: string;
}

export interface RequestContext {
  request: Request;
  env: Environment;
  ctx: ExecutionContext;
}

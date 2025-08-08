/**
 * Validation utilities for Gołąb contact form API
 */

import { z } from 'zod';
import type { ContactFormData, ValidationError } from '@/types';
import {
  SUBJECT_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  MESSAGE_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  VALIDATION_LIMITS
} from './env-config';

// Contact form validation schema with configurable limits (build-time)
// Using strictObject to reject any additional fields
export const contactFormSchema = z.strictObject({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please provide a valid email address')
    .max(EMAIL_MAX_LENGTH, 'Email address is too long'), // Email limit is always 320 (RFC 5321 standard)
  
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(SUBJECT_MAX_LENGTH, `Subject must be less than ${SUBJECT_MAX_LENGTH} characters`)
    .trim(),
  
  message: z
    .string()
    .min(1, 'Message is required')
    .min(MESSAGE_MIN_LENGTH, `Message must be at least ${MESSAGE_MIN_LENGTH} characters long`)
    .max(MESSAGE_MAX_LENGTH, `Message must be less than ${MESSAGE_MAX_LENGTH} characters`)
    .trim()
});

/**
 * Re-export the configured limits for use in tests and other modules
 */
export { VALIDATION_LIMITS };

/**
 * Validates contact form data
 * @param data - Raw form data to validate
 * @returns Validation result with parsed data or errors
 */
export function validateContactForm(data: unknown): {
  success: boolean;
  data?: ContactFormData;
  errors?: ValidationError[];
} {
  try {
    const validatedData = contactFormSchema.parse(data);
    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Check if error contains unrecognized keys (additional fields)
      const hasUnrecognizedKeys = error.errors.some(err => err.code === 'unrecognized_keys');
      
      if (hasUnrecognizedKeys) {
        // Log potential bot/honeypot attempt
        const unrecognizedFields = error.errors
          .filter(err => err.code === 'unrecognized_keys')
          .map(err => (err as any).keys)
          .flat();
          
        console.warn('Contact form rejected: Additional fields detected (potential bot)', {
          unrecognizedFields,
          timestamp: new Date().toISOString(),
          requestData: typeof data === 'object' && data !== null ? Object.keys(data) : 'invalid'
        });
      }
      
      const validationErrors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return {
        success: false,
        errors: validationErrors
      };
    }
    
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }]
    };
  }
}

/**
 * Sanitizes text content to prevent XSS
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates email format (additional check)
 * @param email - Email to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if contact form data contains any banned words
 * @param data - Contact form data to check
 * @param bannedWordsEnv - Semicolon-separated banned words from environment variable
 * @returns True if banned words are found, false otherwise
 */
export function containsBannedWords(data: ContactFormData, bannedWordsEnv?: string): boolean {
  // If no banned words configured, allow all content
  if (!bannedWordsEnv || bannedWordsEnv.trim() === '') {
    return false;
  }

  // Parse banned words from environment variable
  const bannedWords = bannedWordsEnv
    .split(';')
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length > 0);

  // If no valid banned words after parsing, allow all content
  if (bannedWords.length === 0) {
    return false;
  }

  // Combine all text content to check
  const contentToCheck = [
    data.email,
    data.subject,
    data.message
  ].join(' ').toLowerCase();

  // Check if any banned word is found in the content
  return bannedWords.some(bannedWord => contentToCheck.includes(bannedWord));
}

/**
 * Validates API key from request header
 * @param request - The incoming request
 * @param expectedApiKey - The expected API key from environment variables
 * @returns Object with validation result and error message if applicable
 */
export function validateApiKey(request: Request, expectedApiKey?: string): {
  isValid: boolean;
  error?: string;
} {
  // If no API key is configured, skip validation (backward compatibility)
  if (!expectedApiKey || expectedApiKey.trim() === '') {
    return { isValid: true };
  }

  // Get API key from X-API-Key header
  const providedApiKey = request.headers.get('X-API-Key');

  // Check if API key header is missing
  if (!providedApiKey) {
    return {
      isValid: false,
      error: 'API key is required. Please provide a valid API key in the X-API-Key header.'
    };
  }

  // Check if API key matches
  if (providedApiKey !== expectedApiKey) {
    return {
      isValid: false,
      error: 'Invalid API key. Please provide a valid API key in the X-API-Key header.'
    };
  }

  return { isValid: true };
}

/**
 * Extracts domain from email address
 * @param email - Email address to extract domain from
 * @returns Domain part of the email address (lowercase)
 */
export function extractEmailDomain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === email.length - 1) {
    return '';
  }
  
  // Check for multiple consecutive @ symbols
  const beforeAt = email.substring(0, atIndex);
  if (beforeAt.includes('@')) {
    // This handles cases like user@@domain.com
    return '';
  }
  
  const domain = email.substring(atIndex + 1).toLowerCase();
  
  // Basic domain validation - must contain at least one dot and valid characters
  if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return '';
  }
  
  return domain;
}

/**
 * Parses semicolon-separated list from environment variable
 * @param envValue - Environment variable value
 * @returns Array of trimmed, lowercase values
 */
function parseEmailFilterList(envValue?: string): string[] {
  if (!envValue || envValue.trim() === '') {
    return [];
  }

  return envValue
    .split(';')
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length > 0);
}

/**
 * Validates if email is allowed based on domain whitelist, domain blacklist, and email blacklist
 * Priority: Whitelist Domains < Blacklist Domains < Blacklist Emails
 * 
 * @param email - Email address to validate
 * @param domainWhitelist - Semicolon-separated list of allowed domains
 * @param domainBlacklist - Semicolon-separated list of blocked domains
 * @param emailBlacklist - Semicolon-separated list of blocked email addresses
 * @returns Object with validation result and error message if applicable
 */
export function isEmailAllowed(
  email: string,
  domainWhitelist?: string,
  domainBlacklist?: string,
  emailBlacklist?: string
): {
  isAllowed: boolean;
  reason?: string;
} {
  const emailLower = email.toLowerCase();
  const domain = extractEmailDomain(emailLower);

  // If domain extraction failed, block the email
  if (!domain) {
    return {
      isAllowed: false,
      reason: 'Invalid email format'
    };
  }

  // Parse filter lists
  const whitelistedDomains = parseEmailFilterList(domainWhitelist);
  const blacklistedDomains = parseEmailFilterList(domainBlacklist);
  const blacklistedEmails = parseEmailFilterList(emailBlacklist);

  // Priority 1: Check email address blacklist (highest priority)
  if (blacklistedEmails.includes(emailLower)) {
    return {
      isAllowed: false,
      reason: 'Email address is blacklisted'
    };
  }

  // Priority 2: Check domain blacklist
  if (blacklistedDomains.includes(domain)) {
    return {
      isAllowed: false,
      reason: 'Email domain is blacklisted'
    };
  }

  // Priority 3: Check domain whitelist (if configured)
  if (whitelistedDomains.length > 0) {
    if (!whitelistedDomains.includes(domain)) {
      return {
        isAllowed: false,
        reason: 'Email domain is not in whitelist'
      };
    }
  }

  // All checks passed
  return {
    isAllowed: true
  };
}

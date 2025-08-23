/**
 * Environment variable configuration for Gołąb contact form API
 *
 * HYBRID APPROACH: This module supports both build-time and runtime environment variables.
 * - Build-time variables are used for optimal performance in local development
 * - Runtime variables are used as fallback for Cloudflare Workers deployment
 *
 * For validation limits: Build-time parsing is preferred for zero runtime overhead
 * For rate limiting: Runtime detection is used to support Cloudflare Workers
 */

import type { Environment } from '@/types';

// Build-time environment variable declarations (injected by Bun --define)
declare const BUILD_SUBJECT_MAX_LENGTH: string | undefined;
declare const BUILD_MESSAGE_MIN_LENGTH: string | undefined;
declare const BUILD_MESSAGE_MAX_LENGTH: string | undefined;
declare const BUILD_RATE_LIMITING: string | undefined;
declare const BUILD_RATE_LIMIT_REDIS_FAILURE_MODE: string | undefined;
declare const BUILD_NODE_ENV: string | undefined;

/**
 * Gets build-time environment variable value
 * @param envVar - Environment variable name
 * @returns Environment variable value or undefined
 */
function getBuildTimeEnv(envVar: string): string | undefined {
  switch (envVar) {
    case 'SUBJECT_MAX_LENGTH':
      return typeof BUILD_SUBJECT_MAX_LENGTH !== 'undefined' ? BUILD_SUBJECT_MAX_LENGTH : undefined;
    case 'MESSAGE_MIN_LENGTH':
      return typeof BUILD_MESSAGE_MIN_LENGTH !== 'undefined' ? BUILD_MESSAGE_MIN_LENGTH : undefined;
    case 'MESSAGE_MAX_LENGTH':
      return typeof BUILD_MESSAGE_MAX_LENGTH !== 'undefined' ? BUILD_MESSAGE_MAX_LENGTH : undefined;
    case 'RATE_LIMITING':
      return typeof BUILD_RATE_LIMITING !== 'undefined' ? BUILD_RATE_LIMITING : undefined;
    case 'RATE_LIMIT_REDIS_FAILURE_MODE':
      return typeof BUILD_RATE_LIMIT_REDIS_FAILURE_MODE !== 'undefined' ? BUILD_RATE_LIMIT_REDIS_FAILURE_MODE : undefined;
    case 'NODE_ENV':
      return typeof BUILD_NODE_ENV !== 'undefined' ? BUILD_NODE_ENV : undefined;
    default:
      return undefined;
  }
}

/**
 * Parses and validates an environment variable as a positive integer
 * @param envVar - Environment variable name
 * @param defaultValue - Default value if env var is not set or invalid
 * @param warningThreshold - Value above/below which to show performance warnings
 * @param warningType - Type of warning ('above' | 'below')
 * @returns Parsed integer value or default
 */
function parseEnvLimit(
  envVar: string,
  defaultValue: number,
  warningThreshold?: number,
  warningType?: 'above' | 'below'
): number {
  const envValue = getBuildTimeEnv(envVar);
  
  // If not set or empty, use default
  if (!envValue || envValue.trim() === '') {
    return defaultValue;
  }
  
  const parsed = parseInt(envValue.trim(), 10);
  
  // Validate: must be a positive integer >= 1
  if (isNaN(parsed) || parsed < 1) {
    console.warn(
      `⚠️  [Gołąb] Invalid ${envVar}="${envValue}". Must be a positive integer >= 1. Using default: ${defaultValue}`
    );
    return defaultValue;
  }
  
  // Show performance/UX warnings for suboptimal values
  if (warningThreshold && warningType) {
    if (warningType === 'above' && parsed > warningThreshold) {
      console.warn(
        `⚠️  [Gołąb] ${envVar}=${parsed} is higher than recommended (${warningThreshold}). ` +
        `This may impact user experience or performance.`
      );
    } else if (warningType === 'below' && parsed < warningThreshold) {
      console.warn(
        `⚠️  [Gołąb] ${envVar}=${parsed} is lower than recommended (${warningThreshold}). ` +
        `This may impact user experience or performance`
      );
    }
  }
  
  return parsed;
}

/**
 * Parses and validates a boolean environment variable
 * @param envVar - Environment variable name
 * @param defaultValue - Default value if env var is not set or invalid
 * @returns Boolean value or default
 */
function parseEnvBoolean(envVar: string, defaultValue: boolean): boolean {
  const envValue = getBuildTimeEnv(envVar);
  
  // If not set or empty, use default
  if (!envValue || envValue.trim() === '') {
    return defaultValue;
  }
  
  const normalizedValue = envValue.trim().toLowerCase();
  
  // Accept common boolean representations
  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes') {
    return true;
  }
  
  if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no') {
    return false;
  }
  
  // Invalid value, warn and use default
  console.warn(
    `⚠️  [Gołąb] Invalid ${envVar}="${envValue}". Must be true/false, 1/0, or yes/no. Using default: ${defaultValue}`
  );
  return defaultValue;
}

// Parse environment variables at build time with validation and warnings
export const SUBJECT_MAX_LENGTH = parseEnvLimit('SUBJECT_MAX_LENGTH', 200, 200, 'above');
export const MESSAGE_MIN_LENGTH = parseEnvLimit('MESSAGE_MIN_LENGTH', 10, 10, 'below');
export const MESSAGE_MAX_LENGTH = parseEnvLimit('MESSAGE_MAX_LENGTH', 5000, 5000, 'above');

// Email limit is always fixed (RFC 5321 standard)
export const EMAIL_MAX_LENGTH = 320;

// Rate limiting configuration (build-time)
export const RATE_LIMITING_ENABLED = parseEnvBoolean('RATE_LIMITING', false);

// Redis failure mode configuration (build-time)
export const RATE_LIMIT_REDIS_FAILURE_MODE = (() => {
  const envValue = getBuildTimeEnv('RATE_LIMIT_REDIS_FAILURE_MODE');
  
  // If not set or empty, use default
  if (!envValue || envValue.trim() === '') {
    return 'open';
  }
  
  const normalizedValue = envValue.trim().toLowerCase();
  
  // Accept valid values
  if (normalizedValue === 'open' || normalizedValue === 'closed') {
    return normalizedValue as 'open' | 'closed';
  }
  
  // Invalid value, warn and use default
  console.warn(
    `⚠️  [Gołąb] Invalid RATE_LIMIT_REDIS_FAILURE_MODE="${envValue}". Must be "open" or "closed". Using default: "open"`
  );
  return 'open';
})();

// Export all limits as a const object for convenience
export const VALIDATION_LIMITS = {
  SUBJECT_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  MESSAGE_MAX_LENGTH,
  EMAIL_MAX_LENGTH
} as const;

/**
 * RUNTIME ENVIRONMENT VARIABLE DETECTION
 */

/**
 * Determines if rate limiting should be enabled
 * Checks build-time constant first, then falls back to runtime env var
 * @param env - Runtime environment variables
 * @returns true if rate limiting should be enabled
 */
export function isRateLimitingEnabled(env: Environment): boolean {
  // 1. Check build-time constant (local development)
  if (typeof BUILD_RATE_LIMITING !== 'undefined') {
    return BUILD_RATE_LIMITING === 'true';
  }
  
  // 2. Fallback to runtime environment variable
  return env['RATE_LIMITING']?.toLowerCase() === 'true';
}

/**
 * Determines the Redis failure mode for rate limiting
 * Checks build-time constant first, then falls back to runtime env var
 * @param env - Runtime environment variables
 * @returns 'open' or 'closed' failure mode
 */
export function getRateLimitFailureMode(env: Environment): 'open' | 'closed' {
  // 1. Check build-time constant (local development)
  if (typeof BUILD_RATE_LIMIT_REDIS_FAILURE_MODE !== 'undefined') {
    const mode = BUILD_RATE_LIMIT_REDIS_FAILURE_MODE.toLowerCase();
    return mode === 'closed' ? 'closed' : 'open';
  }
  
  // 2. Fallback to runtime environment variable (Cloudflare Workers)
  const runtimeMode = env['RATE_LIMIT_REDIS_FAILURE_MODE']?.toLowerCase();
  return runtimeMode === 'closed' ? 'closed' : 'open';
}

// Log configuration for debugging (only in development)
if (getBuildTimeEnv('NODE_ENV') !== 'production') {
  console.log(`🕊️  [Gołąb] Build-time configuration:
  - Subject max length: ${SUBJECT_MAX_LENGTH}
  - Message min length: ${MESSAGE_MIN_LENGTH}
  - Message max length: ${MESSAGE_MAX_LENGTH}
  - Email max length: ${EMAIL_MAX_LENGTH} (fixed)
  - Rate limiting enabled (build-time): ${RATE_LIMITING_ENABLED}
  - Rate limiting failure mode (build-time): ${RATE_LIMIT_REDIS_FAILURE_MODE}`);
}

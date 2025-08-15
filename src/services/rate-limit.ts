/**
 * Rate limiting service for Gołąb contact form API
 * Integrates with Upstash Redis to provide flexible rate limiting
 */

import { Redis } from '@upstash/redis';
import type { Environment, RateLimitConfig, RateLimitResult, RateLimitService } from '@/types';

/**
 * Rate limiting service implementation using Upstash Redis
 */
export class UpstashRateLimitService implements RateLimitService {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redisUrl: string, redisToken: string, config: RateLimitConfig) {
    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    this.config = config;
  }

  /**
   * Checks rate limits for IP, email, and global counters
   * @param ip - Client IP address
   * @param email - Sender email address
   * @returns Rate limit check result
   */
  async checkRateLimit(ip: string, email: string): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const checks: Promise<RateLimitResult>[] = [];

      // Check global rate limit
      if (this.config.global.enabled) {
        checks.push(this.checkLimit('global', 'all', this.config.global.limit, this.config.global.window, now));
      }

      // Check IP rate limit
      if (this.config.ip.enabled) {
        checks.push(this.checkLimit('ip', ip, this.config.ip.limit, this.config.ip.window, now));
      }

      // Check email rate limit
      if (this.config.email.enabled) {
        checks.push(this.checkLimit('email', email.toLowerCase(), this.config.email.limit, this.config.email.window, now));
      }

      // If no checks are enabled, allow the request
      if (checks.length === 0) {
        return { allowed: true };
      }

      // Wait for all checks to complete
      const results = await Promise.all(checks);

      // Find the first failed check
      const failedCheck = results.find(result => !result.allowed);
      if (failedCheck) {
        return failedCheck;
      }

      // All checks passed
      return { allowed: true };

    } catch (error) {
      console.error('Rate limit check failed:', error);
      // On Redis failure, allow the request (fail open)
      return { allowed: true };
    }
  }

  /**
   * Increments counters after successful email send
   * @param ip - Client IP address
   * @param email - Sender email address
   */
  async incrementCounters(ip: string, email: string): Promise<void> {
    try {
      const now = Date.now();
      const promises: Promise<any>[] = [];

      // Increment global counter
      if (this.config.global.enabled) {
        promises.push(this.incrementCounter('global', 'all', this.config.global.window, now));
      }

      // Increment IP counter
      if (this.config.ip.enabled) {
        promises.push(this.incrementCounter('ip', ip, this.config.ip.window, now));
      }

      // Increment email counter
      if (this.config.email.enabled) {
        promises.push(this.incrementCounter('email', email.toLowerCase(), this.config.email.window, now));
      }

      // Execute all increments
      await Promise.all(promises);

    } catch (error) {
      console.error('Failed to increment rate limit counters:', error);
      // Don't throw - this is non-critical for the email sending process
    }
  }

  /**
   * Checks a specific rate limit
   * @param type - Type of limit (global, ip, email)
   * @param identifier - Unique identifier for the limit
   * @param limit - Maximum allowed requests
   * @param window - Time window in seconds
   * @param now - Current timestamp
   * @returns Rate limit check result
   */
  private async checkLimit(
    type: string,
    identifier: string,
    limit: number,
    window: number,
    now: number
  ): Promise<RateLimitResult> {
    const windowStart = Math.floor(now / 1000 / window) * window;
    const key = `golab:${type}:${identifier}:${windowStart}`;

    try {
      const current = await this.redis.get<number>(key) || 0;
      
      if (current >= limit) {
        const resetTime = (windowStart + window) * 1000; // Convert to milliseconds
        return {
          allowed: false,
          reason: `Rate limit exceeded for ${type}`,
          resetTime,
          remaining: 0
        };
      }

      return {
        allowed: true,
        remaining: limit - current
      };

    } catch (error) {
      console.error(`Failed to check ${type} rate limit:`, error);
      // On error, allow the request (fail open)
      return { allowed: true };
    }
  }

  /**
   * Increments a counter with TTL
   * @param type - Type of counter (global, ip, email)
   * @param identifier - Unique identifier for the counter
   * @param window - Time window in seconds
   * @param now - Current timestamp
   */
  private async incrementCounter(
    type: string,
    identifier: string,
    window: number,
    now: number
  ): Promise<void> {
    const windowStart = Math.floor(now / 1000 / window) * window;
    const key = `golab:${type}:${identifier}:${windowStart}`;
    const ttl = window + 60; // Add 60 seconds buffer for cleanup

    try {
      // Use pipeline for atomic increment and expire
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttl);
      await pipeline.exec();

    } catch (error) {
      console.error(`Failed to increment ${type} counter:`, error);
      // Don't throw - this is non-critical
    }
  }
}

/**
 * Parses rate limiting configuration from environment variables
 * @param env - Environment variables
 * @returns Rate limiting configuration
 */
export function parseRateLimitConfig(env: Environment): RateLimitConfig {
  return {
    global: {
      enabled: env.RATE_LIMIT_GLOBAL_ENABLED?.toLowerCase() === 'true' || 
               (env.RATE_LIMIT_GLOBAL_ENABLED === undefined && true), // Default: enabled
      limit: parseInt(env.RATE_LIMIT_GLOBAL_LIMIT || '10', 10),
      window: parseInt(env.RATE_LIMIT_GLOBAL_WINDOW || '3600', 10) // Default: 1 hour
    },
    ip: {
      enabled: env.RATE_LIMIT_IP_ENABLED?.toLowerCase() === 'true', // Default: disabled
      limit: parseInt(env.RATE_LIMIT_IP_LIMIT || '5', 10),
      window: parseInt(env.RATE_LIMIT_IP_WINDOW || '3600', 10) // Default: 1 hour
    },
    email: {
      enabled: env.RATE_LIMIT_EMAIL_ENABLED?.toLowerCase() === 'true' || 
               (env.RATE_LIMIT_EMAIL_ENABLED === undefined && true), // Default: enabled
      limit: parseInt(env.RATE_LIMIT_EMAIL_LIMIT || '1', 10),
      window: parseInt(env.RATE_LIMIT_EMAIL_WINDOW || '3600', 10) // Default: 1 hour
    }
  };
}

/**
 * Factory function to create rate limiting service
 * @param env - Environment variables
 * @returns Rate limiting service instance or null if not configured
 */
export function createRateLimitService(env: Environment): RateLimitService | null {
  // Check if Redis is configured
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('⚠️  [Gołąb] Rate limiting enabled but Upstash Redis not configured. Rate limiting will be disabled.');
    return null;
  }

  const config = parseRateLimitConfig(env);
  
  // Check if any rate limiting is actually enabled
  if (!config.global.enabled && !config.ip.enabled && !config.email.enabled) {
    console.log('ℹ️  [Gołąb] All rate limiting options are disabled.');
    return null;
  }

  try {
    return new UpstashRateLimitService(
      env.UPSTASH_REDIS_REST_URL,
      env.UPSTASH_REDIS_REST_TOKEN,
      config
    );
  } catch (error) {
    console.error('Failed to create rate limiting service:', error);
    return null;
  }
}

/**
 * Extracts real IP address from request headers
 * Prioritizes Cloudflare's CF-Connecting-IP header
 * @param request - HTTP request
 * @returns IP address or 'unknown'
 */
export function extractRealIP(request: Request): string {
  // Try Cloudflare's real IP header first
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Try other common headers
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const firstIP = xForwardedFor.split(',')[0];
    return firstIP ? firstIP.trim() : 'unknown';
  }

  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) {
    return xRealIP;
  }

  // Fallback to unknown if no IP headers are found
  return 'unknown';
}
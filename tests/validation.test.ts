/**
 * Tests for validation utilities
 */

import { expect, test, describe, mock } from 'bun:test';
import { validateContactForm, sanitizeText, isValidEmail, containsBannedWords, validateApiKey, extractEmailDomain, isEmailAllowed, VALIDATION_LIMITS } from '@/utils/validation';
import type { ContactFormData } from '@/types';

describe('Contact Form Validation', () => {
  test('should validate correct contact form data', () => {
    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(validData);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
    expect(result.errors).toBeUndefined();
  });

  test('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('email');
    expect(result.errors?.[0]?.message).toContain('valid email');
  });

  test('should reject empty email', () => {
    const invalidData = {
      email: '',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('email');
    expect(result.errors?.[0]?.message).toContain('required');
  });

  test('should reject empty subject', () => {
    const invalidData = {
      email: 'test@example.com',
      subject: '',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('subject');
    expect(result.errors?.[0]?.message).toContain('required');
  });

  test('should reject short message', () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Short'
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('message');
    expect(result.errors?.[0]?.message).toContain(`at least ${VALIDATION_LIMITS.MESSAGE_MIN_LENGTH} characters`);
  });

  test('should reject too long subject', () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'A'.repeat(VALIDATION_LIMITS.SUBJECT_MAX_LENGTH + 1), // One character over limit
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('subject');
    expect(result.errors?.[0]?.message).toContain(`less than ${VALIDATION_LIMITS.SUBJECT_MAX_LENGTH} characters`);
  });

  test('should reject too long message', () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'A'.repeat(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH + 1) // One character over limit
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('message');
    expect(result.errors?.[0]?.message).toContain(`less than ${VALIDATION_LIMITS.MESSAGE_MAX_LENGTH} characters`);
  });

  test('should handle multiple validation errors', () => {
    const invalidData = {
      email: 'invalid-email',
      subject: '',
      message: 'Short'
    };

    const result = validateContactForm(invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(3);
  });

  test('should trim whitespace from subject and message', () => {
    const dataWithWhitespace = {
      email: 'test@example.com',
      subject: '  Test Subject  ',
      message: '  This is a test message with enough characters.  '
    };

    const result = validateContactForm(dataWithWhitespace);

    expect(result.success).toBe(true);
    expect(result.data?.subject).toBe('Test Subject');
    expect(result.data?.message).toBe('This is a test message with enough characters.');
  });
test('should handle non-Zod validation errors', () => {
    // Create a scenario that would cause a non-Zod error
    // We'll mock the schema.parse to throw a non-Zod error
    const mockParse = mock(() => {
      throw new Error('Non-Zod error');
    });

    // Temporarily replace the parse method
    const { contactFormSchema } = require('@/utils/validation');
    const originalSchemaParse = contactFormSchema.parse;
    contactFormSchema.parse = mockParse;

    const testData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(testData);

    // Restore original parse method
    contactFormSchema.parse = originalSchemaParse;

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.field).toBe('unknown');
    expect(result.errors?.[0]?.message).toBe('Validation failed');
  });
});

describe('Validation Limits Configuration', () => {
  test('should export validation limits constants', () => {
    expect(VALIDATION_LIMITS).toBeDefined();
    expect(typeof VALIDATION_LIMITS.SUBJECT_MAX_LENGTH).toBe('number');
    expect(typeof VALIDATION_LIMITS.MESSAGE_MIN_LENGTH).toBe('number');
    expect(typeof VALIDATION_LIMITS.MESSAGE_MAX_LENGTH).toBe('number');
    expect(typeof VALIDATION_LIMITS.EMAIL_MAX_LENGTH).toBe('number');
  });

  test('should have reasonable default values', () => {
    // These should be the default values when no env vars are set
    expect(VALIDATION_LIMITS.SUBJECT_MAX_LENGTH).toBeGreaterThan(0);
    expect(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH).toBeGreaterThan(0);
    expect(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH).toBeGreaterThan(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH);
    expect(VALIDATION_LIMITS.EMAIL_MAX_LENGTH).toBe(320); // Fixed value
  });

  test('should validate subject at exact limit', () => {
    const validData = {
      email: 'test@example.com',
      subject: 'A'.repeat(VALIDATION_LIMITS.SUBJECT_MAX_LENGTH), // Exactly at limit
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(validData);
    expect(result.success).toBe(true);
  });

  test('should validate message at exact minimum length', () => {
    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'A'.repeat(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH) // Exactly at minimum
    };

    const result = validateContactForm(validData);
    expect(result.success).toBe(true);
  });

  test('should validate message at exact maximum length', () => {
    const validData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'A'.repeat(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH) // Exactly at maximum
    };

    const result = validateContactForm(validData);
    expect(result.success).toBe(true);
  });

  test('should validate email at exact maximum length', () => {
    // Create an email exactly 320 characters long
    const localPart = 'a'.repeat(64); // Max local part length
    const domain = 'b'.repeat(251) + '.com'; // Domain part to make total 320
    const email = `${localPart}@${domain}`;
    
    expect(email.length).toBe(320);

    const validData = {
      email: email,
      subject: 'Test Subject',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(validData);
    expect(result.success).toBe(true);
  });

  test('should reject email over maximum length', () => {
    // Create an email over 320 characters
    const localPart = 'a'.repeat(64);
    const domain = 'b'.repeat(252) + '.com'; // One character too long
    const email = `${localPart}@${domain}`;
    
    expect(email.length).toBe(321);

    const invalidData = {
      email: email,
      subject: 'Test Subject',
      message: 'This is a test message with enough characters.'
    };

    const result = validateContactForm(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.field).toBe('email');
    expect(result.errors?.[0]?.message).toContain('too long');
  });

  test('should reject message one character below minimum', () => {
    const invalidData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'A'.repeat(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH - 1) // One character below minimum
    };

    const result = validateContactForm(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.field).toBe('message');
    expect(result.errors?.[0]?.message).toContain(`at least ${VALIDATION_LIMITS.MESSAGE_MIN_LENGTH} characters`);
  });

  test('should handle edge case with minimum possible values', () => {
    // Test that the limits are at least 1 (as enforced by parseEnvLimit)
    expect(VALIDATION_LIMITS.SUBJECT_MAX_LENGTH).toBeGreaterThanOrEqual(1);
    expect(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH).toBeGreaterThanOrEqual(1);
    expect(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH).toBeGreaterThanOrEqual(1);
  });

  test('should ensure message max is greater than message min', () => {
    // This should always be true with reasonable defaults
    expect(VALIDATION_LIMITS.MESSAGE_MAX_LENGTH).toBeGreaterThan(VALIDATION_LIMITS.MESSAGE_MIN_LENGTH);
  });
});

describe('Text Sanitization', () => {
  test('should sanitize HTML characters', () => {
    const unsafeText = '<script>alert("xss")</script>';
    const sanitized = sanitizeText(unsafeText);
    
    expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
  });

  test('should sanitize quotes and apostrophes', () => {
    const unsafeText = `He said "Hello" and she said 'Hi'`;
    const sanitized = sanitizeText(unsafeText);
    
    expect(sanitized).toBe('He said &quot;Hello&quot; and she said &#x27;Hi&#x27;');
  });

  test('should handle empty string', () => {
    const sanitized = sanitizeText('');
    expect(sanitized).toBe('');
  });
});

describe('Email Validation', () => {
  test('should validate correct email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@test-domain.com'
    ];

    validEmails.forEach(email => {
      expect(isValidEmail(email)).toBe(true);
    });
  });
  
  describe('Banned Words Validation', () => {
    const validFormData: ContactFormData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a clean test message with enough characters.'
    };
  
    test('should allow content when no banned words are configured', () => {
      const result = containsBannedWords(validFormData, undefined);
      expect(result).toBe(false);
    });
  
    test('should allow content when banned words env is empty string', () => {
      const result = containsBannedWords(validFormData, '');
      expect(result).toBe(false);
    });
  
    test('should allow content when banned words env is only whitespace', () => {
      const result = containsBannedWords(validFormData, '   ');
      expect(result).toBe(false);
    });
  
    test('should allow content when no banned words match', () => {
      const bannedWords = 'spam;badword;casino;lottery';
      const result = containsBannedWords(validFormData, bannedWords);
      expect(result).toBe(false);
    });
  
    test('should block content when banned word is in email', () => {
      const formData: ContactFormData = {
        email: 'spam@example.com',
        subject: 'Test Subject',
        message: 'This is a clean test message.'
      };
      const bannedWords = 'spam;badword;casino';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should block content when banned word is in subject', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'Win the lottery now!',
        message: 'This is a clean test message.'
      };
      const bannedWords = 'spam;badword;lottery';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should block content when banned word is in message', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This message contains casino advertisements.'
      };
      const bannedWords = 'spam;casino;lottery';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should be case-insensitive', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'SPAM Alert',
        message: 'This is a test message.'
      };
      const bannedWords = 'spam;badword;casino';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should handle mixed case in banned words configuration', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'spam alert',
        message: 'This is a test message.'
      };
      const bannedWords = 'SPAM;badword;CaSiNo';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should detect multiple banned words', () => {
      const formData: ContactFormData = {
        email: 'spam@example.com',
        subject: 'Casino lottery',
        message: 'Buy badword now!'
      };
      const bannedWords = 'spam;badword;casino;lottery';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should handle banned words with extra whitespace', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'spam alert',
        message: 'This is a test message.'
      };
      const bannedWords = ' spam ; badword ; casino ';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should ignore empty banned words after splitting', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'Clean subject',
        message: 'Clean message content.'
      };
      const bannedWords = 'spam;;badword;;;casino;';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(false);
    });
  
    test('should handle partial word matches', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'Spamming is bad',
        message: 'This message discusses spamming.'
      };
      const bannedWords = 'spam;badword;casino';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should handle single banned word', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'spam alert',
        message: 'This is a test message.'
      };
      const bannedWords = 'spam';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(true);
    });
  
    test('should handle special characters in content', () => {
      const formData: ContactFormData = {
        email: 'test@example.com',
        subject: 'Special chars: !@#$%^&*()',
        message: 'Message with special chars: <>?":{}|'
      };
      const bannedWords = 'spam;badword;casino';
      const result = containsBannedWords(formData, bannedWords);
      expect(result).toBe(false);
    });
  });
  
  describe('API Key Validation', () => {
    test('should allow requests when no API key is configured', () => {
      const request = { headers: { get: () => null } };
      const result = validateApiKey(request as any, undefined);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  
    test('should allow requests when API key is empty string', () => {
      const request = { headers: { get: () => null } };
      const result = validateApiKey(request as any, '');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  
    test('should allow requests when API key is whitespace only', () => {
      const request = { headers: { get: () => null } };
      const result = validateApiKey(request as any, '   ');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  
    test('should reject requests without API key header when authentication is enabled', () => {
      const request = { headers: { get: () => null } };
      const result = validateApiKey(request as any, 'test-api-key');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key is required. Please provide a valid API key in the X-API-Key header.');
    });
  
    test('should reject requests with invalid API key', () => {
      const request = {
        headers: {
          get: (key: string) => key === 'X-API-Key' ? 'wrong-key' : null
        }
      };
      const result = validateApiKey(request as any, 'test-api-key');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key. Please provide a valid API key in the X-API-Key header.');
    });
  
    test('should accept requests with valid API key', () => {
      const request = {
        headers: {
          get: (key: string) => key === 'X-API-Key' ? 'test-api-key' : null
        }
      };
      const result = validateApiKey(request as any, 'test-api-key');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  
    test('should handle case-sensitive API key comparison', () => {
      const request = {
        headers: {
          get: (key: string) => key === 'X-API-Key' ? 'Test-API-Key' : null
        }
      };
      const result = validateApiKey(request as any, 'test-api-key');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key. Please provide a valid API key in the X-API-Key header.');
    });
  
    test('should handle special characters in API key', () => {
      const specialKey = 'Kx7vQ2mR8nP5wL9sT3uY6bN1cF4hJ0eA2dG8iM7oS5k=';
      const request = {
        headers: {
          get: (key: string) => key === 'X-API-Key' ? specialKey : null
        }
      };
      const result = validateApiKey(request as any, specialKey);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  
    test('should handle empty API key header', () => {
      const request = {
        headers: {
          get: (key: string) => key === 'X-API-Key' ? '' : null
        }
      };
      const result = validateApiKey(request as any, 'test-api-key');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key is required. Please provide a valid API key in the X-API-Key header.');
    });
  
    test('should handle whitespace-only API key header', () => {
      const request = {
        headers: {
          get: (key: string) => key === 'X-API-Key' ? '   ' : null
        }
      };
      const result = validateApiKey(request as any, 'test-api-key');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key. Please provide a valid API key in the X-API-Key header.');
    });
  });

  test('should reject invalid email formats', () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@domain',
      'user.domain.com',
      ''
    ];

    invalidEmails.forEach(email => {
      expect(isValidEmail(email)).toBe(false);
    });
  });
});

describe('Email Domain Extraction', () => {
  test('should extract domain from valid email addresses', () => {
    const testCases = [
      { email: 'user@example.com', expected: 'example.com' },
      { email: 'test.user@subdomain.example.org', expected: 'subdomain.example.org' },
      { email: 'user+tag@domain.co.uk', expected: 'domain.co.uk' },
      { email: 'USER@EXAMPLE.COM', expected: 'example.com' }, // Should be lowercase
      { email: 'user@Example.Com', expected: 'example.com' }, // Mixed case
    ];

    testCases.forEach(({ email, expected }) => {
      expect(extractEmailDomain(email)).toBe(expected);
    });
  });

  test('should return empty string for invalid email formats', () => {
    const invalidEmails = [
      'invalid-email',
      'user@',
      '@domain.com',
      'user.domain.com',
      '',
      'user@@domain.com'
    ];

    invalidEmails.forEach(email => {
      expect(extractEmailDomain(email)).toBe('');
    });
  });

  test('should handle emails with multiple @ symbols correctly', () => {
    // Should return empty string for invalid format with multiple @ symbols
    expect(extractEmailDomain('user@company@domain.com')).toBe('');
  });
});

describe('Email Filtering', () => {
  describe('Empty Configuration (Allow All)', () => {
    test('should allow all emails when no filters are configured', () => {
      const result = isEmailAllowed('user@example.com');
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should allow all emails when all filters are empty strings', () => {
      const result = isEmailAllowed('user@example.com', '', '', '');
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should allow all emails when all filters are whitespace only', () => {
      const result = isEmailAllowed('user@example.com', '   ', '  ', ' ');
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Domain Whitelist Logic', () => {
    test('should allow emails from whitelisted domains', () => {
      const whitelist = 'example.com;trusted.org';
      
      expect(isEmailAllowed('user@example.com', whitelist).isAllowed).toBe(true);
      expect(isEmailAllowed('admin@trusted.org', whitelist).isAllowed).toBe(true);
    });

    test('should block emails from non-whitelisted domains', () => {
      const whitelist = 'example.com;trusted.org';
      
      const result = isEmailAllowed('user@blocked.com', whitelist);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Email domain is not in whitelist');
    });

    test('should be case-insensitive for domain whitelist', () => {
      const whitelist = 'EXAMPLE.COM;Trusted.Org';
      
      expect(isEmailAllowed('user@example.com', whitelist).isAllowed).toBe(true);
      expect(isEmailAllowed('USER@EXAMPLE.COM', whitelist).isAllowed).toBe(true);
      expect(isEmailAllowed('admin@trusted.org', whitelist).isAllowed).toBe(true);
    });

    test('should handle whitelist with extra whitespace', () => {
      const whitelist = ' example.com ; trusted.org ; ';
      
      expect(isEmailAllowed('user@example.com', whitelist).isAllowed).toBe(true);
      expect(isEmailAllowed('admin@trusted.org', whitelist).isAllowed).toBe(true);
    });

    test('should ignore empty entries in whitelist', () => {
      const whitelist = 'example.com;;trusted.org;';
      
      expect(isEmailAllowed('user@example.com', whitelist).isAllowed).toBe(true);
      expect(isEmailAllowed('admin@trusted.org', whitelist).isAllowed).toBe(true);
    });
  });

  describe('Domain Blacklist Logic', () => {
    test('should block emails from blacklisted domains', () => {
      const blacklist = 'spam.com;malicious.net';
      
      const result1 = isEmailAllowed('user@spam.com', undefined, blacklist);
      expect(result1.isAllowed).toBe(false);
      expect(result1.reason).toBe('Email domain is blacklisted');

      const result2 = isEmailAllowed('admin@malicious.net', undefined, blacklist);
      expect(result2.isAllowed).toBe(false);
      expect(result2.reason).toBe('Email domain is blacklisted');
    });

    test('should allow emails from non-blacklisted domains', () => {
      const blacklist = 'spam.com;malicious.net';
      
      expect(isEmailAllowed('user@example.com', undefined, blacklist).isAllowed).toBe(true);
      expect(isEmailAllowed('admin@trusted.org', undefined, blacklist).isAllowed).toBe(true);
    });

    test('should be case-insensitive for domain blacklist', () => {
      const blacklist = 'SPAM.COM;Malicious.Net';
      
      const result1 = isEmailAllowed('user@spam.com', undefined, blacklist);
      expect(result1.isAllowed).toBe(false);
      expect(result1.reason).toBe('Email domain is blacklisted');

      const result2 = isEmailAllowed('USER@SPAM.COM', undefined, blacklist);
      expect(result2.isAllowed).toBe(false);
      expect(result2.reason).toBe('Email domain is blacklisted');
    });
  });

  describe('Email Address Blacklist Logic', () => {
    test('should block specific blacklisted email addresses', () => {
      const emailBlacklist = 'spammer@example.com;bad@domain.com';
      
      const result1 = isEmailAllowed('spammer@example.com', undefined, undefined, emailBlacklist);
      expect(result1.isAllowed).toBe(false);
      expect(result1.reason).toBe('Email address is blacklisted');

      const result2 = isEmailAllowed('bad@domain.com', undefined, undefined, emailBlacklist);
      expect(result2.isAllowed).toBe(false);
      expect(result2.reason).toBe('Email address is blacklisted');
    });

    test('should allow non-blacklisted email addresses', () => {
      const emailBlacklist = 'spammer@example.com;bad@domain.com';
      
      expect(isEmailAllowed('user@example.com', undefined, undefined, emailBlacklist).isAllowed).toBe(true);
      expect(isEmailAllowed('good@domain.com', undefined, undefined, emailBlacklist).isAllowed).toBe(true);
    });

    test('should be case-insensitive for email address blacklist', () => {
      const emailBlacklist = 'SPAMMER@EXAMPLE.COM;Bad@Domain.Com';
      
      const result1 = isEmailAllowed('spammer@example.com', undefined, undefined, emailBlacklist);
      expect(result1.isAllowed).toBe(false);
      expect(result1.reason).toBe('Email address is blacklisted');

      const result2 = isEmailAllowed('SPAMMER@EXAMPLE.COM', undefined, undefined, emailBlacklist);
      expect(result2.isAllowed).toBe(false);
      expect(result2.reason).toBe('Email address is blacklisted');
    });
  });

  describe('Priority Logic Tests', () => {
    test('should prioritize email blacklist over domain blacklist', () => {
      const domainBlacklist = 'example.com';
      const emailBlacklist = 'user@example.com';
      
      // Email is in both domain blacklist and email blacklist
      // Should return email blacklist reason (higher priority)
      const result = isEmailAllowed('user@example.com', undefined, domainBlacklist, emailBlacklist);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Email address is blacklisted');
    });

    test('should prioritize email blacklist over domain whitelist', () => {
      const domainWhitelist = 'example.com';
      const emailBlacklist = 'user@example.com';
      
      // Domain is whitelisted but email is blacklisted
      // Email blacklist should win (highest priority)
      const result = isEmailAllowed('user@example.com', domainWhitelist, undefined, emailBlacklist);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Email address is blacklisted');
    });

    test('should prioritize domain blacklist over domain whitelist', () => {
      const domainWhitelist = 'example.com';
      const domainBlacklist = 'example.com';
      
      // Domain is in both whitelist and blacklist
      // Domain blacklist should win
      const result = isEmailAllowed('user@example.com', domainWhitelist, domainBlacklist);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Email domain is blacklisted');
    });

    test('should allow email when domain is whitelisted and not blacklisted', () => {
      const domainWhitelist = 'example.com;trusted.org';
      const domainBlacklist = 'spam.com';
      const emailBlacklist = 'spammer@example.com';
      
      // user@example.com: domain whitelisted, not in domain blacklist, not in email blacklist
      const result = isEmailAllowed('user@example.com', domainWhitelist, domainBlacklist, emailBlacklist);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle all filters together correctly', () => {
      const domainWhitelist = 'example.com;trusted.org';
      const domainBlacklist = 'example.com;spam.com'; // example.com is in both whitelist and blacklist
      const emailBlacklist = 'bad@trusted.org;evil@example.com';

      // Test cases with expected results
      const testCases = [
        // Blocked: domain is in both whitelist and blacklist, blacklist wins
        { email: 'user@example.com', expected: false, reason: 'Email domain is blacklisted' },
        
        // Allowed: whitelisted domain, not blacklisted
        { email: 'admin@trusted.org', expected: true },
        
        // Blocked: not in whitelist
        { email: 'user@other.com', expected: false, reason: 'Email domain is not in whitelist' },
        
        // Blocked: not in whitelist (random.com is not in whitelist, so whitelist check fails first)
        { email: 'user@random.com', expected: false, reason: 'Email domain is not in whitelist' },
        
        // Blocked: email blacklisted (highest priority)
        { email: 'bad@trusted.org', expected: false, reason: 'Email address is blacklisted' },
        { email: 'evil@example.com', expected: false, reason: 'Email address is blacklisted' },
      ];

      testCases.forEach(({ email, expected, reason }) => {
        const result = isEmailAllowed(email, domainWhitelist, domainBlacklist, emailBlacklist);
        expect(result.isAllowed).toBe(expected);
        if (!expected && reason) {
          expect(result.reason).toBe(reason);
        }
      });
    });

    test('should handle invalid email formats', () => {
      const result = isEmailAllowed('invalid-email', 'example.com');
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Invalid email format');
    });

    test('should handle empty domain extraction', () => {
      const result = isEmailAllowed('user@', 'example.com');
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Invalid email format');
    });
  });

  describe('Edge Cases', () => {
    test('should handle single domain in whitelist', () => {
      const result = isEmailAllowed('user@example.com', 'example.com');
      expect(result.isAllowed).toBe(true);
    });

    test('should handle single domain in blacklist', () => {
      const result = isEmailAllowed('user@spam.com', undefined, 'spam.com');
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Email domain is blacklisted');
    });

    test('should handle single email in blacklist', () => {
      const result = isEmailAllowed('spammer@example.com', undefined, undefined, 'spammer@example.com');
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Email address is blacklisted');
    });

    test('should handle special characters in email addresses', () => {
      const emailBlacklist = 'user+tag@example.com;user.name@domain.co.uk';
      
      const result1 = isEmailAllowed('user+tag@example.com', undefined, undefined, emailBlacklist);
      expect(result1.isAllowed).toBe(false);
      expect(result1.reason).toBe('Email address is blacklisted');

      const result2 = isEmailAllowed('user.name@domain.co.uk', undefined, undefined, emailBlacklist);
      expect(result2.isAllowed).toBe(false);
      expect(result2.reason).toBe('Email address is blacklisted');
    });

    test('should handle international domain names', () => {
      const domainWhitelist = 'example.com;münchen.de';
      
      expect(isEmailAllowed('user@example.com', domainWhitelist).isAllowed).toBe(true);
      expect(isEmailAllowed('user@münchen.de', domainWhitelist).isAllowed).toBe(true);
    });
  });
});

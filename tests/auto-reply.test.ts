/**
 * Auto-reply functionality tests for Gołąb contact form API
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ResendEmailService } from '@/services/email';
import type { ContactFormData, Environment } from '../src/types';

describe('Auto-Reply Email Service', () => {
  // Mock Resend within the describe block to avoid global conflicts
  const mockSend = mock(() => Promise.resolve({ data: { id: 'test-auto-reply-id' } }));
  const mockResend = {
    emails: {
      send: mockSend
    }
  };

  // Mock the Resend constructor
  mock.module('resend', () => ({
    Resend: mock(() => mockResend)
  }));
  let emailService: ResendEmailService;
  const testFormData: ContactFormData = {
    email: 'sender@example.com',
    subject: 'Test Contact Message',
    message: 'This is a test message from the contact form.'
  };

  const mockEnv: Environment = {
    RESEND_API_KEY: 'test-api-key',
    TARGET_EMAIL: 'target@example.com',
    FROM_EMAIL: 'noreply@example.com'
  };

  beforeEach(() => {
    mockSend.mockClear();
    emailService = new ResendEmailService(
      'test-api-key',
      'target@example.com',
      'noreply@example.com',
      mockEnv
    );
  });

  test('should send auto-reply email successfully', async () => {
    const result = await emailService.sendAutoReply(testFormData);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.from).toBe('noreply@example.com'); // Should use FROM_EMAIL as fallback
    expect(callArgs.to).toEqual(['sender@example.com']);
    expect(callArgs.subject).toBe('Thank you for your message - We\'ll get back to you soon');
    expect(callArgs.html).toContain('sender@example.com');
    expect(callArgs.html).toContain('Test Contact Message');
    expect(callArgs.text).toContain('Thank you for your message!');
  });

  test('should handle auto-reply sending failure', async () => {
    mockSend.mockImplementationOnce(() => Promise.resolve({ data: { id: '' } }));

    const result = await emailService.sendAutoReply(testFormData);

    expect(result).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should handle auto-reply service error', async () => {
    mockSend.mockImplementationOnce(() => Promise.reject(new Error('API Error')));

    const result = await emailService.sendAutoReply(testFormData);

    expect(result).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should sanitize email content in auto-reply', async () => {
    const maliciousData: ContactFormData = {
      email: 'test<script>alert("xss")</script>@example.com',
      subject: 'Test <img src="x" onerror="alert(1)"> Subject',
      message: 'Test message'
    };

    await emailService.sendAutoReply(maliciousData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.html).not.toContain('<script>');
    expect(callArgs.html).not.toContain('<img');
    expect(callArgs.html).toContain('&lt;script&gt;');
    expect(callArgs.html).toContain('&lt;img');
  });

  test('should include correct placeholders in auto-reply template', async () => {
    await emailService.sendAutoReply(testFormData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    
    // Check HTML content
    expect(callArgs.html).toContain('sender@example.com');
    expect(callArgs.html).toContain('Test Contact Message');
    expect(callArgs.html).toContain('Message Received!');
    expect(callArgs.html).toContain('Thank you for reaching out');
    
    // Check text content
    expect(callArgs.text).toContain('sender@example.com');
    expect(callArgs.text).toContain('Test Contact Message');
    expect(callArgs.text).toContain('Thank you for your message!');
    expect(callArgs.text).toContain('automated response');
  });

  test('should not include timestamp in auto-reply', async () => {
    await emailService.sendAutoReply(testFormData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    
    // Should not contain timestamp-related content
    expect(callArgs.html).not.toContain('{{TIMESTAMP}}');
    expect(callArgs.text).not.toContain('Received:');
  });

  test('should have proper email structure for auto-reply', async () => {
    await emailService.sendAutoReply(testFormData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    
    // Check required email fields
    expect(callArgs.from).toBeDefined();
    expect(callArgs.to).toBeDefined();
    expect(callArgs.subject).toBeDefined();
    expect(callArgs.html).toBeDefined();
    expect(callArgs.text).toBeDefined();
    
    // Should not have reply_to field (unlike main email)
    expect(callArgs.reply_to).toBeUndefined();
  });

  test('should include pigeon branding in auto-reply', async () => {
    await emailService.sendAutoReply(testFormData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.html).toContain('Gołąb');
    expect(callArgs.html).toContain('🕊️');
    expect(callArgs.html).toContain('carrier pigeon');
    expect(callArgs.text).toContain('Gołąb');
    expect(callArgs.text).toContain('carrier pigeon');
  });
// Tests for AUTO_REPLY_FROM_EMAIL functionality
  describe('AUTO_REPLY_FROM_EMAIL functionality', () => {
    const testAutoReplyFromEmail = 'Auto Reply <autoreply@example.com>';
    let emailServiceWithAutoReply: ResendEmailService;

    beforeEach(() => {
      mockSend.mockClear();
      emailServiceWithAutoReply = new ResendEmailService(
        'test-api-key',
        'target@example.com',
        'noreply@example.com',
        mockEnv,
        testAutoReplyFromEmail
      );
    });

    test('should use AUTO_REPLY_FROM_EMAIL when provided', async () => {
      const result = await emailServiceWithAutoReply.sendAutoReply(testFormData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.from).toBe(testAutoReplyFromEmail); // Should use AUTO_REPLY_FROM_EMAIL
      expect(callArgs.to).toEqual(['sender@example.com']);
      expect(callArgs.subject).toBe('Thank you for your message - We\'ll get back to you soon');
    });

    test('should handle AUTO_REPLY_FROM_EMAIL sending failure', async () => {
      mockSend.mockImplementationOnce(() => Promise.resolve({ data: { id: '' } }));

      const result = await emailServiceWithAutoReply.sendAutoReply(testFormData);

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs.from).toBe(testAutoReplyFromEmail);
    });

    test('should handle AUTO_REPLY_FROM_EMAIL service error', async () => {
      mockSend.mockImplementationOnce(() => Promise.reject(new Error('API Error')));

      const result = await emailServiceWithAutoReply.sendAutoReply(testFormData);

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should sanitize content with AUTO_REPLY_FROM_EMAIL', async () => {
      const maliciousData: ContactFormData = {
        email: 'test<script>alert("xss")</script>@example.com',
        subject: 'Test <img src="x" onerror="alert(1)"> Subject',
        message: 'Test message'
      };

      await emailServiceWithAutoReply.sendAutoReply(maliciousData);

      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.from).toBe(testAutoReplyFromEmail);
      expect(callArgs.html).not.toContain('<script>');
      expect(callArgs.html).not.toContain('<img');
      expect(callArgs.html).toContain('&lt;script&gt;');
      expect(callArgs.html).toContain('&lt;img');
    });
  });

  // Tests for AUTO_REPLY_SUBJECT functionality
  describe('AUTO_REPLY_SUBJECT functionality', () => {
    const customSubject = 'Custom Thank You Message';
    let emailServiceWithCustomSubject: ResendEmailService;
    const mockEnvWithCustomSubject: Environment = {
      ...mockEnv,
      AUTO_REPLY_SUBJECT: customSubject
    };

    beforeEach(() => {
      mockSend.mockClear();
      emailServiceWithCustomSubject = new ResendEmailService(
        'test-api-key',
        'target@example.com',
        'noreply@example.com',
        mockEnvWithCustomSubject
      );
    });

    test('should use custom AUTO_REPLY_SUBJECT when provided', async () => {
      const result = await emailServiceWithCustomSubject.sendAutoReply(testFormData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.subject).toBe(customSubject);
      expect(callArgs.to).toEqual(['sender@example.com']);
    });

    test('should use default subject when AUTO_REPLY_SUBJECT is not provided', async () => {
      const result = await emailService.sendAutoReply(testFormData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.subject).toBe("Thank you for your message - We'll get back to you soon");
    });

    test('should use default subject when AUTO_REPLY_SUBJECT is empty string', async () => {
      const mockEnvWithEmptySubject: Environment = {
        ...mockEnv,
        AUTO_REPLY_SUBJECT: ''
      };
      
      const emailServiceWithEmptySubject = new ResendEmailService(
        'test-api-key',
        'target@example.com',
        'noreply@example.com',
        mockEnvWithEmptySubject
      );

      const result = await emailServiceWithEmptySubject.sendAutoReply(testFormData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.subject).toBe("Thank you for your message - We'll get back to you soon");
    });

    test('should handle custom subject with special characters', async () => {
      const specialSubject = 'Dziękujemy za wiadomość! 🕊️ We\'ll respond soon';
      const mockEnvWithSpecialSubject: Environment = {
        ...mockEnv,
        AUTO_REPLY_SUBJECT: specialSubject
      };
      
      const emailServiceWithSpecialSubject = new ResendEmailService(
        'test-api-key',
        'target@example.com',
        'noreply@example.com',
        mockEnvWithSpecialSubject
      );

      const result = await emailServiceWithSpecialSubject.sendAutoReply(testFormData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.subject).toBe(specialSubject);
    });
  });
});

/**
 * Tests for email service
 */

import { expect, test, describe, mock, beforeEach } from 'bun:test';
import { ResendEmailService } from '@/services/email';
import type { ContactFormData, Environment } from '@/types';
import { generateEmailTemplate } from '../templates/email-template';
import { generateAutoReplyTemplate } from '../templates/auto-reply-template';

describe('ResendEmailService', () => {
  // Mock Resend within the describe block to avoid global conflicts
  const mockSend = mock(() => Promise.resolve({ data: { id: 'test-email-id' } }));
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
  const testApiKey = 'test-api-key';
  const testTargetEmail = 'target@example.com';
  const testFromEmail = 'Test Form <noreply@test.com>';

  const mockEnv: Environment = {
    RESEND_API_KEY: testApiKey,
    TARGET_EMAIL: testTargetEmail,
    FROM_EMAIL: testFromEmail
  };

  beforeEach(() => {
    mockSend.mockClear();
    emailService = new ResendEmailService(testApiKey, testTargetEmail, testFromEmail, mockEnv);
  });

  test('should send email successfully', async () => {
    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const result = await emailService.sendEmail(contactData);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.to).toEqual([testTargetEmail]);
    expect(callArgs.subject).toBe('Test Subject');
    expect(callArgs.reply_to).toBe('sender@example.com');
    expect(callArgs.html).toContain('sender@example.com');
    expect(callArgs.html).toContain('Test Subject');
    expect(callArgs.html).toContain('This is a test message');
    expect(callArgs.text).toContain('sender@example.com');
    expect(callArgs.text).toContain('Test Subject');
    expect(callArgs.text).toContain('This is a test message');
  });

  test('should handle email sending failure', async () => {
    // Mock a failed email send
    mockSend.mockImplementationOnce(() => Promise.resolve({ data: { id: '' } }));

    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const result = await emailService.sendEmail(contactData);

    expect(result).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should handle email service error', async () => {
    // Mock an error
    mockSend.mockImplementationOnce(() => Promise.reject(new Error('API Error')));

    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const result = await emailService.sendEmail(contactData);

    expect(result).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should sanitize email content', async () => {
    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: '<script>alert("xss")</script>',
      message: 'Message with <b>HTML</b> and "quotes" and \'apostrophes\''
    };

    await emailService.sendEmail(contactData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.html).not.toContain('<script>');
    expect(callArgs.html).toContain('&lt;script&gt;');
    expect(callArgs.html).not.toContain('<b>HTML</b>');
    expect(callArgs.html).toContain('&lt;b&gt;HTML&lt;&#x2F;b&gt;');
    expect(callArgs.html).toContain('&quot;quotes&quot;');
    expect(callArgs.html).toContain('&#x27;apostrophes&#x27;');
  });

  test('should include timestamp in email', async () => {
    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    await emailService.sendEmail(contactData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.html).toContain('Received:');
    expect(callArgs.text).toContain('Received:');
    
    // Check that timestamp is in a reasonable format
    const timestampMatch = callArgs.html.match(/Received: (.+?)</);
    expect(timestampMatch).toBeTruthy();
    
    if (timestampMatch) {
      const timestamp = timestampMatch[1];
      expect(timestamp).toMatch(/\d{4}/); // Should contain year
      expect(timestamp).toMatch(/UTC/); // Should contain timezone
    }
  });

  test('should include pigeon branding', async () => {
    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    await emailService.sendEmail(contactData);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.html).toContain('Gołąb');
    expect(callArgs.html).toContain('🕊️');
    expect(callArgs.html).toContain('carrier pigeon');
    expect(callArgs.text).toContain('Gołąb');
    expect(callArgs.text).toContain('🕊️');
    expect(callArgs.text).toContain('carrier pigeon');
  });

  test('should send auto-reply email successfully', async () => {
    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const result = await emailService.sendAutoReply(contactData);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.from).toBe(testFromEmail); // Should use FROM_EMAIL as fallback
    expect(callArgs.to).toEqual(['sender@example.com']);
    expect(callArgs.subject).toBe("Thank you for your message - We'll get back to you soon");
    expect(callArgs.html).toContain('sender@example.com');
    expect(callArgs.html).toContain('Test Subject');
    expect(callArgs.html).toContain('Message Received!');
    expect(callArgs.text).toContain('sender@example.com');
    expect(callArgs.text).toContain('Test Subject');
    expect(callArgs.text).toContain('Thank you for your message!');
  });

  test('should handle auto-reply email sending failure', async () => {
    // Mock a failed email send
    mockSend.mockImplementationOnce(() => Promise.resolve({ data: { id: '' } }));

    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    const result = await emailService.sendAutoReply(contactData);

    expect(result).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('should use type-safe template functions', () => {
    // Test that template functions work with type safety
    const emailTemplateData = {
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message',
      timestamp: '2025-01-01 12:00:00 UTC',
      domain: 'example.com'
    };

    const emailResult = generateEmailTemplate(emailTemplateData);
    expect(emailResult.html).toContain('test@example.com');
    expect(emailResult.html).toContain('Test Subject');
    expect(emailResult.html).toContain('Test Message');
    expect(emailResult.html).toContain('example.com');
    expect(emailResult.text).toContain('test@example.com');

    const autoReplyTemplateData = {
      senderEmail: 'sender@example.com',
      originalSubject: 'Original Subject'
    };

    const autoReplyResult = generateAutoReplyTemplate(autoReplyTemplateData);
    expect(autoReplyResult.html).toContain('sender@example.com');
    expect(autoReplyResult.html).toContain('Original Subject');
    expect(autoReplyResult.text).toContain('sender@example.com');
    expect(autoReplyResult.text).toContain('Original Subject');
  });

  test('should include domain information in email', async () => {
    const contactData: ContactFormData = {
      email: 'sender@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters to pass validation.'
    };

    // Create a mock request with origin header
    const mockRequest = new Request('https://example.com/contact', {
      method: 'POST',
      headers: {
        'Origin': 'https://example.com'
      }
    });

    await emailService.sendEmail(contactData, mockRequest);

    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.html).toContain('example.com');
    expect(callArgs.text).toContain('example.com');
  });
// Tests for AUTO_REPLY_FROM_EMAIL functionality
  describe('AUTO_REPLY_FROM_EMAIL functionality', () => {
    const testAutoReplyFromEmail = 'Auto Reply <autoreply@test.com>';
    let emailServiceWithAutoReply: ResendEmailService;

    beforeEach(() => {
      mockSend.mockClear();
      emailServiceWithAutoReply = new ResendEmailService(testApiKey, testTargetEmail, testFromEmail, mockEnv, testAutoReplyFromEmail);
    });

    test('should use AUTO_REPLY_FROM_EMAIL when provided', async () => {
      const contactData: ContactFormData = {
        email: 'sender@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const result = await emailServiceWithAutoReply.sendAutoReply(contactData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.from).toBe(testAutoReplyFromEmail); // Should use AUTO_REPLY_FROM_EMAIL
      expect(callArgs.to).toEqual(['sender@example.com']);
      expect(callArgs.subject).toBe("Thank you for your message - We'll get back to you soon");
    });

    test('should fallback to FROM_EMAIL when AUTO_REPLY_FROM_EMAIL is undefined', async () => {
      const emailServiceWithoutAutoReply = new ResendEmailService(testApiKey, testTargetEmail, testFromEmail, mockEnv, undefined);
      
      const contactData: ContactFormData = {
        email: 'sender@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const result = await emailServiceWithoutAutoReply.sendAutoReply(contactData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.from).toBe(testFromEmail); // Should fallback to FROM_EMAIL
    });

    test('should fallback to FROM_EMAIL when AUTO_REPLY_FROM_EMAIL is empty string', async () => {
      const emailServiceWithEmptyAutoReply = new ResendEmailService(testApiKey, testTargetEmail, testFromEmail, mockEnv, '');
      
      const contactData: ContactFormData = {
        email: 'sender@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const result = await emailServiceWithEmptyAutoReply.sendAutoReply(contactData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.from).toBe(testFromEmail); // Should fallback to FROM_EMAIL
    });

    test('should not affect regular email sending when AUTO_REPLY_FROM_EMAIL is set', async () => {
      const contactData: ContactFormData = {
        email: 'sender@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters to pass validation.'
      };

      const result = await emailServiceWithAutoReply.sendEmail(contactData);

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const callArgs = (mockSend.mock.calls as any)[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.from).toBe(testFromEmail); // Regular emails should still use FROM_EMAIL
      expect(callArgs.to).toEqual([testTargetEmail]);
      expect(callArgs.reply_to).toBe('sender@example.com');
    });
  });
});

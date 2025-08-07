/**
 * Auto-reply functionality tests for Gołąb contact form API
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ResendEmailService } from '@/services/email';
import type { ContactFormData } from '../src/types';

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

  beforeEach(() => {
    mockSend.mockClear();
    emailService = new ResendEmailService(
      'test-api-key',
      'target@example.com',
      'noreply@example.com'
    );
  });

  test('should send auto-reply email successfully', async () => {
    const result = await emailService.sendAutoReply(testFormData);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const callArgs = (mockSend.mock.calls as any)[0][0];
    expect(callArgs).toBeDefined();
    expect(callArgs.from).toBe('noreply@example.com');
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
});

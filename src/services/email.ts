/**
 * Email service for Gołąb contact form API
 * Integrates with Resend API to send contact form submissions
 */

import { Resend } from 'resend';
import type { ContactFormData, EmailService, Environment, EmailTemplateData, AutoReplyTemplateData } from '@/types';
import { sanitizeText } from '@/utils/validation';
import { generateEmailTemplate } from '../../templates/email-template';
import { generateAutoReplyTemplate, AUTO_REPLY_SUBJECT } from '../../templates/auto-reply-template';

/**
 * Email service implementation using Resend
 */
export class ResendEmailService implements EmailService {
  private resend: Resend;
  private targetEmail: string;
  private fromEmail: string;

  constructor(apiKey: string, targetEmail: string, fromEmail: string) {
    this.resend = new Resend(apiKey);
    this.targetEmail = targetEmail;
    this.fromEmail = fromEmail;
  }

  /**
   * Sends contact form data via email
   * @param data - Contact form data
   * @param request - Request object for extracting origin and IP info
   * @returns Promise<boolean> - Success status
   */
  async sendEmail(data: ContactFormData, request?: Request): Promise<boolean> {
    try {
      const emailContent = await this.generateEmailContent(data, request);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [this.targetEmail],
        subject: `${data.subject}`,
        html: emailContent.html,
        text: emailContent.text,
        reply_to: data.email, // Allow direct reply to the sender
      });

      return !!result.data?.id;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Sends auto-reply email to the form sender
   * @param data - Contact form data
   * @returns Promise<boolean> - Success status
   */
  async sendAutoReply(data: ContactFormData): Promise<boolean> {
    try {
      const autoReplyContent = this.generateAutoReplyContent(data);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [data.email],
        subject: AUTO_REPLY_SUBJECT,
        html: autoReplyContent.html,
        text: autoReplyContent.text,
      });

      return !!result.data?.id;
    } catch (error) {
      console.error('Failed to send auto-reply email:', error);
      return false;
    }
  }

  /**
   * Generates auto-reply email content using type-safe template function
   * @param data - Contact form data
   * @returns Auto-reply email template with content
   */
  private generateAutoReplyContent(data: ContactFormData): {
    html: string;
    text: string;
  } {
    // Prepare template data with type safety
    const templateData: AutoReplyTemplateData = {
      senderEmail: sanitizeText(data.email),
      originalSubject: sanitizeText(data.subject)
    };

    // Generate content using template function - no more .replace() calls!
    return generateAutoReplyTemplate(templateData);
  }

  /**
   * Generates email content using type-safe template function
   * @param data - Contact form data
   * @param request - Request object for extracting origin and IP info
   * @returns Email template with content
   */
  private async generateEmailContent(data: ContactFormData, request?: Request): Promise<{
    html: string;
    text: string;
  }> {
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Extract request information - only domain
    const origin = request?.headers.get('Origin') || request?.headers.get('Referer') || 'Unknown';
    
    // Extract domain from origin/referer
    let domain = 'Unknown';
    try {
      if (origin && origin !== 'Unknown') {
        domain = new URL(origin).hostname;
      }
    } catch {
      domain = origin;
    }

    // Prepare template data with type safety
    const templateData: EmailTemplateData = {
      email: sanitizeText(data.email),
      subject: sanitizeText(data.subject),
      message: sanitizeText(data.message),
      timestamp,
      domain: sanitizeText(domain)
    };

    // Generate content using template function
    return generateEmailTemplate(templateData);
  }

}

/**
 * Factory function to create email service
 * @param env - Environment variables
 * @returns Email service instance
 */
export function createEmailService(env: Environment): EmailService {
  return new ResendEmailService(env.RESEND_API_KEY, env.TARGET_EMAIL, env.FROM_EMAIL);
}

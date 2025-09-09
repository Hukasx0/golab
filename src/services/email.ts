/**
 * Email service for Gołąb contact form API
 * Integrates with Resend API to send contact form submissions
 */

import { Resend } from 'resend';
import type { ContactFormData, EmailService, Environment, EmailTemplateData, AutoReplyTemplateData, AttachmentPayload } from '@/types';
import { sanitizeText } from '@/utils/validation';
import { generateEmailTemplate } from '../../templates/email-template';
import { generateAutoReplyTemplate } from '../../templates/auto-reply-template';

// Derive the correct send options type from the Resend SDK without importing internal types
type EmailSendOptions = Parameters<InstanceType<typeof Resend>['emails']['send']>[0];

/**
 * Email service implementation using Resend
 */
class ResendEmailService implements EmailService {
  private resend: Resend;
  private targetEmail: string;
  private fromEmail: string;
  private autoReplyFromEmail: string;
  private env: Environment;

  constructor(apiKey: string, targetEmail: string, fromEmail: string, env: Environment, autoReplyFromEmail?: string) {
    this.resend = new Resend(apiKey);
    this.targetEmail = targetEmail;
    this.fromEmail = fromEmail;
    this.autoReplyFromEmail = autoReplyFromEmail || fromEmail;
    this.env = env;
  }

  /**
   * Sends contact form data via email
   * @param data - Contact form data
   * @param request - Request object for extracting origin and IP info
   * @returns Promise<boolean> - Success status
   */
  async sendEmail(data: ContactFormData, request?: Request, attachment?: AttachmentPayload): Promise<boolean> {
    try {
      const emailContent = await this.generateEmailContent(data, request);
      
      const options: EmailSendOptions = {
        from: this.fromEmail,
        to: [this.targetEmail],
        subject: `${data.subject}`,
        html: emailContent.html,
        text: emailContent.text,
        reply_to: data.email, // Allow direct reply to the sender
        // Include a single optional attachment (Base64) when provided
        ...(attachment ? { attachments: [{ content: attachment.content, filename: attachment.filename }] } : {})
      };

      const result = await this.resend.emails.send(options);

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
      const autoReplySubject = this.env['AUTO_REPLY_SUBJECT'] || "Thank you for your message - We'll get back to you soon";
      const autoReplyContent = this.generateAutoReplyContent(data);
      
      const options: EmailSendOptions = {
        from: this.autoReplyFromEmail,
        to: [data.email],
        subject: autoReplySubject,
        html: autoReplyContent.html,
        text: autoReplyContent.text
      };

      const result = await this.resend.emails.send(options);

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

// Explicit re-exports for compatibility with Bun's ESM resolver
export { ResendEmailService };
export default ResendEmailService;

/**
 * Factory function to create email service
 * @param env - Environment variables
 * @returns Email service instance
 */
export function createEmailService(env: Environment): EmailService {
  return new ResendEmailService(env.RESEND_API_KEY, env.TARGET_EMAIL, env.FROM_EMAIL, env, env.AUTO_REPLY_FROM_EMAIL);
}

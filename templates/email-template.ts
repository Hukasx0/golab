/**
 * Email template for Gołąb contact form notifications
 * This template is bundled into the Cloudflare Worker during compilation
 * 
 * Uses TypeScript template literals for type safety
 */

import type { EmailTemplateData } from '../src/types';

/**
 * Generates HTML and text email content for contact form notifications
 * @param data - Template data with type safety
 * @returns Object containing HTML and text versions of the email
 */
export const generateEmailTemplate = (data: EmailTemplateData): { html: string; text: string } => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Form Message</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 24px;
        }
        .header .subtitle {
            color: #6c757d;
            font-size: 14px;
            margin-top: 5px;
        }
        .field {
            margin-bottom: 20px;
        }
        .field-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 5px;
            display: block;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        .field-value {
            background-color: #f8f9fa;
            padding: 12px;
            border-radius: 4px;
            border-left: 4px solid #007bff;
            word-wrap: break-word;
        }
        .message-field .field-value {
            white-space: pre-wrap;
            min-height: 100px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
        }
        .timestamp {
            color: #868e96;
            font-size: 11px;
        }
        .pigeon-icon {
            font-size: 20px;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><span class="pigeon-icon">🕊️</span>Gołąb - New Message</h1>
            <div class="subtitle">A new message has been delivered by your carrier pigeon</div>
        </div>
        
        <div class="field">
            <span class="field-label">From Email</span>
            <div class="field-value">${data.email}</div>
        </div>
        
        <div class="field">
            <span class="field-label">Subject</span>
            <div class="field-value">${data.subject}</div>
        </div>
        
        <div class="field message-field">
            <span class="field-label">Message</span>
            <div class="field-value">${data.message}</div>
        </div>
        
        <div class="field" style="background-color: #fff3cd; border-left-color: #ffc107; margin-bottom: 20px;">
            <span class="field-label" style="color: #856404;">📍 Source Information</span>
            <div class="field-value" style="background-color: transparent; padding: 0; border: none;">
                <div><strong style="color: #856404;">Domain:</strong> <span style="color: #6c757d;">${data.domain}</span></div>
            </div>
        </div>
        
        <div class="footer">
            <div class="timestamp">Received: ${data.timestamp}</div>
            <div style="margin-top: 10px;">
                <strong>Gołąb Contact Form API</strong><br>
                Your reliable carrier pigeon for contact forms on static websites
            </div>
        </div>
    </div>
</body>
</html>`.trim();

  const text = `Gołąb - New Contact Message
🕊️ A new message has been delivered by your carrier pigeon

From Email: ${data.email}
Subject: ${data.subject}

Message:
${data.message}

Source Information:
Domain: ${data.domain}

Received: ${data.timestamp}

---
Gołąb Contact Form API
Your reliable carrier pigeon for contact forms on static websites`.trim();

  return { html, text };
};

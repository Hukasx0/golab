/**
 * Auto-reply email template for Gołąb contact form
 * This template is sent to users who submit the contact form as a thank you message
 * 
 * Uses TypeScript template literals for type safety
 */

import type { AutoReplyTemplateData } from '../src/types';

/**
 * Generates HTML and text auto-reply email content
 * @param data - Template data with type safety
 * @returns Object containing HTML and text versions of the auto-reply email
 */
export const generateAutoReplyTemplate = (data: AutoReplyTemplateData): { html: string; text: string } => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank you for your message</title>
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
        .content {
            margin-bottom: 25px;
        }
        .content p {
            margin-bottom: 15px;
            color: #495057;
        }
        .highlight-box {
            background-color: #e8f4fd;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .highlight-box .label {
            font-weight: 600;
            color: #0056b3;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
            display: block;
        }
        .highlight-box .value {
            color: #495057;
            word-wrap: break-word;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
        }
        .pigeon-icon {
            font-size: 20px;
            margin-right: 8px;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 15px;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="success-icon">✅</span>
            <h1><span class="pigeon-icon">🕊️</span>Message Received!</h1>
            <div class="subtitle">Thank you for reaching out</div>
        </div>
        
        <div class="content">
            <p>Hello,</p>
            
            <p>Thank you for your message! We have successfully received your inquiry and wanted to confirm that it has been delivered.</p>
            
            <div class="highlight-box">
                <span class="label">📧 Your Message Details</span>
                <div class="value">
                    <strong>From:</strong> ${data.senderEmail}<br>
                    <strong>Subject:</strong> ${data.originalSubject}
                </div>
            </div>
            
            <p>We appreciate you taking the time to contact us. The message owner will review your inquiry and get back to you as soon as possible.</p>
            
            <p>If your message is urgent or if you don't hear back within a reasonable timeframe, please feel free to send a follow-up message.</p>
            
            <p>Thank you for your patience!</p>
        </div>
        
        <div class="footer">
            <div>
                <strong>Gołąb Contact Form API</strong><br>
                Your reliable carrier pigeon for contact forms on static websites
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #868e96;">
                This is an automated response. Please do not reply to this email.
            </div>
        </div>
    </div>
</body>
</html>`.trim();

  const text = `Thank you for your message!

We have successfully received your inquiry and wanted to confirm that it has been delivered.

Your Message Details:
From: ${data.senderEmail}
Subject: ${data.originalSubject}

We appreciate you taking the time to contact us. The message owner will review your inquiry and get back to you as soon as possible.

If your message is urgent or if you don't hear back within a reasonable timeframe, please feel free to send a follow-up message.

Thank you for your patience!

---
Gołąb Contact Form API
Your reliable carrier pigeon for contact forms on static websites

This is an automated response. Please do not reply to this email.`.trim();

  return { html, text };
};

<div align="center">
    
# 🕊️ Gołąb - Secure Contact Form API
    
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Bundle Size](https://img.shields.io/badge/Bundle%20Size-<3MB-green)](https://developers.cloudflare.com/workers/platform/limits/)
[![Security](https://img.shields.io/badge/Security-WAF%20Ready-red)](https://www.cloudflare.com/waf/)

**A reliable, secure, and fast contact form API service built for static websites**

*"Gołąb" ("Gołąb pocztowy" to be more precise) (Polish for carrier pigeon)*

*delivers your contact form messages straight to your inbox quickly and securely*

[🚀 Quick Start](#-quick-start) • [🔒 Security](#-security-architecture) • [📖 API Docs](#-api-documentation) • [🛡️ Deployment](#%EF%B8%8F-secure-deployment)

</div>

---

## ✨ Key Features

- **🚀 Lightning Fast** - Built with Hono on Cloudflare's global edge network
- **🔒 Secure** - API key, content filtering, rate limiting and optional WAF
- **📧 Reliable Delivery** - Powered by Resend API, optional auto-reply support
- **⚡ Optimized Bundle** - <1MB bundle size compliant with Cloudflare Workers limits
- **🌍 Global Edge** - Runs on Cloudflare's worldwide network for minimal latency
- **🔑 Flexible Auth** - Optional API key authentication
- **⏱️ Smart Rate Limiting** - Upstash Redis-powered rate limiting with flexible configuration
- **📱 CORS Ready** - Works seamlessly with any frontend framework

## 🏗️ Architecture Overview

```mermaid
graph TB
    A[User Browser on your static website] --> B[Gołąb API Worker]
    B --> C[API Key Validation]
    B --> D[Input Validation]
    B --> E[Content Filtering]
    B --> F[Rate Limiting Check]
    F --> G[Email Service]
    G --> H[Rate Limiting Increment]
    G --> I[Your Inbox]
    
    F --> J[(Upstash Redis)]
    H --> J
    
    style A fill:#e1f5fe
    style B fill:#e8f5e8
    style F fill:#fff3e0
    style G fill:#f3e5f5
    style H fill:#fff3e0
    style I fill:#e0f2f1
    style J fill:#ffebee
```

## 🔒 Security Architecture

A **multi-layered security approach** that the creator strongly recommends:

### Recommended Security Stack

```mermaid
graph LR
    A[Frontend] --> B[Gateway + CAPTCHA]
    B --> C[Cloudflare WAF]
    C --> D[Gołąb API]
    D --> E[Email Service]
    
    B1[CAPTCHA Verification] --> B
    B2[Custom Filters] --> B
    B3[Rate Limiting] --> B
    
    C1[Bot Protection] --> C
    C2[Geographic Filtering] --> C
    C3[Content Rules] --> C
    
    D1[API Key Auth] --> D
    D2[Input Validation] --> D
    D3[Banned Words] --> D
    D4[Email Filtering] --> D
    D5[Rate Limiting] --> D
    
    style B fill:#fff3e0
    style C fill:#ffebee
    style D fill:#e8f5e8
```

### 🛡️ Gateway Layer (Highly Recommended)

The creator recommends implementing a **gateway layer** between your static website and the Gołąb API:

- **Hidden API Key**: Gateway stores the secure API key, never exposed to frontend
- **CAPTCHA Integration**: Verify human users before API calls
- **Additional Filtering**: Custom business logic and validation
- **Rate Limiting**: Extra protection from spam
- **Honeypot** - Additional form fields on the frontend, which when sent to the gateway are not passed to Gołąb api (bot protection)

## 🚀 Quick Start

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Resend account](https://resend.com) for email delivery
- [Bun](https://bun.sh) or Node.js for development

### 1. Clone and Install

```bash
git clone https://github.com/Hukasx0/golab
cd golab
bun install  # or npm install
```

### 2. Environment Configuration

All environment variables are managed through Cloudflare Workers secrets for security:

```bash
# Required: Email configuration
wrangler secret put TARGET_EMAIL
# Enter: your-email@example.com

wrangler secret put FROM_EMAIL  
# Enter: "Your Name <noreply@yourdomain.com>"

wrangler secret put RESEND_API_KEY
# Enter: re_xxxxxxxxxx (from https://resend.com)

# Recommended: API key for security
wrangler secret put API_KEY
# Enter: $(openssl rand -base64 32)

# Optional: Rate limiting with Upstash Redis
wrangler secret put UPSTASH_REDIS_REST_URL
# Enter: https://your-redis-instance.upstash.io

wrangler secret put UPSTASH_REDIS_REST_TOKEN
# Enter: your-redis-token
```

You can also use wrangler after `bun install` like this `bun run wrangler <arguments>` (If you are in the project folder of course)

### 3. Configure Rate Limiting (Optional)

Edit [`wrangler.toml`](wrangler.toml) to enable rate limiting:

```toml
[vars]
# Enable rate limiting (requires Upstash Redis configuration)
RATE_LIMITING = "true"

# Optional: Customize rate limiting settings
RATE_LIMIT_GLOBAL_LIMIT = "10"      # 10 emails per hour globally
RATE_LIMIT_EMAIL_LIMIT = "1"        # 1 email per hour per email address
RATE_LIMIT_IP_ENABLED = "false"     # Disable per-IP limiting (recommended for proxied setups)
```

### 4. Configure CORS

Edit [`wrangler.toml`](wrangler.toml):

```toml
[vars]
# Production: Specify exact domains
ALLOWED_ORIGINS = "https://yourdomain.com,https://www.yourdomain.com"

# Development: Allow all origins
# ALLOWED_ORIGINS = "*"
```

### 5. Deploy to Cloudflare Workers

```bash
# Deploy to production
bun run deploy

# Deploy to development environment
bun run deploy:dev
```

### 6. Configure WAF Protection (Optional, but Recommended)

In your Cloudflare dashboard (**Security** → **WAF** → **Custom Rules**):

```javascript
// Essential: Rate limiting
(http.request.uri.path eq "/api/contact" and http.request.method eq "POST")
// Action: Block after 5 requests per minute per IP

// Recommended: Bot protection  
(http.request.uri.path eq "/api/contact" and cf.bot_management.score lt 30)
// Action: Block
```

## 📖 API Documentation

### Endpoint

```
POST /api/contact
```

### Request Format

```json
{
  "email": "user@example.com",
  "subject": "Contact Form Submission", 
  "message": "Your message here (minimum 10 characters)"
}
```

### Headers (X-API-Key only when API key is enabled)

```
Content-Type: application/json
X-API-Key: your-secure-api-key-here
```

### Response Format

**Success (200)**:
```json
{
  "success": true,
  "message": "Your message has been sent successfully!",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

**Error (400/401/500)**:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ],
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

**Rate Limited (429)**:
```json
{
  "error": "Rate limit exceeded",
  "details": [
    {
      "field": "rate_limit",
      "message": "Rate limit exceeded for global"
    }
  ],
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Validation Rules

| Field | Requirements |
|-------|-------------|
| `email` | Valid email format, max 320 characters (RFC 5321 standard) |
| `subject` | Required, max 200 characters (configurable via `SUBJECT_MAX_LENGTH`) |
| `message` | Required, default 10-5000 characters (configurable via `MESSAGE_MIN_LENGTH` and `MESSAGE_MAX_LENGTH`) |

## 🔧 Environment Variables

Complete reference for all configuration options:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `TARGET_EMAIL` | Where contact messages are sent | ✅ | `yourmail@yourdomain.com` |
| `FROM_EMAIL` | Sender address (must match verified domain) | ✅ | `"Contact Form <noreply@yourdomain.com>"` |
| `RESEND_API_KEY` | Resend service API key | ✅ | `re_xxxxxxxxxx` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | ❌ | `https://yourdomain.com,https://www.yourdomain.com` |
| `API_KEY` | Secure API key for authentication | ❌ | `$(openssl rand -base64 32)` |
| `ENABLE_AUTO_REPLY` | Send thank you emails to senders | ❌ | `true` |
| `AUTO_REPLY_FROM_EMAIL` | From address for auto-reply emails (defaults to FROM_EMAIL) | ❌ | `"Auto Reply <autoreply@yourdomain.com>"` |
| `BANNED_WORDS` | Content filter (semicolon-separated) | ❌ | `spam;casino;lottery` |
| `EMAIL_DOMAIN_WHITELIST` | Allowed email domains only | ❌ | `yourdomain.com;trusted.org` |
| `EMAIL_DOMAIN_BLACKLIST` | Blocked email domains | ❌ | `spam.com;malicious.net` |
| `EMAIL_ADDRESS_BLACKLIST` | Blocked specific email addresses | ❌ | `spammer@example.com;bad@domain.com` |
| `SUBJECT_MAX_LENGTH` | Optional override for subject max length (>=1). Default: 200 | ❌ | `150` |
| `MESSAGE_MIN_LENGTH` | Optional override for message min length (>=1). Default: 10 | ❌ | `5` |
| `MESSAGE_MAX_LENGTH` | Optional override for message max length (>=1). Default: 5000 | ❌ | `2000` |
| `RATE_LIMITING` | Enable rate limiting. Default: false | ❌ | `true` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (required when rate limiting enabled) | ❌ | `https://your-redis.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token (required when rate limiting enabled) | ❌ | `your-redis-token` |
| `RATE_LIMIT_GLOBAL_ENABLED` | Enable global rate limiting. Default: true | ❌ | `true` |
| `RATE_LIMIT_GLOBAL_LIMIT` | Global emails per window. Default: 10 | ❌ | `20` |
| `RATE_LIMIT_GLOBAL_WINDOW` | Global time window in seconds. Default: 3600 | ❌ | `7200` |
| `RATE_LIMIT_IP_ENABLED` | Enable per-IP rate limiting. Default: false | ❌ | `true` |
| `RATE_LIMIT_IP_LIMIT` | Emails per IP per window. Default: 5 | ❌ | `3` |
| `RATE_LIMIT_IP_WINDOW` | IP time window in seconds. Default: 3600 | ❌ | `1800` |
| `RATE_LIMIT_EMAIL_ENABLED` | Enable per-email rate limiting. Default: true | ❌ | `true` |
| `RATE_LIMIT_EMAIL_LIMIT` | Emails per email address per window. Default: 1 | ❌ | `2` |
| `RATE_LIMIT_EMAIL_WINDOW` | Email time window in seconds. Default: 3600 | ❌ | `900` |
| `RATE_LIMIT_REDIS_FAILURE_MODE` | Redis failure behavior: "open" (allow) or "closed" (block). Default: "open" | ❌ | `closed` |

### Setting Environment Variables

```bash
# Secure method (recommended for production)
wrangler secret put VARIABLE_NAME

# Development method (wrangler.toml)
[vars]
VARIABLE_NAME = "value"
```

## 🛠️ Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `bun run dev` | Start development server | Local testing at http://localhost:3000 |
| `bun run build` | Build for local testing | Creates optimized bundle |
| `bun run build:worker` | Build for Cloudflare Workers | **<1MB bundle** for deployment |
| `bun run test` | Run test suite | Validates functionality |
| `bun run test:watch` | Run tests in watch mode | Development testing |
| `bun run test:coverage` | Run tests with coverage | Quality assurance |
| `bun run deploy` | Deploy to production | Live deployment |
| `bun run deploy:dev` | Deploy to development | Testing environment |

### Bundle Size Optimization

The project maintains a **<1MB bundle size** to comply with [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/):

(I think they recently increased it to 3mb, but I wrote it when it was 1mb, the API is not heavy either, so I stick to the max 1mb optimized bundle size rule)

- **Optimized build process** using `bun build` with browser target
- **Tree-shaking** removes unused code automatically  
- **Minification** reduces bundle size in production
- **Type-safe templates** with optimized template literals
- **Efficient dependencies** - only essential packages included

## 🌐 Frontend Integration

### Basic HTML Example

```html
<form id="contactForm">
    <input type="email" name="email" required>
    <input type="text" name="subject" required>
        <textarea name="message" required minlength="10"></textarea>
    <button type="submit">Send Message</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
    };

    try {
            const response = await fetch('https://your-api.workers.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': 'your-api-key-here' // If API key is enabled
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (result.success) {
            alert('Message sent successfully! 🕊️');
            e.target.reset();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
});
</script>
```

### React Example

```tsx
import React, { useState } from 'react';

const ContactForm = () => {
    const [formData, setFormData] = useState({
        email: '', subject: '', message: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('https://your-api.workers.dev/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.REACT_APP_GOLAB_API_KEY // If enabled
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Message sent successfully! 🕊️');
                setFormData({ email: '', subject: '', message: '' });
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            alert('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
            />
            <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                required
            />
            <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                required
                minLength={10} // frontend hint; backend enforces defaults or ENV overrides
            />
            <button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Message 🕊️'}
            </button>
        </form>
    );
};

export default ContactForm;
```

## 🛡️ Secure Deployment

### Quick Security Checklist

- [ ] **WAF Rules Configured** (rate limiting, bot protection)
- [ ] **API Key Generated** (`openssl rand -base64 32`)
- [ ] **CORS Configured** (specific domains, no wildcards in production)
- [ ] **Gateway Implemented** (CAPTCHA + hidden API key + optional honeypot)
- [ ] **Content Filtering** (banned words, email filtering)
- [ ] **Rate Limiting Configured** (Upstash Redis + appropriate limits)
- [ ] **Monitoring Setup** (Cloudflare analytics, alerts)

## 🧪 Development & Testing

### Local Development

```bash
# Start development server
bun run dev

# Test the API locally
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "email": "test@example.com",
    "subject": "Test Subject", 
    "message": "This is a test message with enough characters."
  }'
```

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode for development
bun test --watch
```

## 📁 Project Structure

```
golab/
├── src/
│   ├── index.ts              # Main Hono application
│   ├── handlers/
│   │   └── contact.ts        # Contact form handler
│   ├── services/
│   │   ├── email.ts          # Email service (Resend)
│   │   └── rate-limit.ts     # Rate limiting service (Upstash Redis)
│   ├── utils/
│   │   ├── validation.ts     # Input validation & security
│   │   ├── cors.ts           # CORS utilities
│   │   └── env-config.ts     # Build-time environment configuration
│   └── types/
│       └── index.ts          # TypeScript definitions
├── templates/
│   ├── email-template.ts     # Type-safe email templates
│   └── auto-reply-template.ts # Auto-reply templates
├── tests/                    # Comprehensive test suite
├── examples/                 # Frontend integration examples
├── package.json              # Dependencies & scripts
├── wrangler.toml            # Cloudflare Workers config
└── tsconfig.json            # TypeScript configuration
```

## 🔒 Security Features (with recommendations)

- **🛡️ Multi-layer Protection**: WAF + API + Content filtering + Rate limiting
- **🔑 API Key Authentication**: Optional secure access control
- **🚫 Content Filtering**: Banned words and email domain filtering
- **🤖 Bot Protection**: Cloudflare's advanced bot management
- **🌍 Geographic Filtering**: Optional country-based restrictions
- **⚡ Smart Rate Limiting**: Redis-powered limits (global, per-IP, per-email)
- **🔒 Input Validation**: Zod schema validation with sanitization
- **📧 Email Security**: Reply-to headers for safe communication

## 📧 Email Features

- **📬 Reliable Delivery**: Powered by Resend API (Your emails are not going to end up in spam)
- **🔄 Auto-Reply**: Optional thank you emails to senders
- **🎨 Beautiful Templates**: Type-safe HTML and text templates
- **📍 Source Tracking**: Automatic domain and timestamp logging
- **🛡️ XSS Protection**: Content sanitization for email safety

## ⚡ Rate Limiting

Gołąb includes advanced rate limiting powered by Upstash Redis to protect against spam and abuse.

### 🎯 Rate Limiting Types

#### 1. **Global Rate Limiting** (Default: 10 emails/hour)
- Limits total successful emails across all users
- Protects against coordinated attacks
- Default: **Enabled** with 10 emails per hour

#### 2. **Per-Email Rate Limiting** (Default: 1 email/hour)
- Limits successful emails per sender email address
- Prevents individual email abuse
- Default: **Enabled** with 1 email per hour

#### 3. **Per-IP Rate Limiting** (Default: Disabled)
- Limits successful emails per IP address
- Uses real IP detection (`CF-Connecting-IP` header)
- Default: **Disabled** (recommended for proxy/backend setups)

### 🔧 Configuration

Rate limiting is configured through environment variables:

```bash
# Runtime: Enable rate limiting
RATE_LIMITING=true

# Runtime: Redis connection (required)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Global rate limiting (default: enabled, 10/hour)
RATE_LIMIT_GLOBAL_ENABLED=true
RATE_LIMIT_GLOBAL_LIMIT=10
RATE_LIMIT_GLOBAL_WINDOW=3600

# Per-email rate limiting (default: enabled, 1/hour)
RATE_LIMIT_EMAIL_ENABLED=true
RATE_LIMIT_EMAIL_LIMIT=1
RATE_LIMIT_EMAIL_WINDOW=3600

# Per-IP rate limiting (default: disabled)
RATE_LIMIT_IP_ENABLED=false
RATE_LIMIT_IP_LIMIT=5
RATE_LIMIT_IP_WINDOW=3600

# Redis failure handling (default: "open")
RATE_LIMIT_REDIS_FAILURE_MODE=closed
```

### 🏗️ Rate Limiting Flow

```mermaid
graph TB
    A[Contact Form Request] --> B{Rate Limiting Enabled?}
    B -->|No| H[Process Normally]
    B -->|Yes| C[Extract Identifiers]
    
    C --> D[Get Real IP Address]
    C --> E[Get Email Address]
    
    D --> F1{IP Limiting Enabled?}
    E --> F2{Email Limiting Enabled?}
    
    F1 -->|Yes| G1[Check IP Limit in Redis]
    F1 -->|No| I[Continue to Email Check]
    F2 -->|Yes| G2[Check Email Limit in Redis]
    F2 -->|No| I
    
    G1 --> H1{IP Limit Exceeded?}
    G2 --> H2{Email Limit Exceeded?}
    
    H1 -->|Yes| J[Return 429 Rate Limited]
    H2 -->|Yes| J
    
    H1 -->|No| K[Check Global Limit]
    H2 -->|No| K
    I --> K
    
    K --> L{Global Limit Exceeded?}
    L -->|Yes| J
    L -->|No| M[Send Email]
    
    M --> N{Email Sent Successfully?}
    N -->|Yes| O[Increment All Counters]
    N -->|No| P[Return Error - No Increment]
    
    O --> Q[Return Success]
    H --> Q
    
    style B fill:#e1f5fe
    style J fill:#ffebee
    style M fill:#e8f5e8
    style O fill:#fff3e0
    style Q fill:#e0f2f1
```

### 🛡️ Security Features

- **Configurable Failure Mode**: Choose between fail-open (allow) or fail-closed (block) when Redis is unavailable
- **Real IP Detection**: Uses `CF-Connecting-IP` for accurate IP identification
- **Successful Email Counting**: Only counts emails that were actually sent
- **Auto-reply Exclusion**: Auto-reply emails don't count toward limits
- **Sliding Windows**: Time-based windows for accurate rate limiting
- **Atomic Operations**: Redis pipelines ensure data consistency

### 📊 Monitoring

Rate limiting events are logged for monitoring:

```json
{
  "message": "Contact form blocked due to rate limiting",
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "reason": "Rate limit exceeded for global",
  "resetTime": 1640995200000,
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### 🚀 Getting Started with Rate Limiting

1. **Get Upstash Redis**: Sign up at [console.upstash.com](https://console.upstash.com/)
2. **Configure Environment**: Set `RATE_LIMITING=true` via Cloudflare Dashboard or wrangler.toml
3. **Add Redis Credentials**: Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. **Configure Failure Mode**: Set `RATE_LIMIT_REDIS_FAILURE_MODE` to `"closed"` for maximum security
5. **Customize Limits**: Adjust rate limiting settings as needed
6. **Deploy**

### 🔧 Redis Failure Modes

**Fail Open (Default - `"open"`)**:
- ✅ High availability - requests continue when Redis fails
- ⚠️ Temporary loss of rate limiting protection

**Fail Closed (`"closed"`)**:
- 🛡️ Maximum security - no requests bypass rate limiting
- ⚠️ Service unavailable when Redis fails
- 📝 Recommended for high-security environments with Redis redundancy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **AGPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**🕊️ Gołąb - Your reliable carrier pigeon for contact forms**

*Made for developers who need secure, fast, and reliable contact form APIs for their static websites*

</div>

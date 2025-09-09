/**
 * Attachments utilities for Gołąb contact form API
 * - Single optional attachment, disabled by default
 * - MIME-based whitelist/blacklist
 * - Per-file size limit (default 10MB)
 * - Blocks Resend unsupported file extensions regardless of MIME
 */

import type { Environment, ValidationError, AttachmentPayload } from '@/types';

/**
 * Resend unsupported file extensions (case-insensitive)
 * Source: https://resend.com/docs/knowledge-base/what-attachment-types-are-not-supported
 */
const RESEND_UNSUPPORTED_EXTENSIONS = new Set(
  [
    '.adp','.app','.asp','.bas','.bat',
    '.cer','.chm','.cmd','.com','.cpl',
    '.crt','.csh','.der','.exe','.fxp',
    '.gadget','.hlp','.hta','.inf','.ins',
    '.isp','.its','.js','.jse','.ksh',
    '.lib','.lnk','.mad','.maf','.mag',
    '.mam','.maq','.mar','.mas','.mat',
    '.mau','.mav','.maw','.mda','.mdb',
    '.mde','.mdt','.mdw','.mdz','.msc',
    '.msh','.msh1','.msh2','.mshxml','.msh1xml',
    '.msh2xml','.msi','.msp','.mst','.ops',
    '.pcd','.pif','.plg','.prf','.prg',
    '.reg','.scf','.scr','.sct','.shb',
    '.shs','.sys','.ps1','.ps1xml','.ps2',
    '.ps2xml','.psc1','.psc2','.tmp','.url',
    '.vb','.vbe','.vbs','.vps','.vsmacros',
    '.vss','.vst','.vsw','.vxd','.ws',
    '.wsc','.wsf','.wsh','.xnk'
  ].map(e => e.toLowerCase())
);

function parseList(envValue?: string): string[] {
  if (!envValue) return [];
  return envValue
    .split(';')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAttachmentsEnabled(env: Environment): boolean {
  return (env.ATTACHMENTS_ENABLED || '').toLowerCase() === 'true';
}

export interface AttachmentsConfig {
  enabled: boolean;
  maxSizeBytes: number; // default 10MB
  whitelist: string[];  // MIME types (lowercase)
  blacklist: string[];  // MIME types (lowercase)
}

export function getAttachmentsConfig(env: Environment): AttachmentsConfig {
  const DEFAULT_MAX = 10 * 1024 * 1024; // 10MB
  let max = DEFAULT_MAX;

  if (env.ATTACHMENTS_MAX_FILE_SIZE_BYTES) {
    const parsed = parseInt(env.ATTACHMENTS_MAX_FILE_SIZE_BYTES.trim(), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      max = parsed;
    } else {
      (globalThis as any).console?.warn(`⚠️  [Gołąb] Invalid ATTACHMENTS_MAX_FILE_SIZE_BYTES="${env.ATTACHMENTS_MAX_FILE_SIZE_BYTES}", using default ${DEFAULT_MAX}`);
    }
  }

  const whitelist = parseList(env.ATTACHMENTS_MIME_WHITELIST);
  const blacklist = parseList(env.ATTACHMENTS_MIME_BLACKLIST);

  return {
    enabled: isAttachmentsEnabled(env),
    maxSizeBytes: max,
    whitelist,
    blacklist
  };
}

/**
 * Compute decoded bytes length for base64 string without allocating buffers.
 * Assumes input contains only base64 characters optionally padded with '='.
 */
export function base64ByteLength(b64: string): number {
  // Remove whitespace
  const str = b64.replace(/\s+/g, '');
  // Basic base64 validity check (not exhaustive)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
    return -1;
  }
  if (str.length % 4 !== 0) {
    return -1;
  }
  const padding = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
  return (str.length * 3) / 4 - padding;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx).toLowerCase(); // includes dot, e.g. ".pdf"
}

export function isUnsupportedExtension(filename: string): boolean {
  const ext = getExtension(filename);
  if (!ext) return false;
  return RESEND_UNSUPPORTED_EXTENSIONS.has(ext);
}

export function isMimeAllowed(mime: string, whitelist: string[], blacklist: string[]): boolean {
  const m = mime.trim().toLowerCase();
  if (!m) return false;
  if (blacklist.includes(m)) return false;
  if (whitelist.length > 0 && !whitelist.includes(m)) return false;
  return true;
}

export type AttachmentValidationResult =
  | { ok: true; value: AttachmentPayload }
  | { ok: false; errors: ValidationError[] };

/**
 * Validates and normalizes an attachment candidate into AttachmentPayload
 * - Requires fields: filename, contentType (MIME), content (base64)
 * - Validates base64 shape and decoded size against config
 * - Validates MIME via whitelist/blacklist with blacklist priority
 * - Blocks known unsupported extensions by Resend
 */
export function validateAndNormalizeAttachment(candidate: unknown, config: AttachmentsConfig): AttachmentValidationResult {
  const errors: ValidationError[] = [];

  if (candidate === null || typeof candidate !== 'object') {
    return { ok: false, errors: [{ field: 'attachment', message: 'Invalid attachment object' }] };
  }

  const obj = candidate as Record<string, unknown>;
  const filename = typeof obj['filename'] === 'string' ? (obj['filename'] as string).trim() : '';
  const contentType = typeof obj['contentType'] === 'string' ? (obj['contentType'] as string).trim().toLowerCase() : '';
  const content = typeof obj['content'] === 'string' ? (obj['content'] as string).trim() : '';

  if (!filename) {
    errors.push({ field: 'attachment.filename', message: 'Filename is required' });
  }
  if (!contentType) {
    errors.push({ field: 'attachment.contentType', message: 'Content type (MIME) is required' });
  }
  if (!content) {
    errors.push({ field: 'attachment.content', message: 'Base64 content is required' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Validate extension blacklist from Resend
  if (isUnsupportedExtension(filename)) {
    errors.push({ field: 'attachment.filename', message: 'File extension is not supported by the email provider' });
  }

  // Validate MIME whitelist/blacklist
  if (!isMimeAllowed(contentType, config.whitelist, config.blacklist)) {
    // Disambiguate reason
    if (config.blacklist.includes(contentType)) {
      errors.push({ field: 'attachment.contentType', message: 'MIME type is blacklisted' });
    } else if (config.whitelist.length > 0 && !config.whitelist.includes(contentType)) {
      errors.push({ field: 'attachment.contentType', message: 'MIME type is not in whitelist' });
    } else {
      errors.push({ field: 'attachment.contentType', message: 'Invalid MIME type' });
    }
  }

  // Validate base64 and size
  const size = base64ByteLength(content);
  if (size < 0) {
    errors.push({ field: 'attachment.content', message: 'Invalid Base64 content' });
  } else if (size > config.maxSizeBytes) {
    errors.push({ field: 'attachment.content', message: `Attachment exceeds maximum size of ${config.maxSizeBytes} bytes` });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Normalized payload for Resend
  const value: AttachmentPayload = {
    filename,
    contentType,
    content
  };

  return { ok: true, value };
}

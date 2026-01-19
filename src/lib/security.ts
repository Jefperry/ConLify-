/**
 * Security Utilities for ConLify
 * 
 * This module provides:
 * - Input validation and sanitization (OWASP compliant)
 * - Rate limiting (IP + user-based)
 * - XSS protection
 * - Schema-based validation
 * 
 * @see https://owasp.org/www-project-web-security-testing-guide/
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;      // Maximum requests allowed in the window
  windowMs: number;         // Time window in milliseconds
  keyPrefix?: string;       // Prefix for the rate limit key
}

// In-memory rate limit storage (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limit configurations for different actions
export const RATE_LIMITS = {
  // Auth endpoints - strict limits to prevent brute force
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000, keyPrefix: 'login' },          // 5 per 15 min
  signup: { maxRequests: 3, windowMs: 60 * 60 * 1000, keyPrefix: 'signup' },        // 3 per hour
  passwordReset: { maxRequests: 3, windowMs: 60 * 60 * 1000, keyPrefix: 'reset' },  // 3 per hour
  
  // General API actions - moderate limits
  createGroup: { maxRequests: 10, windowMs: 60 * 60 * 1000, keyPrefix: 'create' },  // 10 per hour
  joinGroup: { maxRequests: 20, windowMs: 60 * 60 * 1000, keyPrefix: 'join' },      // 20 per hour
  
  // Payment actions - sensible limits
  markPayment: { maxRequests: 30, windowMs: 60 * 60 * 1000, keyPrefix: 'payment' }, // 30 per hour
  verifyPayment: { maxRequests: 50, windowMs: 60 * 60 * 1000, keyPrefix: 'verify' }, // 50 per hour
  
  // General actions
  default: { maxRequests: 100, windowMs: 60 * 1000, keyPrefix: 'general' },         // 100 per minute
} as const;

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP, user ID, or combination)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and retry information
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean; retryAfterMs?: number; remaining: number } {
  const key = `${config.keyPrefix || 'rl'}:${identifier}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  // No existing entry or window has expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfterMs = entry.resetTime - now;
    return { 
      allowed: false, 
      retryAfterMs, 
      remaining: 0 
    };
  }
  
  // Increment counter
  entry.count += 1;
  rateLimitStore.set(key, entry);
  
  return { allowed: true, remaining: config.maxRequests - entry.count };
}

/**
 * Create a rate limit identifier combining IP and user ID
 * @param userId - Optional user ID (for authenticated requests)
 * @returns Rate limit identifier
 */
export function getRateLimitIdentifier(userId?: string): string {
  // In a real app, you'd get the IP from the request
  // For client-side, we use a fingerprint + user ID
  const fingerprint = getClientFingerprint();
  return userId ? `${fingerprint}:${userId}` : fingerprint;
}

/**
 * Generate a simple client fingerprint for rate limiting
 * Note: This is not foolproof but adds a layer of protection
 */
function getClientFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
  ];
  
  // Simple hash function
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: unknown;
}

export interface FieldSchema {
  type: 'string' | 'number' | 'email' | 'boolean';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  customValidator?: (value: unknown) => string | null;
}

export interface ObjectSchema {
  [key: string]: FieldSchema;
}

// Pre-defined validation schemas for common forms
export const SCHEMAS = {
  login: {
    email: { 
      type: 'email' as const, 
      required: true, 
      maxLength: 254,  // RFC 5321
      sanitize: true 
    },
    password: { 
      type: 'string' as const, 
      required: true, 
      minLength: 1, 
      maxLength: 128 
    },
  },
  
  signup: {
    name: { 
      type: 'string' as const, 
      required: true, 
      minLength: 2, 
      maxLength: 100, 
      pattern: /^[a-zA-Z\s\-']+$/,
      sanitize: true 
    },
    email: { 
      type: 'email' as const, 
      required: true, 
      maxLength: 254, 
      sanitize: true 
    },
    password: { 
      type: 'string' as const, 
      required: true, 
      minLength: 8, 
      maxLength: 128,
      customValidator: (value: unknown) => {
        const pwd = value as string;
        if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter';
        if (!/\d/.test(pwd)) return 'Password must contain a number';
        return null;
      }
    },
  },
  
  createGroup: {
    name: { 
      type: 'string' as const, 
      required: true, 
      minLength: 3, 
      maxLength: 100, 
      sanitize: true 
    },
    contributionAmount: { 
      type: 'number' as const, 
      required: true, 
      min: 1, 
      max: 1000000  // Reasonable upper limit
    },
    frequency: { 
      type: 'string' as const, 
      required: true,
      pattern: /^(weekly|bi-weekly|monthly)$/
    },
  },
  
  joinGroup: {
    inviteCode: { 
      type: 'string' as const, 
      required: true, 
      minLength: 6, 
      maxLength: 20,
      pattern: /^[A-Z0-9]+$/,
      sanitize: true 
    },
  },
  
  profile: {
    name: { 
      type: 'string' as const, 
      required: false, 
      minLength: 2, 
      maxLength: 100,
      pattern: /^[a-zA-Z\s\-']*$/,
      sanitize: true 
    },
    phone: { 
      type: 'string' as const, 
      required: false, 
      maxLength: 20,
      pattern: /^[\d\s\-+()]*$/,
      sanitize: true 
    },
  },
} as const;

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize a string to prevent XSS attacks
 * Removes or escapes potentially dangerous characters
 * @param input - Raw input string
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim whitespace
    .trim()
    // Escape HTML entities to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove potential script injection patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

/**
 * Decode HTML entities (for display purposes)
 * @param input - Encoded string
 * @returns Decoded string
 */
export function decodeHtmlEntities(input: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = input;
  return textarea.value;
}

/**
 * Sanitize email address
 * @param email - Raw email input
 * @returns Sanitized email or empty string if invalid format
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  // Basic sanitization
  const sanitized = email
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
  
  // Validate email format (RFC 5322 simplified)
  const emailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Sanitize a number value
 * @param value - Raw number input
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Sanitized number or NaN if invalid
 */
export function sanitizeNumber(value: unknown, min?: number, max?: number): number {
  let num: number;
  
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    num = parseFloat(value);
  } else {
    return NaN;
  }
  
  if (isNaN(num) || !isFinite(num)) return NaN;
  
  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;
  
  return num;
}

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

/**
 * Validate an object against a schema
 * @param data - Data object to validate
 * @param schema - Validation schema
 * @param strictMode - If true, reject fields not in schema
 * @returns Validation result with sanitized data
 */
export function validateSchema(
  data: Record<string, unknown>,
  schema: ObjectSchema,
  strictMode: boolean = true
): ValidationResult {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};
  
  // Check for unexpected fields in strict mode
  if (strictMode) {
    const allowedFields = new Set(Object.keys(schema));
    for (const key of Object.keys(data)) {
      if (!allowedFields.has(key)) {
        errors.push(`Unexpected field: ${key}`);
      }
    }
  }
  
  // Validate each field in the schema
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // Skip validation for empty optional fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Type validation
    switch (rules.type) {
      case 'string': {
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
          continue;
        }
        
        let str = value;
        
        // Sanitize if enabled
        if (rules.sanitize) {
          str = sanitizeString(str);
        }
        
        // Length checks
        if (rules.minLength && str.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && str.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }
        
        // Pattern check
        if (rules.pattern && !rules.pattern.test(str)) {
          errors.push(`${field} contains invalid characters`);
        }
        
        // Custom validator
        if (rules.customValidator) {
          const customError = rules.customValidator(str);
          if (customError) errors.push(customError);
        }
        
        sanitized[field] = str;
        break;
      }
      
      case 'email': {
        const email = sanitizeEmail(String(value));
        if (!email) {
          errors.push(`${field} must be a valid email address`);
          continue;
        }
        
        if (rules.maxLength && email.length > rules.maxLength) {
          errors.push(`${field} is too long`);
        }
        
        sanitized[field] = email;
        break;
      }
      
      case 'number': {
        const num = sanitizeNumber(value, rules.min, rules.max);
        if (isNaN(num)) {
          errors.push(`${field} must be a valid number`);
          continue;
        }
        
        if (rules.min !== undefined && num < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }
        
        sanitized[field] = num;
        break;
      }
      
      case 'boolean': {
        if (typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
          continue;
        }
        sanitized[field] = value;
        break;
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
  };
}

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Check if a string contains potential SQL injection patterns
 * Note: This is a client-side check; always use parameterized queries on the backend
 * @param input - Input string to check
 * @returns true if suspicious patterns found
 */
export function hasSQLInjectionPatterns(input: string): boolean {
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--|#|\/\*)/,
    /(\bOR\b.*=.*\bOR\b)/i,
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /;\s*(DROP|DELETE|UPDATE|INSERT)/i,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Check if a string contains potential XSS patterns
 * @param input - Input string to check
 * @returns true if suspicious patterns found
 */
export function hasXSSPatterns(input: string): boolean {
  const patterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /expression\s*\(/gi,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Generate a cryptographically secure random string
 * @param length - Length of the string
 * @returns Random string
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends Error {
  retryAfterMs: number;
  
  constructor(retryAfterMs: number) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    super(`Too many requests. Please try again in ${retryAfterSec} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Validation error with field-specific errors
 */
export class ValidationError extends Error {
  fieldErrors: string[];
  
  constructor(errors: string[]) {
    super(errors.join(', '));
    this.name = 'ValidationError';
    this.fieldErrors = errors;
  }
}

// ============================================================================
// SECURE ACTION WRAPPER
// ============================================================================

interface SecureActionOptions {
  rateLimitConfig?: RateLimitConfig;
  userId?: string;
  schema?: ObjectSchema;
  data?: Record<string, unknown>;
}

/**
 * Wrapper for secure actions that applies rate limiting and validation
 * @param action - The action to perform
 * @param options - Security options
 * @returns Result of the action
 * @throws RateLimitError if rate limited
 * @throws ValidationError if validation fails
 */
export async function secureAction<T>(
  action: () => Promise<T>,
  options: SecureActionOptions = {}
): Promise<T> {
  const { rateLimitConfig, userId, schema, data } = options;
  
  // Apply rate limiting
  if (rateLimitConfig) {
    const identifier = getRateLimitIdentifier(userId);
    const { allowed, retryAfterMs } = checkRateLimit(identifier, rateLimitConfig);
    
    if (!allowed) {
      throw new RateLimitError(retryAfterMs!);
    }
  }
  
  // Apply validation
  if (schema && data) {
    const result = validateSchema(data, schema);
    if (!result.valid) {
      throw new ValidationError(result.errors);
    }
  }
  
  return action();
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const __testing = {
  rateLimitStore,
  getClientFingerprint,
};

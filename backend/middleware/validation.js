const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const { JSDOM } = require('jsdom');
const logger = require('../utils/logger');

// Create a DOM environment for DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Enhanced Input Validation and Sanitization Middleware
 * Provides comprehensive input validation and XSS protection
 */

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character'),
  
  name: body('name')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Name must be 2-100 characters and contain only letters, spaces, hyphens, and apostrophes'),
  
  text: body('text')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Text must be between 1 and 10,000 characters'),
  
  id: param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
};

// Custom validation functions
const customValidations = {
  // Check if email is not a disposable email
  isNotDisposableEmail: (value) => {
    const disposableDomains = [
      'tempmail.org', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
      'throwaway.email', 'temp-mail.org', 'sharklasers.com', 'getairmail.com'
    ];
    
    const domain = value.split('@')[1];
    if (disposableDomains.includes(domain)) {
      throw new Error('Disposable email addresses are not allowed');
    }
    return true;
  },
  
  // Check if password is not in common passwords list
  isNotCommonPassword: (value) => {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'sunshine'
    ];
    
    if (commonPasswords.includes(value.toLowerCase())) {
      throw new Error('This password is too common, please choose a stronger one');
    }
    return true;
  },
  
  // Validate file type
  isValidFileType: (value) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (!allowedTypes.includes(value)) {
      throw new Error('File type not allowed');
    }
    return true;
  },
  
  // Validate URL
  isValidUrl: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      throw new Error('Invalid URL format');
    }
  }
};

// Sanitization functions
const sanitizers = {
  // Remove HTML tags and dangerous content
  removeHtml: (value) => {
    if (typeof value !== 'string') return value;
    return purify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  },
  
  // Sanitize HTML but allow safe tags
  sanitizeHtml: (value) => {
    if (typeof value !== 'string') return value;
    return purify.sanitize(value, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel']
    });
  },
  
  // Remove SQL injection patterns
  removeSqlInjection: (value) => {
    if (typeof value !== 'string') return value;
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|\/\*|\*\/|xp_|sp_)/gi,
      /(\b(and|or)\s+\d+\s*=\s*\d+)/gi
    ];
    
    let sanitized = value;
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized;
  },
  
  // Remove NoSQL injection patterns
  removeNoSqlInjection: (value) => {
    if (typeof value !== 'string') return value;
    const noSqlPatterns = [
      /\$where/gi,
      /\$ne/gi,
      /\$gt/gi,
      /\$lt/gi,
      /\$regex/gi,
      /\$in/gi,
      /\$nin/gi
    ];
    
    let sanitized = value;
    noSqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized;
  },
  
  // Remove command injection patterns
  removeCommandInjection: (value) => {
    if (typeof value !== 'string') return value;
    const commandPatterns = [
      /[;&|`$(){}[\]]/g,
      /\b(cat|ls|pwd|whoami|id|uname|ps|top|kill|rm|cp|mv|chmod|chown)\b/gi
    ];
    
    let sanitized = value;
    commandPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized;
  }
};

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation errors for security monitoring
    logger.warn({
      action: 'validation_error',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl,
      errors: errors.array()
    });
    
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({
          field: err.path,
          message: err.msg,
          value: err.value
        }))
      }
    });
  }
  
  next();
};

// Sanitize request body
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Apply multiple sanitization layers
        let sanitized = req.body[key];
        sanitized = sanitizers.removeHtml(sanitized);
        sanitized = sanitizers.removeSqlInjection(sanitized);
        sanitized = sanitizers.removeNoSqlInjection(sanitized);
        sanitized = sanitizers.removeCommandInjection(sanitized);
        
        req.body[key] = sanitized;
      }
    });
  }
  
  next();
};

// Sanitize query parameters
const sanitizeQuery = (req, res, next) => {
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        let sanitized = req.query[key];
        sanitized = sanitizers.removeHtml(sanitized);
        sanitized = sanitizers.removeSqlInjection(sanitized);
        sanitized = sanitizers.removeNoSqlInjection(sanitized);
        sanitized = sanitizers.removeCommandInjection(sanitized);
        
        req.query[key] = sanitized;
      }
    });
  }
  
  next();
};

// Sanitize URL parameters
const sanitizeParams = (req, res, next) => {
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        let sanitized = req.params[key];
        sanitized = sanitizers.removeHtml(sanitized);
        sanitized = sanitizers.removeSqlInjection(sanitized);
        sanitized = sanitizers.removeNoSqlInjection(sanitized);
        sanitized = sanitizers.removeCommandInjection(sanitized);
        
        req.params[key] = sanitized;
      }
    });
  }
  
  next();
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  const clientIP = req.ip;
  const userAgent = req.get('User-Agent');
  
  // Check for suspicious patterns in user agent
  const suspiciousUserAgents = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
    /python/i, /java/i, /perl/i, /ruby/i, /php/i, /go/i
  ];
  
  const isSuspicious = suspiciousUserAgents.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logger.warn({
      action: 'suspicious_user_agent',
      ip: clientIP,
      userAgent,
      path: req.originalUrl
    });
  }
  
  next();
};

// Export validation middleware
module.exports = {
  commonValidations,
  customValidations,
  sanitizers,
  handleValidationErrors,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  validateRateLimit
};

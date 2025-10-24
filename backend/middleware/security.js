const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const cors = require('cors');
const hpp = require('hpp');
// Note: We avoid xss-clean due to mutating req.query in newer router; rely on custom sanitizers and CSP
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Security Middleware Configuration
 * Implements multiple layers of security protection
 */

// Rate limiting configuration
const createRateLimiters = () => {
  // General API rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({
        action: 'rate_limit_exceeded',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl
      });
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        }
      });
    }
  });

  // Stricter rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({
        action: 'auth_rate_limit_exceeded',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl
      });
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many authentication attempts, please try again later.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        }
      });
    }
  });

  // File upload rate limiting
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 file uploads per hour
    message: {
      error: 'Too many file uploads, please try again later.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  return { apiLimiter, authLimiter, uploadLimiter };
};

// Speed limiting (gradual slowdown)
const createSpeedLimiters = () => {
  const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per 15 minutes without delay
    delayMs: () => 500, // New v2 behavior
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    validate: { delayMs: false }
  });

  return { speedLimiter };
};

// CORS configuration
const createCorsOptions = () => {
  const allowedOrigins = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',') : ['http://localhost:3000'];
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn({
          action: 'cors_blocked',
          origin,
          ip: origin,
          userAgent: 'Unknown'
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-auth-token',
      'X-API-Key',
      'X-Request-ID'
    ],
    exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
    maxAge: 86400 // 24 hours
  };
};

// Helmet security configuration
const createHelmetConfig = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "http://localhost:5000"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  });
};

// Request validation middleware
const validateRequest = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload/i,
    /onerror/i,
    /onclick/i,
    /eval\(/i,
    /expression\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<applet/i,
    /<meta/i,
    /<link/i,
    /<base/i
  ];

  const userInput = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userInput)) {
      logger.warn({
        action: 'suspicious_input_detected',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl,
        pattern: pattern.source
      });
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Suspicious input detected',
          code: 'SUSPICIOUS_INPUT'
        }
      });
    }
  }

  next();
};

// IP filtering middleware
const ipFilter = (req, res, next) => {
  const blockedIPs = env.BLOCKED_IPS ? env.BLOCKED_IPS.split(',') : [];
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (blockedIPs.includes(clientIP)) {
    logger.warn({
      action: 'blocked_ip_access',
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    
    return res.status(403).json({
      success: false,
      error: {
        message: 'Access denied',
        code: 'IP_BLOCKED'
      }
    });
  }
  
  next();
};

// Request size limiting
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    logger.warn({
      action: 'request_size_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl,
      size: contentLength,
      maxSize
    });
    
    return res.status(413).json({
      success: false,
      error: {
        message: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE'
      }
    });
  }
  
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add request ID for tracking
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = require('crypto').randomUUID();
  }
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  
  next();
};

// Logging middleware for security events
const securityLogging = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log suspicious activities
    if (res.statusCode >= 400) {
      logger.warn({
        action: 'security_event',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        requestId: req.headers['x-request-id']
      });
    }
  });
  
  next();
};

// Export all security middleware
module.exports = {
  createRateLimiters,
  createSpeedLimiters,
  createCorsOptions,
  createHelmetConfig,
  validateRequest,
  ipFilter,
  requestSizeLimit,
  securityHeaders,
  securityLogging
};

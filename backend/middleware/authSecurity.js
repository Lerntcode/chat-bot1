const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { RateLimitError, TokenError, AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Enhanced Authentication Security Middleware
 * Implements advanced security measures for authentication
 */

// Session management
const activeSessions = new Map();
const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

// Failed login attempts tracking
const failedLoginAttempts = new Map();
const maxFailedAttempts = 5;
const lockoutDuration = 15 * 60 * 1000; // 15 minutes

// JWT token blacklist for logout
const tokenBlacklist = new Set();

/**
 * Enhanced JWT verification with additional security checks
 */
const verifyJWT = (token) => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new TokenError('Token has been revoked');
    }

    // Verify token signature
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Check token expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      throw new TokenError('Token has expired');
    }

    // Check if token was issued before a certain time (for forced re-authentication)
    if (decoded.iat && Date.now() - decoded.iat * 1000 > sessionTimeout) {
      throw new TokenError('Session expired, please login again');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new TokenError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new TokenError('Token has expired');
    }
    throw error;
  }
};

/**
 * Enhanced authentication middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    // Verify and decode token
    const decoded = verifyJWT(token);
    
    // Check if user session is still active
    if (!activeSessions.has(decoded.user.id)) {
      throw new AuthenticationError('Session not found');
    }

    // Check session timeout
    const session = activeSessions.get(decoded.user.id);
    if (Date.now() - session.lastActivity > sessionTimeout) {
      activeSessions.delete(decoded.user.id);
      throw new AuthenticationError('Session expired');
    }

    // Update last activity
    session.lastActivity = Date.now();
    activeSessions.set(decoded.user.id, session);

    // Add user info to request
    req.user = {
      id: decoded.user.id,
      email: decoded.user.email,
      role: decoded.user.role,
      sessionId: session.sessionId
    };

    // Add security headers
    res.setHeader('X-User-ID', decoded.user.id);
    res.setHeader('X-Session-ID', session.sessionId);

    next();
  } catch (error) {
    logger.warn({
      action: 'authentication_failed',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl,
      error: error.message
    });

    if (error instanceof TokenError || error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: {
          message: error.message,
          code: error.name,
          statusCode: 401
        }
      });
    }

    next(error);
  }
};

/**
 * Role-based access control middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn({
        action: 'unauthorized_access',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles
      });

      return res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          statusCode: 403
        }
      });
    }

    next();
  };
};

/**
 * Enhanced login security middleware
 */
const checkLoginSecurity = (req, res, next) => {
  const clientIP = req.ip;
  const now = Date.now();

  // Check if IP is locked out
  if (failedLoginAttempts.has(clientIP)) {
    const attempts = failedLoginAttempts.get(clientIP);
    
    if (attempts.count >= maxFailedAttempts && now - attempts.lastAttempt < lockoutDuration) {
      const remainingTime = Math.ceil((lockoutDuration - (now - attempts.lastAttempt)) / 1000);
      
      logger.warn({
        action: 'login_attempt_blocked',
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        remainingLockoutTime: remainingTime
      });

      return res.status(429).json({
        success: false,
        error: {
          message: `Too many failed login attempts. Please try again in ${remainingTime} seconds.`,
          code: 'LOGIN_BLOCKED',
          statusCode: 429,
          retryAfter: remainingTime
        }
      });
    }

    // Reset if lockout period has passed
    if (now - attempts.lastAttempt >= lockoutDuration) {
      failedLoginAttempts.delete(clientIP);
    }
  }

  next();
};

/**
 * Record failed login attempt
 */
const recordFailedLogin = (req, res, next) => {
  const clientIP = req.ip;
  const now = Date.now();

  if (!failedLoginAttempts.has(clientIP)) {
    failedLoginAttempts.set(clientIP, { count: 1, lastAttempt: now });
  } else {
    const attempts = failedLoginAttempts.get(clientIP);
    attempts.count += 1;
    attempts.lastAttempt = now;
    failedLoginAttempts.set(clientIP, attempts);
  }

  next();
};

/**
 * Create secure session
 */
const createSecureSession = (userId, email, role) => {
  const sessionId = crypto.randomUUID();
  const session = {
    sessionId,
    userId,
    email,
    role,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };

  activeSessions.set(userId, session);

  // Clean up old sessions
  cleanupOldSessions();

  return sessionId;
};

/**
 * Clean up old sessions
 */
const cleanupOldSessions = () => {
  const now = Date.now();
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > sessionTimeout) {
      activeSessions.delete(userId);
    }
  }
};

/**
 * Logout and invalidate session
 */
const logout = (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      // Remove from active sessions
      activeSessions.delete(req.user.id);
      
      // Add token to blacklist
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        tokenBlacklist.add(token);
        
        // Clean up old blacklisted tokens periodically
        if (tokenBlacklist.size > 10000) {
          const tokens = Array.from(tokenBlacklist);
          tokenBlacklist.clear();
          // Keep only recent tokens
          tokens.slice(-5000).forEach(t => tokenBlacklist.add(t));
        }
      }

      logger.info({
        action: 'user_logout',
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Force re-authentication middleware
 */
const requireRecentAuth = (maxAge = 5 * 60 * 1000) => { // 5 minutes
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401
        }
      });
    }

    const session = activeSessions.get(req.user.id);
    if (!session || Date.now() - session.lastActivity > maxAge) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Recent authentication required',
          code: 'RECENT_AUTH_REQUIRED',
          statusCode: 401
        }
      });
    }

    next();
  };
};

/**
 * Generate secure refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash password with enhanced security
 */
const hashPassword = async (password) => {
  const saltRounds = 12; // Increased from default 10
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password securely
 */
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate secure JWT token
 */
const generateJWT = (payload, options = {}) => {
  const defaultOptions = {
    expiresIn: '15m', // Short-lived access token
    issuer: 'chatbot-app',
    audience: 'chatbot-users',
    ...options
  };

  return jwt.sign(payload, env.JWT_SECRET, defaultOptions);
};

// Export all authentication security functions
module.exports = {
  verifyJWT,
  authenticateToken,
  requireRole,
  checkLoginSecurity,
  recordFailedLogin,
  createSecureSession,
  logout,
  requireRecentAuth,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  generateJWT,
  activeSessions,
  failedLoginAttempts
};

const logger = require('../utils/logger');
const { AppError, ErrorCodes, ErrorMessages } = require('../utils/errors');
const env = require('../config/env');

/**
 * Global Error Handler Middleware
 * Provides consistent error responses and logging
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error details
  const errorLog = {
    type: 'error',
    message: err.message,
    stack: env.IS_PROD ? undefined : err.stack,
    requestId: res.getHeader('x-request-id'),
    path: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  };

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400);
  } else if (err.name === 'CastError') {
    // Mongoose cast error (invalid ID)
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400);
  } else if (err.code === 11000) {
    // Duplicate key error
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new AppError(message, 400);
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    error = new AppError('Invalid token', 401);
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    error = new AppError('Token expired', 401);
  } else if (err.name === 'SequelizeValidationError') {
    // Sequelize validation error
    const message = err.errors.map(e => e.message).join(', ');
    error = new AppError(message, 400);
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    // Sequelize unique constraint error
    const field = err.errors[0].path;
    const message = `${field} already exists`;
    error = new AppError(message, 400);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    // Sequelize foreign key error
    error = new AppError('Referenced resource does not exist', 400);
  } else if (err.name === 'SequelizeDatabaseError') {
    // Database error
    error = new AppError('Database operation failed', 500);
  } else if (err.name === 'MulterError') {
    // File upload error
    let message = 'File upload failed';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds the maximum limit';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
    error = new AppError(message, 400);
  } else if (err.name === 'SyntaxError' && err.status === 400) {
    // JSON parsing error
    error = new AppError('Invalid JSON format', 400);
  } else if (err.name === 'TypeError' && err.message.includes('Cannot read property')) {
    // Property access error
    error = new AppError('Invalid request data', 400);
  }

  // Set default status code if not set
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational !== false;

  // Log error with appropriate level
  if (statusCode >= 500) {
    logger.error(errorLog);
  } else {
    logger.warn(errorLog);
  }

  // Send error response
  const response = {
    success: false,
    error: {
      message: isOperational ? error.message : ErrorMessages[ErrorCodes.INTERNAL_SERVER_ERROR],
      code: isOperational ? error.name : ErrorCodes.INTERNAL_SERVER_ERROR,
      statusCode: statusCode,
      timestamp: error.timestamp || new Date().toISOString(),
      requestId: res.getHeader('x-request-id')
    }
  };

  // Add additional details in development
  if (!env.IS_PROD) {
    response.error.stack = error.stack;
    response.error.details = {
      originalError: err.message,
      path: req.originalUrl,
      method: req.method
    };
  }

  // Add validation errors if present
  if (err.errors && Array.isArray(err.errors)) {
    response.error.validationErrors = err.errors.map(e => ({
      field: e.path || e.param,
      message: e.message,
      value: e.value
    }));
  }

  res.status(statusCode).json(response);
};

/**
 * Async Error Handler Wrapper
 * Catches async errors and passes them to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

/**
 * Maintenance Mode Handler
 * Redirects all requests when in maintenance mode
 */
const maintenanceHandler = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    return res.status(503).json({
      success: false,
      error: {
        message: ErrorMessages[ErrorCodes.MAINTENANCE_MODE],
        code: ErrorCodes.MAINTENANCE_MODE,
        statusCode: 503,
        timestamp: new Date().toISOString(),
        requestId: res.getHeader('x-request-id')
      }
    });
  }
  next();
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  maintenanceHandler
};

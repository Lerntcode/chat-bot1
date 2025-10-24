/**
 * Custom Error Classes for better error handling and user feedback
 */

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

class TokenError extends AppError {
  constructor(message = 'Invalid or expired token') {
    super(message, 401);
    this.name = 'TokenError';
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500);
    this.name = 'DatabaseError';
    this.isOperational = false;
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error') {
    super(`${service}: ${message}`, 502);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.isOperational = false;
  }
}

class FileUploadError extends AppError {
  constructor(message = 'File upload failed') {
    super(message, 400);
    this.name = 'FileUploadError';
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, 400);
    this.name = 'PaymentError';
  }
}

// Error codes for consistent error messages
const ErrorCodes = {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_TOKEN_EXPIRED: 'AUTH_002',
  AUTH_TOKEN_INVALID: 'AUTH_003',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_004',
  AUTH_ACCOUNT_LOCKED: 'AUTH_005',
  
  // Validation
  VALIDATION_REQUIRED_FIELD: 'VAL_001',
  VALIDATION_INVALID_FORMAT: 'VAL_002',
  VALIDATION_TOO_LONG: 'VAL_003',
  VALIDATION_TOO_SHORT: 'VAL_004',
  VALIDATION_INVALID_EMAIL: 'VAL_005',
  
  // Resources
  RESOURCE_NOT_FOUND: 'RES_001',
  RESOURCE_ALREADY_EXISTS: 'RES_002',
  RESOURCE_DELETED: 'RES_003',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_001',
  RATE_LIMIT_TOO_FAST: 'RATE_002',
  
  // Database
  DB_CONNECTION_FAILED: 'DB_001',
  DB_QUERY_FAILED: 'DB_002',
  DB_TRANSACTION_FAILED: 'DB_003',
  
  // External Services
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXT_001',
  EXTERNAL_SERVICE_TIMEOUT: 'EXT_002',
  EXTERNAL_SERVICE_INVALID_RESPONSE: 'EXT_003',
  
  // File Operations
  FILE_TOO_LARGE: 'FILE_001',
  FILE_INVALID_TYPE: 'FILE_002',
  FILE_UPLOAD_FAILED: 'FILE_003',
  FILE_PROCESSING_FAILED: 'FILE_004',
  
  // Payments
  PAYMENT_INSUFFICIENT_FUNDS: 'PAY_001',
  PAYMENT_DECLINED: 'PAY_002',
  PAYMENT_PROCESSING_FAILED: 'PAY_003',
  
  // General
  INTERNAL_SERVER_ERROR: 'GEN_001',
  MAINTENANCE_MODE: 'GEN_002',
  FEATURE_DISABLED: 'GEN_003'
};

// Error message templates
const ErrorMessages = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again',
  [ErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]: 'You don\'t have permission to perform this action',
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 'Your account has been temporarily locked. Please try again later',
  
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: 'This field is required',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 'Invalid format',
  [ErrorCodes.VALIDATION_TOO_LONG]: 'Value is too long',
  [ErrorCodes.VALIDATION_TOO_SHORT]: 'Value is too short',
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: 'Please enter a valid email address',
  
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 'This resource already exists',
  [ErrorCodes.RESOURCE_DELETED]: 'This resource has been deleted',
  
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down',
  [ErrorCodes.RATE_LIMIT_TOO_FAST]: 'Please wait before making another request',
  
  [ErrorCodes.DB_CONNECTION_FAILED]: 'Database connection failed',
  [ErrorCodes.DB_QUERY_FAILED]: 'Database query failed',
  [ErrorCodes.DB_TRANSACTION_FAILED]: 'Database transaction failed',
  
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: 'External service is currently unavailable',
  [ErrorCodes.EXTERNAL_SERVICE_TIMEOUT]: 'External service request timed out',
  [ErrorCodes.EXTERNAL_SERVICE_INVALID_RESPONSE]: 'External service returned invalid response',
  
  [ErrorCodes.FILE_TOO_LARGE]: 'File size exceeds the maximum limit',
  [ErrorCodes.FILE_INVALID_TYPE]: 'File type is not supported',
  [ErrorCodes.FILE_UPLOAD_FAILED]: 'File upload failed',
  [ErrorCodes.FILE_PROCESSING_FAILED]: 'File processing failed',
  
  [ErrorCodes.PAYMENT_INSUFFICIENT_FUNDS]: 'Insufficient funds for this transaction',
  [ErrorCodes.PAYMENT_DECLINED]: 'Payment was declined',
  [ErrorCodes.PAYMENT_PROCESSING_FAILED]: 'Payment processing failed',
  
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'An internal server error occurred',
  [ErrorCodes.MAINTENANCE_MODE]: 'System is under maintenance',
  [ErrorCodes.FEATURE_DISABLED]: 'This feature is currently disabled'
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  TokenError,
  DatabaseError,
  ExternalServiceError,
  FileUploadError,
  PaymentError,
  ErrorCodes,
  ErrorMessages
};

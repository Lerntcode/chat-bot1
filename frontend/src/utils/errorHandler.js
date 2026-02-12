/**
 * Frontend Error Handling Utilities
 * Provides consistent error handling and user feedback
 */

// Error types for frontend
export const ErrorTypes = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN'
};

// Error messages for user-friendly display
export const ErrorMessages = {
  [ErrorTypes.NETWORK]: 'Network connection failed. Please check your internet connection.',
  [ErrorTypes.VALIDATION]: 'Please check your input and try again.',
  [ErrorTypes.AUTHENTICATION]: 'Please log in to continue.',
  [ErrorTypes.AUTHORIZATION]: 'You don\'t have permission to perform this action.',
  [ErrorTypes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorTypes.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ErrorTypes.SERVER]: 'Server error occurred. Please try again later.',
  [ErrorTypes.UNKNOWN]: 'An unexpected error occurred. Please try again.'
};

/**
 * Parse API error response
 */
export const parseApiError = (error) => {
  if (!error) {
    return {
      type: ErrorTypes.UNKNOWN,
      message: 'Unknown error occurred',
      code: 'UNKNOWN'
    };
  }

  // Network errors
  if (!error.response) {
    return {
      type: ErrorTypes.NETWORK,
      message: ErrorMessages[ErrorTypes.NETWORK],
      code: 'NETWORK_ERROR'
    };
  }

  const { status, data } = error.response;

  // Parse error from API response
  if (data && data.error) {
    return {
      type: getErrorType(status),
      message: data.error.message || ErrorMessages[getErrorType(status)],
      code: data.error.code || `HTTP_${status}`,
      statusCode: status,
      details: data.error.details,
      validationErrors: data.error.validationErrors
    };
  }

  // Fallback error parsing
  return {
    type: getErrorType(status),
    message: ErrorMessages[getErrorType(status)],
    code: `HTTP_${status}`,
    statusCode: status
  };
};

/**
 * Get error type based on HTTP status code
 */
export const getErrorType = (statusCode) => {
  if (statusCode >= 500) return ErrorTypes.SERVER;
  if (statusCode === 429) return ErrorTypes.RATE_LIMIT;
  if (statusCode === 404) return ErrorTypes.NOT_FOUND;
  if (statusCode === 403) return ErrorTypes.AUTHORIZATION;
  if (statusCode === 401) return ErrorTypes.AUTHENTICATION;
  if (statusCode === 400) return ErrorTypes.VALIDATION;
  return ErrorTypes.UNKNOWN;
};

/**
 * Show error notification
 */
export const showErrorNotification = (error, options = {}) => {
  const {
    title = 'Error',
    duration = 5000,
    type = 'error'
  } = options;

  // Log to console
  console.error(`${title}:`, error);

  // Use notification system if available
  if (window.showNotification) {
    window.showNotification({
      title,
      message: error.message,
      type,
      duration
    });
  }
};

/**
 * Handle API errors with automatic retry
 */
export const handleApiError = async (apiCall, maxRetries = 3, delay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      const parsedError = parseApiError(error);

      // Don't retry on certain error types
      if (parsedError.type === ErrorTypes.AUTHENTICATION ||
        parsedError.type === ErrorTypes.AUTHORIZATION ||
        parsedError.type === ErrorTypes.VALIDATION) {
        throw error;
      }

      // Log retry attempt
      console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, parsedError);

      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
};

/**
 * Validate form data
 */
export const validateFormData = (data, rules) => {
  const errors = {};

  Object.keys(rules).forEach(field => {
    const value = data[field];
    const fieldRules = rules[field];

    // Required validation
    if (fieldRules.required && (!value || value.trim() === '')) {
      errors[field] = `${field} is required`;
      return;
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim() === '') return;

    // Min length validation
    if (fieldRules.minLength && value.length < fieldRules.minLength) {
      errors[field] = `${field} must be at least ${fieldRules.minLength} characters`;
    }

    // Max length validation
    if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
      errors[field] = `${field} must be no more than ${fieldRules.maxLength} characters`;
    }

    // Email validation
    if (fieldRules.email && !isValidEmail(value)) {
      errors[field] = 'Please enter a valid email address';
    }

    // Pattern validation
    if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
      errors[field] = fieldRules.message || `${field} format is invalid`;
    }

    // Custom validation
    if (fieldRules.custom) {
      const customError = fieldRules.custom(value, data);
      if (customError) {
        errors[field] = customError;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Email validation helper
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Error boundary error handler
 */
export const handleErrorBoundaryError = (error, errorInfo) => {
  // Log error details
  console.error('Error Boundary Error:', error);
  console.error('Error Info:', errorInfo);

  // Send to error reporting service in production
  if (process.env.NODE_ENV === 'production') {
    // You can integrate with services like Sentry, LogRocket, etc.
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }
};

/**
 * Global error handler for unhandled errors
 */
export const setupGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    showErrorNotification({
      type: ErrorTypes.UNKNOWN,
      message: 'An unexpected error occurred'
    });
  });

  window.addEventListener('error', (event) => {
    // Filter out ResizeObserver loop limit exceeded errors (harmless)
    if (event.message === 'ResizeObserver loop limit exceeded') return;

    let errorDetails = event.message || 'Unknown error';

    // Inspect the error object if it's a generic Event
    if (event.error && event.error.constructor && event.error.constructor.name === 'Event') {
      const target = event.error.target;
      errorDetails = `Event Error: type=${event.error.type}, target=${target ? (target.tagName || target.constructor.name) : 'unknown'}`;
      if (target instanceof HTMLImageElement) errorDetails += ` (Image src: ${target.src})`;
      if (target instanceof HTMLScriptElement) errorDetails += ` (Script src: ${target.src})`;
    } else if (event.error) {
      errorDetails = event.error.message || String(event.error);
    }

    console.error('Global Uncaught Error:', errorDetails, event);

    showErrorNotification({
      type: ErrorTypes.UNKNOWN,
      message: 'An unexpected application error occurred'
    });
  });
};

/**
 * Create error object with context
 */
export const createError = (message, type = ErrorTypes.UNKNOWN, context = {}) => {
  return {
    message,
    type,
    code: type.toUpperCase(),
    timestamp: new Date().toISOString(),
    context,
    stack: new Error().stack
  };
};

/**
 * Debounced error logging
 */
export const debouncedErrorLog = (() => {
  let timeoutId;
  const errors = [];

  return (error) => {
    errors.push(error);

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (errors.length > 0) {
        console.group('Multiple Errors Detected');
        errors.forEach(err => console.error(err));
        console.groupEnd();
        errors.length = 0;
      }
    }, 1000);
  };
})();

export default {
  ErrorTypes,
  ErrorMessages,
  parseApiError,
  getErrorType,
  showErrorNotification,
  handleApiError,
  validateFormData,
  isValidEmail,
  handleErrorBoundaryError,
  setupGlobalErrorHandling,
  createError,
  debouncedErrorLog
};

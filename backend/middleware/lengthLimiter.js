// Generic input length limiting middleware
// Rejects requests where any string field exceeds configured thresholds
// Helps prevent DoS via extremely large payloads

const DEFAULT_LIMITS = {
  body: 10000, // characters
  query: 2048,
  params: 256,
};

// Optional per-field overrides
const FIELD_LIMITS = {
  // Common fields
  email: 254,
  password: 1024,
  name: 100,
  title: 200,
  message: 8000,
  token: 512,
  model: 100,
  conversationId: 64,
};

function checkObjectLengths(obj, defaultLimit, location) {
  if (!obj) return null;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      const limit = FIELD_LIMITS[key] || defaultLimit;
      if (value.length > limit) {
        return {
          location,
          field: key,
          limit,
          actual: value.length,
        };
      }
    }
  }
  return null;
}

module.exports = function createLengthLimiter(customLimits = {}) {
  const limits = { ...DEFAULT_LIMITS, ...customLimits };
  return function lengthLimiter(req, res, next) {
    const violation =
      checkObjectLengths(req.body, limits.body, 'body') ||
      checkObjectLengths(req.query, limits.query, 'query') ||
      checkObjectLengths(req.params, limits.params, 'params');

    if (violation) {
      return res.status(413).json({
        error: 'Input too large',
        details: `Field "${violation.field}" in ${violation.location} exceeds limit of ${violation.limit} characters (received ${violation.actual}).`,
      });
    }
    next();
  };
};

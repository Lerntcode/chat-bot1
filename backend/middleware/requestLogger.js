const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Lightweight request logging middleware for anomaly detection
// Logs method, path, user id (if any), IP, status, duration

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

module.exports = function requestLogger(req, res, next) {
  // Ensure a request id exists and is propagated
  const requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();
  const userId = req.user?.id || null;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    logger.info({
      type: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Math.round(ms),
      userId,
      ip,
      ua: req.headers['user-agent'],
      contentLength: req.headers['content-length'] || null,
    });
  });

  next();
}

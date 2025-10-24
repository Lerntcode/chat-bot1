const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

/**
 * @swagger
 * /api/v1/logs/error:
 *   post:
 *     summary: Log frontend errors
 *     tags: [Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Error message
 *               stack:
 *                 type: string
 *                 description: Error stack trace
 *               componentStack:
 *                 type: string
 *                 description: React component stack
 *               context:
 *                 type: string
 *                 description: Error context
 *               userAgent:
 *                 type: string
 *                 description: Browser user agent
 *               url:
 *                 type: string
 *                 description: Page URL where error occurred
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Error timestamp
 *     responses:
 *       200:
 *         description: Error logged successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/error', asyncHandler(async (req, res) => {
  const {
    message,
    stack,
    componentStack,
    context,
    userAgent,
    url,
    timestamp
  } = req.body;

  // Validate required fields
  if (!message) {
    throw new ValidationError('Error message is required');
  }

  // Log the error with structured data
  const errorLog = {
    type: 'frontend_error',
    message,
    stack: stack || null,
    componentStack: componentStack || null,
    context: context || 'unknown',
    userAgent: userAgent || req.get('User-Agent'),
    url: url || req.get('Referer'),
    timestamp: timestamp || new Date().toISOString(),
    ip: req.ip,
    requestId: res.getHeader('x-request-id')
  };

  // Log with appropriate level based on error severity
  if (message.includes('Network Error') || message.includes('timeout')) {
    logger.warn(errorLog);
  } else {
    logger.error(errorLog);
  }

  res.status(200).json({
    success: true,
    message: 'Error logged successfully'
  });
}));

/**
 * @swagger
 * /api/v1/logs/performance:
 *   post:
 *     summary: Log frontend performance metrics
 *     tags: [Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metrics
 *             properties:
 *               metrics:
 *                 type: object
 *                 description: Performance metrics
 *               url:
 *                 type: string
 *                 description: Page URL
 *               userAgent:
 *                 type: string
 *                 description: Browser user agent
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Metrics timestamp
 *     responses:
 *       200:
 *         description: Performance metrics logged successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/performance', asyncHandler(async (req, res) => {
  const {
    metrics,
    url,
    userAgent,
    timestamp
  } = req.body;

  // Validate required fields
  if (!metrics || typeof metrics !== 'object') {
    throw new ValidationError('Performance metrics are required');
  }

  // Log performance metrics
  const performanceLog = {
    type: 'frontend_performance',
    metrics,
    url: url || req.get('Referer'),
    userAgent: userAgent || req.get('User-Agent'),
    timestamp: timestamp || new Date().toISOString(),
    ip: req.ip,
    requestId: res.getHeader('x-request-id')
  };

  logger.info(performanceLog);

  res.status(200).json({
    success: true,
    message: 'Performance metrics logged successfully'
  });
}));

/**
 * @swagger
 * /api/v1/logs/analytics:
 *   post:
 *     summary: Log frontend analytics events
 *     tags: [Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event name
 *               properties:
 *                 type: object
 *                 description: Event properties
 *               url:
 *                 type: string
 *                 description: Page URL
 *               userAgent:
 *                 type: string
 *                 description: Browser user agent
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Event timestamp
 *     responses:
 *       200:
 *         description: Analytics event logged successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/analytics', asyncHandler(async (req, res) => {
  const {
    event,
    properties,
    url,
    userAgent,
    timestamp
  } = req.body;

  // Validate required fields
  if (!event) {
    throw new ValidationError('Event name is required');
  }

  // Log analytics event
  const analyticsLog = {
    type: 'frontend_analytics',
    event,
    properties: properties || {},
    url: url || req.get('Referer'),
    userAgent: userAgent || req.get('User-Agent'),
    timestamp: timestamp || new Date().toISOString(),
    ip: req.ip,
    requestId: res.getHeader('x-request-id')
  };

  logger.info(analyticsLog);

  res.status(200).json({
    success: true,
    message: 'Analytics event logged successfully'
  });
}));

module.exports = router;

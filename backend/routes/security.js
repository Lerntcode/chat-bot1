const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, requireRole } = require('../middleware/authSecurity');
const { activeSessions, failedLoginAttempts } = require('../middleware/authSecurity');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/security/dashboard:
 *   get:
 *     summary: Get security dashboard data (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security dashboard data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/dashboard', 
  authenticateToken, 
  requireRole(['admin']), 
  asyncHandler(async (req, res) => {
    const now = Date.now();
    
    // Get active sessions
    const activeSessionsData = Array.from(activeSessions.entries()).map(([userId, session]) => ({
      userId,
      email: session.email,
      role: session.role,
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      ip: session.ip,
      userAgent: session.userAgent,
      isActive: now - session.lastActivity < 24 * 60 * 60 * 1000
    }));

    // Get failed login attempts
    const failedLoginData = Array.from(failedLoginAttempts.entries()).map(([ip, attempts]) => ({
      ip,
      count: attempts.count,
      lastAttempt: attempts.lastAttempt,
      isBlocked: attempts.count >= 5 && now - attempts.lastAttempt < 15 * 60 * 1000
    }));

    // Get recent security events from logs
    const securityEvents = await getRecentSecurityEvents();

    res.json({
      success: true,
      data: {
        activeSessions: activeSessionsData,
        failedLoginAttempts: failedLoginData,
        securityEvents,
        summary: {
          totalActiveSessions: activeSessionsData.length,
          totalBlockedIPs: failedLoginData.filter(ip => ip.isBlocked).length,
          totalSecurityEvents: securityEvents.length
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/security/sessions:
 *   get:
 *     summary: Get all active sessions (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/sessions', 
  authenticateToken, 
  requireRole(['admin']), 
  asyncHandler(async (req, res) => {
    const sessions = Array.from(activeSessions.entries()).map(([userId, session]) => ({
      userId,
      email: session.email,
      role: session.role,
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      ip: session.ip,
      userAgent: session.userAgent,
      duration: Date.now() - session.createdAt
    }));

    res.json({
      success: true,
      data: sessions
    });
  })
);

/**
 * @swagger
 * /api/v1/security/sessions/{userId}:
 *   delete:
 *     summary: Terminate a specific user session (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session terminated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:userId', 
  authenticateToken, 
  requireRole(['admin']), 
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    if (activeSessions.has(userId)) {
      const session = activeSessions.get(userId);
      activeSessions.delete(userId);
      
      logger.info({
        action: 'session_terminated_by_admin',
        adminUserId: req.user.id,
        terminatedUserId: userId,
        terminatedSessionId: session.sessionId
      });

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }
  })
);

/**
 * @swagger
 * /api/v1/security/blocked-ips:
 *   get:
 *     summary: Get blocked IP addresses (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked IP addresses list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/blocked-ips', 
  authenticateToken, 
  requireRole(['admin']), 
  asyncHandler(async (req, res) => {
    const now = Date.now();
    const blockedIPs = Array.from(failedLoginAttempts.entries())
      .filter(([ip, attempts]) => attempts.count >= 5 && now - attempts.lastAttempt < 15 * 60 * 1000)
      .map(([ip, attempts]) => ({
        ip,
        count: attempts.count,
        lastAttempt: attempts.lastAttempt,
        remainingBlockTime: Math.ceil((15 * 60 * 1000 - (now - attempts.lastAttempt)) / 1000)
      }));

    res.json({
      success: true,
      data: blockedIPs
    });
  })
);

/**
 * @swagger
 * /api/v1/security/blocked-ips/{ip}:
 *   delete:
 *     summary: Unblock an IP address (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IP address unblocked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete('/blocked-ips/:ip', 
  authenticateToken, 
  requireRole(['admin']), 
  asyncHandler(async (req, res) => {
    const { ip } = req.params;
    
    if (failedLoginAttempts.has(ip)) {
      failedLoginAttempts.delete(ip);
      
      logger.info({
        action: 'ip_unblocked_by_admin',
        adminUserId: req.user.id,
        unblockedIP: ip
      });

      res.json({
        success: true,
        message: 'IP address unblocked successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: 'IP address not found in blocked list',
          code: 'IP_NOT_BLOCKED'
        }
      });
    }
  })
);

/**
 * @swagger
 * /api/v1/security/events:
 *   get:
 *     summary: Get recent security events (Admin only)
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     query:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, authentication, authorization, file_upload, suspicious]
 *     responses:
 *       200:
 *         description: Security events list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/events', 
  authenticateToken, 
  requireRole(['admin']), 
  asyncHandler(async (req, res) => {
    const { limit = 50, type = 'all' } = req.query;
    
    const events = await getRecentSecurityEvents(parseInt(limit), type);
    
    res.json({
      success: true,
      data: events
    });
  })
);

/**
 * Helper function to get recent security events
 */
async function getRecentSecurityEvents(limit = 50, type = 'all') {
  // This would typically query your logging system or database
  // For now, we'll return a mock structure
  const mockEvents = [
    {
      id: '1',
      type: 'authentication',
      action: 'login_failed',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      timestamp: new Date().toISOString(),
      details: 'Multiple failed login attempts'
    },
    {
      id: '2',
      type: 'file_upload',
      action: 'file_rejected',
      ip: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      timestamp: new Date().toISOString(),
      details: 'Suspicious file content detected'
    }
  ];

  // Filter by type if specified
  if (type !== 'all') {
    return mockEvents.filter(event => event.type === type).slice(0, limit);
  }

  return mockEvents.slice(0, limit);
}

module.exports = router;

const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ModelTokenBalance = require('../models/ModelTokenBalance');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Helper to generate refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth consent screen
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback handler
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirects to frontend with token or error
 *       400:
 *         description: Authentication failed
 */
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        logger.warn({ action: 'google_oauth_callback', result: 'no_user' });
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?error=authentication_failed`);
      }

      // Generate JWT tokens
      const payload = {
        user: {
          id: user.id,
        },
      };

      // Access token (short-lived)
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 900 }); // 15 min
      
      // Refresh token (long-lived)
      const refreshToken = generateRefreshToken();
      user.refreshToken = refreshToken;
      await user.save();

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info({ action: 'google_oauth_callback', userId: user.id, result: 'success' });

      // Redirect to frontend with access token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth?token=${accessToken}&success=true`);

    } catch (error) {
      logger.error({ action: 'google_oauth_callback', error: error.message });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth?error=server_error`);
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/google/status:
 *   get:
 *     summary: Check Google OAuth configuration status
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: OAuth configuration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configured:
 *                   type: boolean
 *                 clientId:
 *                   type: string
 *                 callbackUrl:
 *                   type: string
 */
router.get('/google/status', (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  
  res.json({
    configured: isConfigured,
    clientId: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/google/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  });
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ModelTokenBalance = require('../models/ModelTokenBalance');
const TokenUsage = require('../models/TokenUsage');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const EmailVerificationToken = require('../models/EmailVerificationToken');

const router = express.Router();

// Rate limiter for login - TEMPORARILY DISABLED FOR TESTING
// const loginLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 10,
//   standardHeaders: true,
//   legacyHeaders: false,
//   keyGenerator: (req) => req.body?.email || req.ip,
//   message: { error: 'Too many login attempts, please try again shortly.' }
// });

// Helper to generate refresh token
function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: mysecretpassword
 *     responses:
 *       200:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                 msg:
 *                   type: string
 */
// Register
router.post('/register', [
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain a number.')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a special character.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({ action: 'register', email: req.body.email, result: 'validation_error', errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ where: { email } });
    if (user) {
      logger.warn({ action: 'register', email, result: 'user_exists' });
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = await User.create({
      email,
      password: hashedPassword,
      emailVerified: false,
    });

    // Initialize model-specific token balances for new user
    await ModelTokenBalance.create({
      userId: user.id,
      modelId: 'gpt-4.1-nano',
      balance: 100 // Default tokens for new users
    });

    // Create email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await EmailVerificationToken.create({ userId: user.id, token: verificationToken, expiresAt });

    // TODO: Send email via configured provider. For now return the token for testing.
    logger.info({ action: 'register', userId: user.id, email, result: 'pending_verification' });
    res.status(201).json({ msg: 'Registration successful. Please verify your email.', verificationToken });
  } catch (err) {
    logger.error({ action: 'register', email, error: err.message });
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: mysecretpassword
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       400:
 *         description: Validation error or invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                 msg:
 *                   type: string
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Login
router.post('/login', [
  // loginLimiter, // TEMPORARILY DISABLED FOR TESTING
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').exists().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({ action: 'login', email: req.body.email, result: 'validation_error', errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ where: { email } });
    if (!user) {
      logger.warn({ action: 'login', email, result: 'invalid_credentials' });
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Account lockout check
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      return res.status(423).json({ msg: 'Account locked. Try again later.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn({ action: 'login', email, userId: user.id, result: 'invalid_credentials' });
      // Increment failed attempts and apply lockout
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
      user.failedLoginAttempts = attempts;
      if (attempts >= MAX_ATTEMPTS) {
        user.lockoutUntil = new Date(Date.now() + LOCKOUT_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await user.save();

    // Check if 2FA is enabled for the user
    if (user.twoFactorEnabled) {
      // If 2FA is enabled, we need a 2FA token to complete login
      // Return a special response indicating 2FA is required
      return res.status(200).json({ 
        msg: '2FA required', 
        twoFactorRequired: true,
        userId: user.id
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ msg: 'Email not verified' });
    }

    logger.info({ action: 'login', userId: user.id, email, result: 'success' });

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
    res.json({ accessToken });
  } catch (err) {
    logger.error({ action: 'login', email, error: err.message });
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify user's email address
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ token ]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ msg: 'Token required' });
  try {
    const record = await EmailVerificationToken.findOne({ where: { token } });
    if (!record || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }
    const user = await User.findByPk(record.userId);
    if (!user) return res.status(400).json({ msg: 'Invalid token' });
    user.emailVerified = true;
    await user.save();
    await record.destroy();
    res.json({ msg: 'Email verified' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile and status
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     tokenBalances:
 *                       type: array
 *                     recentUsage:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/me', auth, async (req, res) => {
  try {
    console.log(`[GET /me] Fetching profile for user ID: ${req.user.id}`);

    // Step 1: Fetch user without associations
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      console.log(`[GET /me] User not found for ID: ${req.user.id}`);
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'USER_NOT_FOUND' },
      });
    }
    console.log(`[GET /me] Successfully fetched user: ${user.email}`);

    // Step 2: Fetch token balances separately
    const tokenBalances = await ModelTokenBalance.findAll({
        where: { userId: req.user.id },
        attributes: ['modelId', 'balance', 'updatedAt']
    });
    console.log(`[GET /me] Found ${tokenBalances.length} token balance entries.`);

    // Step 3: Fetch recent usage separately
    const recentUsage = await TokenUsage.findAll({
        where: { userId: req.user.id },
        limit: 5, 
        order: [['createdAt', 'DESC']],
        attributes: ['modelUsed', 'tokensUsed', 'createdAt']
    });
    console.log(`[GET /me] Found ${recentUsage.length} recent usage entries.`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          planStatus: user.planStatus,
          isPaidUser: user.isPaidUser,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        },
        tokenBalances: tokenBalances || [],
        recentUsage: recentUsage || []
      }
    });
  } catch (error) {
    logger.error({
      action: 'get_user_profile',
      userId: req.user.id,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user profile',
        code: 'PROFILE_FETCH_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Get a new access token using a refresh token (HTTP-only cookie)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid or missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    logger.warn({ action: 'refresh-token', result: 'no_token' });
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  try {
    const user = await User.findOne({ where: { refreshToken } });
    if (!user) {
      logger.warn({ action: 'refresh-token', result: 'invalid_token' });
      return res.status(401).json({ error: 'Invalid refresh token' });
      }
    const payload = {
      user: {
        id: user.id,
      },
    };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 900 });
    logger.info({ action: 'refresh-token', userId: user.id, result: 'success' });
    res.json({ accessToken });
  } catch (err) {
    logger.error({ action: 'refresh-token', error: err.message });
    res.status(500).send('Server error');
  }
});

/**
 * @swagger
 * /api/v1/auth/2fa/verify-login:
 *   post:
 *     summary: Verify 2FA token during login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - token
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               token:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful with 2FA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       400:
 *         description: Invalid 2FA token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
// 2FA verification during login
router.post('/2fa/verify-login', async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ msg: '2FA not enabled for this account' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow a small window for time drift
    });

    if (!verified) {
      return res.status(400).json({ msg: 'Invalid 2FA token' });
    }

    // Generate tokens for successful 2FA verification
    const payload = {
      user: {
        id: user.id,
      },
    };

    // Access token (short-lived)
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 900 });
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
    
    logger.info({ action: 'login_2fa', userId: user.id, result: 'success' });
    res.json({ accessToken });
  } catch (err) {
    logger.error({ action: 'login_2fa', error: err.message });
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Log out the user and clear the refresh token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 */
// Logout endpoint
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.cookies;
  let userId = null;
  if (refreshToken) {
    try {
      const user = await User.findOne({ where: { refreshToken } });
      if (user) {
        userId = user.id;
        user.refreshToken = null;
        await user.save();
      }
    } catch (err) {
      // Ignore errors on logout
    }
  }
  logger.info({ action: 'logout', userId, result: 'success' });
  res.clearCookie('refreshToken');
  res.json({ msg: 'Logged out' });
});

// 2FA route handlers
const setup2FA = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Generate a secret key
    const secret = speakeasy.generateSecret({
      name: `ChatBot (${user.email})`,
      issuer: 'ChatBot'
    });

    // Generate QR code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Save the secret to the user (but don't enable 2FA yet)
    user.twoFactorSecret = secret.base32;
    await user.save();

    res.json({
      secret: secret.base32,
      qrCodeUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

const verify2FASetup = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({ msg: '2FA not set up' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow a small window for time drift
    });

    if (!verified) {
      return res.status(400).json({ msg: 'Invalid token' });
    }

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
    }

    // Enable 2FA and save backup codes
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    res.json({
      msg: '2FA successfully enabled',
      backupCodes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

const disable2FA = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = null;
    await user.save();

    res.json({ msg: '2FA successfully disabled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

const getBackupCodes = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(404).json({ msg: '2FA not enabled' });
    }

    res.json({ backupCodes: user.twoFactorBackupCodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

const verifyBackupCode = async (req, res) => {
  try {
    const { email, password, backupCode } = req.body;
    
    // Find user
    let user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ msg: '2FA not enabled for this account' });
    }

    // Verify backup code
    const isValidBackupCode = user.twoFactorBackupCodes && 
                             user.twoFactorBackupCodes.includes(backupCode.toUpperCase());
    
    if (!isValidBackupCode) {
      return res.status(400).json({ msg: 'Invalid backup code' });
    }

    // Remove the used backup code
    user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(
      code => code !== backupCode.toUpperCase()
    );
    await user.save();

    // Generate tokens
    const payload = {
      user: {
        id: user.id,
      },
    };

    // Access token (short-lived)
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 900 });
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
    
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  default: router,
  setup2FA,
  verify2FASetup,
  disable2FA,
  getBackupCodes,
  verifyBackupCode
};
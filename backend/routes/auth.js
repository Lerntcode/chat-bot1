const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ModelTokenBalance = require('../models/ModelTokenBalance');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { logger } = require('../index');

const router = express.Router();

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts from this IP, please try again after a minute.' }
});

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
    });

    // Initialize model-specific token balances for new user
    await ModelTokenBalance.create({
      userId: user.id,
      modelId: 'gpt-4.1-nano',
      balance: 100 // Default tokens for new users
    });

    logger.info({ action: 'register', userId: user.id, email, result: 'success' });

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 3600 },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
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
  loginLimiter,
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn({ action: 'login', email, userId: user.id, result: 'invalid_credentials' });
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    logger.info({ action: 'login', userId: user.id, email, result: 'success' });

    const payload = {
      user: {
        id: user.id,
      },
    };

    // Access token (short-lived)
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 });
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
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 });
    logger.info({ action: 'refresh-token', userId: user.id, result: 'success' });
    res.json({ accessToken });
  } catch (err) {
    logger.error({ action: 'refresh-token', error: err.message });
    res.status(500).send('Server error');
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

module.exports = router;
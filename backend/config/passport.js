const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');
const ModelTokenBalance = require('../models/ModelTokenBalance');
const logger = require('../utils/logger');

/**
 * Google OAuth Strategy Configuration
 * Handles user authentication via Google OAuth 2.0
 * Only initializes when env vars are present to avoid startup failures
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    logger.info({ action: 'google_oauth', googleId: profile.id, email: profile.emails[0].value });
    
    // Check if user already exists with this Google ID
    let user = await User.findOne({ 
      where: { googleId: profile.id } 
    });

    if (user) {
      // User exists, update last login
      user.lastLogin = new Date();
      await user.save();
      logger.info({ action: 'google_oauth', userId: user.id, result: 'existing_user_login' });
      return done(null, user);
    }

    // Check if user exists with same email but different auth method
    const existingUser = await User.findOne({ 
      where: { email: profile.emails[0].value } 
    });

    if (existingUser) {
      // Link Google account to existing user
      existingUser.googleId = profile.id;
      existingUser.emailVerified = true; // Google emails are verified
      existingUser.lastLogin = new Date();
      await existingUser.save();
      logger.info({ action: 'google_oauth', userId: existingUser.id, result: 'linked_existing_user' });
      return done(null, existingUser);
    }

    // Create new user
    const newUser = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      emailVerified: true, // Google emails are verified
      lastLogin: new Date(),
      // No password needed for OAuth users
      password: null
    });

    // Initialize model-specific token balances for new user
    await ModelTokenBalance.create({
      userId: newUser.id,
      modelId: 'gpt-4.1-nano',
      balance: 100 // Default tokens for new users
    });

    logger.info({ action: 'google_oauth', userId: newUser.id, result: 'new_user_created' });
    return done(null, newUser);

  } catch (error) {
    logger.error({ action: 'google_oauth', error: error.message });
    return done(error, null);
  }
}));
} else {
  logger.warn({ action: 'google_oauth_disabled', reason: 'Missing GOOGLE_CLIENT_ID/SECRET' });
}

/**
 * JWT Strategy Configuration
 * Handles JWT token validation for protected routes
 */
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await User.findByPk(payload.user.id);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    logger.error({ action: 'jwt_validation', error: error.message });
    return done(error, false);
  }
}));

/**
 * Serialize user for session (if using sessions)
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session (if using sessions)
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

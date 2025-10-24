const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function parseNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseBool(value, fallback = false) {
  if (value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const CORS_ORIGINS = process.env.CORS_ORIGINS || (IS_PROD ? '' : 'http://localhost:3000');

// Security Configuration
const BLOCKED_IPS = process.env.BLOCKED_IPS || '';
const SECURITY_HEADERS = parseBool(process.env.SECURITY_HEADERS, true);
const RATE_LIMITING = parseBool(process.env.RATE_LIMITING, true);
const FILE_SCANNING = parseBool(process.env.FILE_SCANNING, true);
const SESSION_TIMEOUT = parseNumber(process.env.SESSION_TIMEOUT, 24 * 60 * 60 * 1000); // 24 hours
const MAX_LOGIN_ATTEMPTS = parseNumber(process.env.MAX_LOGIN_ATTEMPTS, 5);
const LOGIN_LOCKOUT_DURATION = parseNumber(process.env.LOGIN_LOCKOUT_DURATION, 15 * 60 * 1000); // 15 minutes

const DB_NAME = process.env.DB_NAME || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_POOL_MAX = parseNumber(process.env.DB_POOL_MAX, 10);
const DB_POOL_MIN = parseNumber(process.env.DB_POOL_MIN, 0);
const DB_POOL_ACQUIRE = parseNumber(process.env.DB_POOL_ACQUIRE, 30000);
const DB_POOL_IDLE = parseNumber(process.env.DB_POOL_IDLE, 10000);
const ALLOW_DB_SYNC = parseBool(process.env.ALLOW_DB_SYNC, NODE_ENV !== 'production');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const QWEN_API_KEY = process.env.QWEN_API_KEY;
// Support both uppercase and lowercase key names for convenience
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.google_api;
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || process.env.gemini_flash_model;

const JWT_SECRET = process.env.JWT_SECRET || '';
const REDIS_URL = process.env.REDIS_URL || '';

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

function validateEnv() {
  const missing = [];
  for (const [name, val] of Object.entries({ DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, JWT_SECRET })) {
    if (!val) missing.push(name);
  }

  if (IS_PROD) {
    if (missing.length > 0) {
      throw new Error(`Missing required env vars in production: ${missing.join(', ')}`);
    }
    if (!OPENAI_API_KEY && !TOGETHER_API_KEY && !QWEN_API_KEY && !GOOGLE_API_KEY) {
      throw new Error('At least one AI provider key must be set (OPENAI_API_KEY, TOGETHER_API_KEY, QWEN_API_KEY, or GOOGLE_API_KEY)');
    }
    if (!CORS_ORIGINS) {
      throw new Error('CORS_ORIGINS must be set in production to a comma-separated allowlist');
    }
  }
}

validateEnv();

module.exports = {
  NODE_ENV,
  IS_PROD,
  CORS_ORIGINS,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_POOL_MAX,
  DB_POOL_MIN,
  DB_POOL_ACQUIRE,
  DB_POOL_IDLE,
  ALLOW_DB_SYNC,
  OPENAI_API_KEY,
  TOGETHER_API_KEY,
  QWEN_API_KEY,
  GOOGLE_API_KEY,
  GEMINI_FLASH_MODEL,
  JWT_SECRET,
  REDIS_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  FRONTEND_URL,
  
  // Security Configuration
  BLOCKED_IPS,
  SECURITY_HEADERS,
  RATE_LIMITING,
  FILE_SCANNING,
  SESSION_TIMEOUT,
  MAX_LOGIN_ATTEMPTS,
  LOGIN_LOCKOUT_DURATION,
};

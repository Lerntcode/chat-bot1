require('./models/associations');
const env = require('./config/env');
const express = require('express');
const cors = require('cors');
const hpp = require('hpp');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { Sequelize, Op } = require('sequelize');
const { sequelize, connectDB } = require('./config/database');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Memory = require('./models/Memory');
const User = require('./models/User');
const TokenUsage = require('./models/TokenUsage');
const AdView = require('./models/AdView');
const ModelTokenBalance = require('./models/ModelTokenBalance');
const RefreshToken = require('./models/RefreshToken');
const Payment = require('./models/Payment');
const FileUpload = require('./models/FileUpload');
const TogetherAI = require('together-ai');
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const validate = require('./middleware/validate');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const winston = require('winston');
const FileProcessor = require('./utils/fileProcessor');
const helmet = require('helmet');
const cache = require('./utils/cache');
const requestLogger = require('./middleware/requestLogger');
const createLengthLimiter = require('./middleware/lengthLimiter');
const auth = require('./middleware/auth');
const { estimateTokenCount } = require('./utils/tokenizer');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');
const FileType = require('file-type');
const logger = require('./utils/logger');

// Error handling middleware
const { errorHandler, asyncHandler, notFoundHandler, maintenanceHandler } = require('./middleware/errorHandler');

// Security middleware
const {
  createRateLimiters,
  createSpeedLimiters,
  createCorsOptions,
  createHelmetConfig,
  validateRequest,
  ipFilter,
  requestSizeLimit,
  securityHeaders,
  securityLogging
} = require('./middleware/security');

// Enhanced validation middleware
const {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  validateRateLimit
} = require('./middleware/validation');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chatbot API',
      version: '1.0.0',
      description: 'API documentation for the Chatbot web app',
    },
    servers: [
      { url: 'http://localhost:5000/api/v1' }
    ],
  },
  apis: ['./routes/*.js', './index.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const port = 5000;

// Database initialization
const { setupAssociations } = require('./database/init-db');

// XSS Sanitization middleware
const sanitizeInput = require('./middleware/xssSanitizer');

// --- Model Configuration ---
const MODEL_CONFIG = {
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Smartest model for complex tasks',
    baseTokenCost: 200, // Average tokens per message
    available: true // Will work when you get GPT API
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini', 
    name: 'GPT-4.1 Mini',
    description: 'Affordable model balancing speed and intelligence',
    baseTokenCost: 100, // Average tokens per message
    available: true // Will work when you get GPT API
  },
  'gpt-4.1-nano': {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano', 
    description: 'Fastest for low-latency tasks (Powered by Mixtral)',
    baseTokenCost: 20, // Average tokens per message
    available: true // Uses TogetherAI Mixtral
  }
};

// --- Ad Reward Configuration ---
const AD_REWARDS = {
  'gpt-4.1': 500,      // ~2-3 messages worth
  'gpt-4.1-mini': 2000, // ~20 messages worth
  'gpt-4.1-nano': 10000 // ~500 messages worth
};

const OpenAI = require('openai');
const axios = require('axios');
const { createStream, createCompletion, MODEL_API_MAPPING } = require('./services/llmProvider');

// --- TogetherAI Setup ---
const together = env.TOGETHER_API_KEY ? new TogetherAI({ apiKey: env.TOGETHER_API_KEY }) : null;

// --- OpenAI Setup ---
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// --- Qwen Setup ---
const qwenClient = axios.create({
  baseURL: 'https://api.studio.nebius.ai/v1',
  headers: Object.assign(
    { 'Content-Type': 'application/json' },
    env.QWEN_API_KEY ? { 'Authorization': `Bearer ${env.QWEN_API_KEY}` } : {}
  )
});



// --- Model Token Balance Helper Functions ---
async function getModelTokenBalance(userId, modelId) {
  const balance = await ModelTokenBalance.findOne({
    where: { userId, modelId }
  });
  return balance ? balance.balance : 0;
}

async function updateModelTokenBalance(userId, modelId, amount) {
  const [balance, created] = await ModelTokenBalance.findOrCreate({
    where: { userId, modelId },
    defaults: { balance: 0 }
  });
  
  balance.balance += amount;
  await balance.save();
  return balance.balance;
}

async function getAllModelTokenBalances(userId) {
  const balances = await ModelTokenBalance.findAll({
    where: { userId }
  });
  
  const balanceMap = {};
  balances.forEach(balance => {
    balanceMap[balance.modelId] = balance.balance;
  });
  
  return balanceMap;
}

async function initializeUserTokenBalances(userId) {
  // Initialize default tokens for new users (100 tokens for nano model)
  await updateModelTokenBalance(userId, 'gpt-4.1-nano', 100);
}

// --- Multer Setup ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const allowedExts = new Set(['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.bmp']);
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.has(ext)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  },
});

// CORS (centralized options)
app.use(cors(createCorsOptions()));
/* Previous inline helmet kept for reference
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        'https://fonts.googleapis.com', 
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net'
      ],
      scriptSrc: [
        "'self'", 
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net'
      ],
      fontSrc: [
        "'self'", 
        'https://fonts.gstatic.com', 
        'https://cdnjs.cloudflare.com', 
        'https://cdn.jsdelivr.net',
        'data:'
      ],
      imgSrc: [
        "'self'", 
        'data:', 
        'https://cdn.jsdelivr.net',
        'http://localhost:3000',
        'http://localhost:5000'
      ],
      connectSrc: [
        "'self'", 
        'http://localhost:3000', 
        'http://localhost:5000',
        'https://api.studio.nebius.ai',
        'https://api.together.xyz'
      ],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
    reportOnly: false,
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  frameguard: {
    action: 'deny'
  },
  dnsPrefetchControl: {
    allow: false
  },
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },
  hidePoweredBy: true,
  noSniff: true,
  ieNoOpen: true,
  xssFilter: true
}));
*/
// Disable compression for SSE endpoints; enable globally otherwise
app.use((req, res, next) => {
  if (req.path === '/api/v1/chat') return next();
  return compression()(req, res, next);
});
// Limit raw JSON body size early
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());
app.use(sanitizeInput); // XSS sanitization middleware
app.use(createLengthLimiter()); // Input length limits
app.use(requestLogger); // API request logging with requestId
app.use(metricsMiddleware); // Prometheus metrics
// Global rate limiter for all routes (optionally backed by Redis in prod)
let globalLimiter;
try {
  if (env.REDIS_URL) {
    const { RateLimitRedisStore } = require('rate-limit-redis');
    const redis = require('redis');
    const redisClient = redis.createClient({ url: env.REDIS_URL });
    redisClient.on('error', (e) => console.error('RateLimit Redis error', e));
    redisClient.connect();
    globalLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RateLimitRedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })
    });
  }
} catch (e) {
  console.warn('Falling back to in-memory rate limiting:', e.message);
}
app.use(globalLimiter || rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Chatbot API Docs' }));
app.get('/metrics', metricsHandler);

// Note: Global error handler is imported from middleware; ensure only one definition exists

// Create enhanced rate limiters
const { apiLimiter, authLimiter, uploadLimiter } = createRateLimiters();
const { speedLimiter } = createSpeedLimiters();

// Stricter per-user rate limiter for chat (Redis-backed if configured)
let chatLimiter;
try {
  if (env.REDIS_URL) {
    const { RateLimitRedisStore } = require('rate-limit-redis');
    const redis = require('redis');
    const redisClient = redis.createClient({ url: env.REDIS_URL });
    redisClient.on('error', (e) => console.error('Chat RateLimit Redis error', e));
    redisClient.connect();
    chatLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: (req, res) => (req.user?.isPaidUser ? 60 : 30),
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      message: { error: 'Too many chat requests, please slow down.' },
      store: new RateLimitRedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })
    });
  }
} catch (e) {
  console.warn('Falling back to in-memory chat limiter:', e.message);
}
chatLimiter = chatLimiter || rateLimit({
  windowMs: 60 * 1000,
  max: (req, res) => (req.user?.isPaidUser ? 60 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many chat requests, please slow down.' },
});

// Apply security middleware
app.use(hpp()); // HTTP Parameter Pollution protection

// Apply rate limiting and speed limiting
app.use(apiLimiter);
app.use(speedLimiter);

// Apply security headers and logging
app.use(securityHeaders);
app.use(securityLogging);

// Apply input sanitization
app.use(sanitizeBody);
app.use(sanitizeQuery);
app.use(sanitizeParams);

// Apply IP filtering and request validation
app.use(ipFilter);
app.use(validateRequest);
app.use(requestSizeLimit);

// Passport configuration
const passport = require('./config/passport');
app.use(passport.initialize());

// API Endpoints
const authRoutes = require('./routes/auth');
const googleAuthRoutes = require('./routes/googleAuth');
const logsRoutes = require('./routes/logs');
const securityRoutes = require('./routes/security');
// Temporarily disabled auth rate limiting for testing
// app.use('/api/v1/auth', authLimiter, authRoutes.default);
app.use('/api/v1/auth', authRoutes.default);
app.use('/api/v1/auth', googleAuthRoutes);
app.use('/api/v1/logs', logsRoutes);
app.use('/api/v1/security', securityRoutes);

// Apply upload rate limiting to file upload endpoints
app.use('/api/v1/upload', uploadLimiter);
// Memory routes (GET/POST)
const memoryRoutes = require('./routes/memory');
app.use('/api/v1/memory', memoryRoutes);
// Expose 2FA management endpoints
app.post('/api/v1/auth/2fa/setup', auth, authRoutes.setup2FA);
app.post('/api/v1/auth/2fa/verify-setup', auth, authRoutes.verify2FASetup);
app.post('/api/v1/auth/2fa/disable', auth, authRoutes.disable2FA);
app.get('/api/v1/auth/2fa/backup-codes', auth, authRoutes.getBackupCodes);
app.post('/api/v1/auth/2fa/verify-backup', authRoutes.verifyBackupCode);

// Health check endpoint (ensure single definition)
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});





// --- API Endpoints ---

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: Send a message to the chatbot
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: What is the weather today?
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Chatbot response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversationId:
 *                   type: string
 *                 message:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: string
 *                     bot:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     thoughtProcess:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       403:
 *         description: Insufficient tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       429:
 *         description: Too many chat requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
const technicalQuestionDetector = require('./middleware/technicalQuestionDetector');

app.post(
  '/api/v1/chat',
  chatLimiter,
  auth,
  upload.single('file'),
  // Basic validation for message and optional query model
  body('message').isString().trim().isLength({ min: 1, max: 8000 }).withMessage('message must be 1-8000 chars'),
  query('model').optional().isIn(['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1']).withMessage('invalid model'),
  validate,
  technicalQuestionDetector,
  async (req, res, next) => {
  let clientClosed = false;
  res.on('close', () => { clientClosed = true; });
  // --- Pre-computation and Validation ---
  const { message, conversationId: initialConversationId } = req.body;
  const userId = req.user.id;
  const selectedModel = req.query.model || 'gpt-4.1-nano';
  const modelConfig = MODEL_CONFIG[selectedModel];

  if (!modelConfig) {
    return res.status(400).json({ error: `Unsupported model: ${selectedModel}` });
  }

  // Basic request validation
  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  logger.info({ action: 'chat_request', userId, conversationId: initialConversationId, message, model: selectedModel });

  async function shouldRemember(message) {
    // Heuristic explicit checks first
    const lower = (message || '').toLowerCase();
    const isExplicit = /\b(remember|save this|store this|keep this)\b/.test(lower);
    if (isExplicit) return { should: true, isExplicit: true };

    // If TogetherAI is unavailable, use lightweight heuristics
    if (!together) {
      const heuristics = [
        /\bmy name is\b/i,
        /\bcall me\b/i,
        /\bemail\b[:\s]/i,
        /\bphone\b[:\s]/i,
        /\b(i|we)\s+prefer\b/i,
        /\btimezone\b|\btime zone\b/i,
        /\bbirthday\b|\bdob\b/i
      ];
      const should = heuristics.some(rx => rx.test(message));
      return { should, isExplicit: false };
    }

    // AI judgment call via TogetherAI
    try {
      const judgmentPrompt = `Does the following message contain a useful fact worth remembering for future conversations? Answer with only YES or NO. Message: "${message}"`;
      const response = await withTimeout(
        together.chat.completions.create({
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
          messages: [{ role: "user", content: judgmentPrompt }],
          max_tokens: 2,
        }),
        10000,
        'The AI took too long to decide if this should be remembered.',
        'Memory Judgment'
      );
      const decision = response.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim().toUpperCase();
      return { should: decision === "YES", isExplicit: false };
    } catch (error) {
      logger.error({ action: 'llm_memory_judgment', userId: req.user.id, error: error.message, isTimeout: error.isTimeout });
      // Fall back to heuristics on error
      const heuristics = [
        /\bmy name is\b/i,
        /\bcall me\b/i,
        /\bemail\b[:\s]/i,
        /\bphone\b[:\s]/i,
        /\b(i|we)\s+prefer\b/i,
        /\btimezone\b|\btime zone\b/i,
        /\bbirthday\b|\bdob\b/i
      ];
      const should = heuristics.some(rx => rx.test(message));
      return { should, isExplicit: false };
    }
  };

  // Simple memory categorization and expiration helpers
  function categorizeMemory(text) {
    const t = text.toLowerCase();
    if (t.includes('email') || t.includes('@')) return 'contact';
    if (t.includes('birthday') || t.includes('anniversary')) return 'personal';
    if (t.includes('meeting') || t.includes('call') || t.includes('schedule')) return 'schedule';
    if (t.includes('project') || t.includes('task') || t.includes('deadline')) return 'work';
    return 'general';
  }
  function getExpiryForCategory(category) {
    const now = new Date();
    const map = {
      schedule: 7,      // 7 days
      work: 30,         // 30 days
      personal: 180,    // 6 months
      contact: 365,     // 1 year
      general: 90       // 90 days
    };
    const days = map[category] ?? 90;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // Stream-safe filter to remove internal reasoning before sending to client
  let _inHiddenReasoningBlock = false; // persists for this request scope
  let _filterBuffer = '';
  function filterReasoningDelta(input) {
    if (!input) return '';
    _filterBuffer += input;
    let output = '';
    while (true) {
      if (_inHiddenReasoningBlock) {
        const closeIdx = _filterBuffer.indexOf('</think>');
        if (closeIdx === -1) {
          // Still inside hidden block; consume all and wait for closing tag in future chunks
          _filterBuffer = '';
          return output;
        }
        // Drop everything up to and including closing tag
        _filterBuffer = _filterBuffer.slice(closeIdx + 8);
        _inHiddenReasoningBlock = false;
        continue;
      }
      const openIdx = _filterBuffer.indexOf('<think>');
      if (openIdx === -1) {
        // No hidden block markers; emit all we have
        output += _filterBuffer;
        _filterBuffer = '';
        break;
      }
      // Emit content before opening tag, then enter hidden block
      output += _filterBuffer.slice(0, openIdx);
      _filterBuffer = _filterBuffer.slice(openIdx + 7);
      _inHiddenReasoningBlock = true;
    }
    // Additional conservative cleanup: remove typical reasoning lead-ins per line
    const reasoningPatterns = [
      /^\s*(okay,?\s*)?(let me|i (need|should|will|am going to|think)|thinking|step by step|first,|second,|third,|next,)/i,
      /^\s*(here's my plan|i'll start by|i will start by|let's|lets|we (should|need to))/i
    ];
    output = output
      .split(/(\r?\n)/)
      .map(seg => {
        if (seg === '\n' || seg === '\r\n') return seg;
        const line = seg;
        return reasoningPatterns.some(rx => rx.test(line)) ? '' : line;
      })
      .join('');
    return output;
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPaidAndActive = user.isPaidUser && user.paidUntil && new Date(user.paidUntil) > new Date();

    if (!isPaidAndActive) {
      const modelTokenBalance = await getModelTokenBalance(userId, selectedModel);
      if (modelTokenBalance < modelConfig.baseTokenCost) {
        return res.status(403).json({ error: `Insufficient ${modelConfig.name} tokens. This message costs at least ${modelConfig.baseTokenCost} tokens. You have ${modelTokenBalance} ${modelConfig.name} tokens.` });
      }
    }

    // --- Conversation and Message Processing ---
    let conversation = initialConversationId
      ? await Conversation.findByPk(initialConversationId, { include: [{ model: Message, as: 'Messages' }] })
      : await Conversation.create({ title: 'New Chat', lastMessageTimestamp: new Date(), userId });

    // Note: do not write to response before SSE headers are set.
      
    let userMessage = message;
    let fileInfo = null;
    // File validation and processing
      if (req.file) {
      try {
        // Per-tier file size limits
        const stats = fs.statSync(req.file.path);
        const maxSizeBytes = (req.user?.isPaidUser ? 10 : 2) * 1024 * 1024; // 10MB vs 2MB
        if (stats.size > maxSizeBytes) {
          fs.unlinkSync(req.file.path);
          return res.status(413).json({ error: 'Uploaded file too large for your plan.' });
        }

        // Magic number sniffing
        const detected = await FileType.fromFile(req.file.path);
        const ext = path.extname(req.file.originalname).toLowerCase();
        const mimeOk = (
          (['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext) && detected && detected.mime.startsWith('image/')) ||
          (ext === '.pdf' && detected && detected.mime === 'application/pdf') ||
          (['.doc', '.docx'].includes(ext)) ||
          (ext === '.txt' && (!detected || detected.mime.startsWith('text/')))
        );
        if (!mimeOk) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'File content type does not match allowed formats.' });
        }
        const fileProcessor = new FileProcessor();
        const result = await fileProcessor.processFile(req.file.path, req.file.originalname);
        
        if (result.success) {
          const fileContent = result.content;
          fileInfo = {
            fileName: result.fileName,
            fileType: result.fileType,
            wordCount: result.wordCount,
            summary: fileProcessor.getFileSummary(result.content)
          };
          userMessage += `\n\n📎 File attached: ${result.fileName} (${result.fileType}, ${result.wordCount} words)`;
          if (!message.trim()) {
            userMessage = `Please analyze this ${result.fileType} file: ${result.fileName}\n\nFile content:\n${fileContent}`;
          } else {
            userMessage += `\n\nFile content:\n${fileContent}`;
          }
        } else {
          userMessage += `\n\n❌ Failed to process file: ${result.error}`;
        }
      } catch (error) {
        userMessage += `\n\n❌ Error processing file: ${error.message}`;
      }
    }
      
    // Save user message first
    await Message.create({ user: userMessage, conversationId: conversation.id, timestamp: new Date().toISOString() });

    const memoryCheck = await shouldRemember(userMessage);

    let botResponseText = '';
    if (memoryCheck.should) {
      let memoryToSave;

      if (memoryCheck.isExplicit) {
        memoryToSave = userMessage.toLowerCase().includes("remember:") 
          ? userMessage.substring(userMessage.toLowerCase().indexOf("remember:") + 9).trim() 
          : userMessage.substring(userMessage.toLowerCase().indexOf("remember") + 8).trim();
        botResponseText = `OK, I'll remember that: "${memoryToSave}"`;
      } else {
        memoryToSave = userMessage; // Save the whole message as it was deemed important
        botResponseText = `(Noted: "${memoryToSave}")`; // A more subtle confirmation
      }
      
      if (memoryToSave) {
          const category = categorizeMemory(memoryToSave);
          const expiresAt = getExpiryForCategory(category);
          await Memory.create({ text: memoryToSave, category, expiresAt, timestamp: new Date().toISOString(), userId: req.user.id });

          // Invalidate memory cache
          await cache.del(`memory:${req.user.id}`);

          // Opportunistic cleanup of expired memories
          try { await Memory.destroy({ where: { userId: req.user.id, expiresAt: { [Op.lt]: new Date() } } }); } catch (_) {}
      }

      // If it was an explicit command, we can just send the confirmation and stop.
      if (memoryCheck.isExplicit) {
          const botResponse = {
              user: userMessage,
              bot: botResponseText,
              timestamp: new Date().toISOString()
          };
          const friendlyLabel = (m => {
            if (m === 'gpt-4.1-nano') {
              return process.env.GEMINI_FLASH_MODEL?.includes('2.5') ? 'Gemini 2.5 Flash' : 'Gemini Flash';
            }
            if (m === 'gpt-4.1-mini') return 'Qwen 30B A3B';
            if (m === 'gpt-4.1') return 'Qwen 235B A22B';
            return m;
          })(selectedModel);
          await Message.create({ ...botResponse, conversationId: conversation.id, modelUsed: selectedModel, metadata: { ...(botResponse.metadata||{}), modelLabel: friendlyLabel } });
          await conversation.update({ lastMessageTimestamp: new Date() });
          res.json({ conversationId: conversation.id, message: botResponse });
          return;
      }
      // If it was an implicit "remember", we still need to get a proper chat response.
      // We'll prepend a subtle confirmation before streaming begins.
    }

    // --- AI Stream Generation ---
    const systemMessage = {
      role: "system",
      content: "You are a helpful AI assistant. Use any provided 'memory' context to personalize responses. Do not claim you lack memory; if the user shares a fact to remember, acknowledge it briefly (e.g., 'Noted') and use it later. Provide direct answers without exposing internal reasoning. Avoid prefacing with 'Answer:' or 'Response:'."
    };
    
    // Get conversation history
    const conversationHistory = (conversation.Messages || []).flatMap(msg => [
      ...(msg.user ? [{ role: "user", content: msg.user }] : []),
      ...(msg.bot ? [{ role: "assistant", content: msg.bot }] : [])
    ]);
    
    // Parse optional memory hints coming from the frontend (stringified JSON array)
    let memoryHints = [];
    try {
      if (req.body.memoryHints) {
        const parsed = JSON.parse(req.body.memoryHints);
        if (Array.isArray(parsed)) memoryHints = parsed.filter(Boolean).slice(0, 8);
      }
    } catch (_) {}

    // Fallback: if no hints provided, pull a few recent memories from DB/cache
    if (memoryHints.length === 0) {
      try {
        const cacheKey = `memory:${req.user.id}`;
        const cached = await cache.get(cacheKey);
        const mems = cached || (await Memory.findAll({
          where: { userId: req.user.id, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] },
          order: [['timestamp', 'DESC']],
          limit: 5,
        }));
        if (!cached) await cache.set(cacheKey, mems, 30);
        memoryHints = (mems || []).map(m => m.text).filter(Boolean);
      } catch (_) {}
    }

    // Build a memory context system message if hints provided
    const memorySystemMsg = memoryHints.length
      ? { role: "system", content: `Relevant user memory (use respectfully and privately, do not ask the user to repeat):\n- ${memoryHints.join("\n- ")}` }
      : null;

    // Combine system message with optional memory hints, conversation history and current message
    const messagesForAI = [
      systemMessage,
      ...(memorySystemMsg ? [memorySystemMsg] : []),
      ...conversationHistory,
      { role: "user", content: userMessage }
    ];

    // Create provider stream BEFORE sending SSE headers so we can return JSON on error
    let stream;
    try {
      stream = await createStream({ model: selectedModel, messages: messagesForAI });
    } catch (err) {
      logger.error({ action: 'chat_stream_error', userId, error: err?.message || String(err) });
      return res.status(502).json({ error: `Upstream model error: ${err?.message || 'unknown'}` });
    }

    // --- Prepare for Streaming (after stream created) ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // After headers are set, send the new conversationId once
    if (!initialConversationId) {
      try {
        res.write(`data: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);
      } catch (_) {}
    }

    const heartbeat = setInterval(() => {
      if (!res.headersSent) {
        res.flushHeaders?.();
      }
      if (!res.writableEnded) {
        res.write('event: ping\n');
        res.write(`data: ${Date.now()}\n\n`);
      }
    }, 15000);
    try {
      // If we saved memory implicitly earlier, send a subtle confirmation prefix
      if (memoryCheck.should && !memoryCheck.isExplicit) {
        const prefix = `(Noted) `;
        botResponseText += prefix;
        try { res.write(`data: ${JSON.stringify({ chunk: prefix })}\n\n`); } catch(_) {}
      }
      for await (const chunk of stream) {
        if (clientClosed) break;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          const filtered = filterReasoningDelta(content);
          if (filtered) {
            botResponseText += filtered;
            res.write(`data: ${JSON.stringify({ chunk: filtered })}\n\n`);
          }
        }
      }
    } catch (streamErr) {
      logger.error({ action: 'chat_stream_error', userId, error: streamErr?.message || String(streamErr) });
      if (!res.writableEnded) {
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ error: streamErr?.message || 'Streaming failed' })}\n\n`);
      }
    }
    clearInterval(heartbeat);
    
    // --- Post-Streaming Database Operations ---
    if (!isPaidAndActive) {
        const totalTokens = estimateTokenCount(userMessage) + estimateTokenCount(botResponseText);
        const tokensToDeduct = Math.max(totalTokens, modelConfig.baseTokenCost);
        await updateModelTokenBalance(userId, selectedModel, -tokensToDeduct);
        await TokenUsage.create({ userId, tokensUsed: tokensToDeduct, modelUsed: selectedModel });
        await cache.del(`user-status:${userId}`);
    }

    const friendlyLabel2 = (m => {
      if (m === 'gpt-4.1-nano') {
        return process.env.GEMINI_FLASH_MODEL?.includes('2.5') ? 'Gemini 2.5 Flash' : 'Gemini Flash';
      }
      if (m === 'gpt-4.1-mini') return 'Qwen 30B A3B';
      if (m === 'gpt-4.1') return 'Qwen 235B A22B';
      return m;
    })(selectedModel);
    await Message.create({ bot: botResponseText, conversationId: conversation.id, timestamp: new Date().toISOString(), fileInfo, modelUsed: selectedModel, metadata: { ...(fileInfo?.metadata||{}), modelLabel: friendlyLabel2 } });
    await conversation.update({ 
        lastMessageTimestamp: new Date(), 
        title: conversation.title === 'New Chat' ? userMessage.substring(0, 30) + '...' : conversation.title 
    });
    await cache.del(`conversations:${userId}`);

    logger.info({ action: 'chat_stream_success', userId, conversationId: conversation.id });
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error({ action: 'chat_stream_error', userId: req.user.id, error: error.message });
    // If headers are not yet sent, send a proper error response
    if (!res.headersSent) {
        res.status(500).json({ error: 'An internal error occurred.' });
    } else {
        // If stream has started, write an error chunk and end
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);        res.write('data: [DONE]\n\n');

        res.end();
    }
  }
});

/**
 * @swagger
 * /api/v1/conversations:
 *   get:
 *     summary: Get all conversations for the authenticated user
 *     tags: [Conversations]
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   lastMessageTimestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Get conversations (metadata) with optional pagination
app.get('/api/v1/conversations', auth, async (req, res, next) => {
  console.log('Fetching conversations for user:', req.user.id);
  try {
    const page = req.query.page ? Math.max(parseInt(req.query.page, 10) || 1, 1) : null;
    const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100) : null;

    const cacheKey = page && limit
      ? `conversations:${req.user.id}:p=${page}:l=${limit}`
      : `conversations:${req.user.id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached conversations for user:', req.user.id);
      return res.json(cached);
    }
    console.log('No cache found, querying database for conversations for user:', req.user.id);

    if (page && limit) {
      const offset = (page - 1) * limit;
      const { rows, count } = await Conversation.findAndCountAll({
        attributes: ['id', 'title', 'lastMessageTimestamp'],
        where: { userId: req.user.id },
        order: [['lastMessageTimestamp', 'DESC']],
        limit,
        offset,
      });
      const totalPages = Math.ceil(count / limit) || 1;
      const payload = { items: rows, pagination: { page, limit, total: count, totalPages } };
      await cache.set(cacheKey, payload, 30);
      console.log(`Found and cached ${rows.length} conversations for user:`, req.user.id);
      return res.json(payload);
    }

    const conversations = await Conversation.findAll({
      attributes: ['id', 'title', 'lastMessageTimestamp'],
      where: { userId: req.user.id },
      order: [['lastMessageTimestamp', 'DESC']],
    });
    await cache.set(cacheKey, conversations, 30);
    console.log(`Found and cached ${conversations.length} conversations for user:`, req.user.id);
    return res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations from database for user:', req.user.id, error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/conversations/{id}:
 *   get:
 *     summary: Get a specific conversation by ID
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 lastMessageTimestamp:
 *                   type: string
 *                   format: date-time
 *                 Messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: string
 *                       bot:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Get a specific conversation
app.get('/api/v1/conversations/:id', auth, param('id').isUUID().withMessage('invalid id'), validate, async (req, res, next) => {
  try {
    console.log('Fetching conversation:', req.params.id, 'for user:', req.user.id);
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{ model: Message, as: 'Messages' }],
      order: [[{ model: Message, as: 'Messages' }, 'timestamp', 'ASC']],
    });
    console.log('Found conversation:', conversation ? conversation.id : 'null');
    console.log('Messages count:', conversation?.Messages?.length || 0);
    if (conversation) {
      res.json(conversation);
    } else {
      const err = new Error('Conversation not found');
      err.status = 404;
      next(err);
    }
  } catch (error) {
    console.error('Sequelize error in /api/v1/conversations/:id:', error);
    next(error);
  }
});

// Delete a specific conversation
app.delete('/api/v1/conversations/:id', auth, param('id').isUUID().withMessage('invalid id'), validate, async (req, res, next) => {
  try {
    const deleted = await Conversation.destroy({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (deleted) {
      res.status(204).send(); // No Content
    } else {
      const err = new Error('Conversation not found');
      err.status = 404;
      next(err);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/conversations/{id}/summarize:
 *   post:
 *     summary: Summarize a specific conversation by ID
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: string
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Server error or AI summarization error
 */
app.post('/api/v1/conversations/:id/summarize', auth, param('id').isUUID().withMessage('invalid id'), validate, async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{ model: Message, as: 'Messages' }],
      order: [[{ model: Message, as: 'Messages' }, 'timestamp', 'ASC']],
    });

    if (!conversation) {
      const err = new Error('Conversation not found');
      err.status = 404;
      next(err);
      return;
    }

    if (!conversation.Messages || conversation.Messages.length === 0) {
      return res.json({ summary: 'This conversation has no messages to summarize.' });
    }

    const messagesForAI = conversation.Messages.map(msg => {
      if (msg.role === 'user') return `User: ${msg.content}`;
      if (msg.role === 'bot') return `Bot: ${msg.content}`;
      return ''; // Ignore system messages for summarization
    }).filter(Boolean).join('\n');

    const prompt = `Please summarize the following conversation:

${messagesForAI}

Summary:`;

    const response = await withTimeout(
      together.chat.completions.create({
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1", // Using Mixtral for summarization
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500, // Limit summary length
      }),
      30000, // 30 seconds timeout
      "AI summarization took too long to respond.",
      'Conversation Summarization'
    );

    const summary = response.choices[0].message.content;

    res.json({ summary });

  } catch (error) {
    console.error('Error summarizing conversation:', error);
    next(error);
  }
});

// Get all memories


/**
 * @swagger
 * /api/v1/memory:
 *   get:
 *     summary: Get all memory entries for the authenticated user
 *     tags: [Memory]
 *     responses:
 *       200:
 *         description: List of memory entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   text:
 *                     type: string
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Get all memories
app.get('/api/v1/memory', auth, async (req, res, next) => {
  try {
    // Try to get from cache first
    const includeExpired = req.query.includeExpired === 'true';
    const cacheKey = `memory:${req.user.id}:includeExpired=${includeExpired}`;
    let cachedMemory = await cache.get(cacheKey);
    
    if (cachedMemory) {
      return res.json(cachedMemory);
    }

    const where = includeExpired
      ? { userId: req.user.id }
      : { userId: req.user.id, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] };
    const memories = await Memory.findAll({ where, order: [['timestamp', 'DESC']] });
    
    // Cache the result for 30 seconds
    await cache.set(cacheKey, memories, 30);
    
    res.json(memories);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/memory/{id}:
 *   put:
 *     summary: Update a memory entry
 *     tags: [Memory]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Memory ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 example: Remember to buy milk
 *     responses:
 *       200:
 *         description: Updated memory entry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 text:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *   delete:
 *     summary: Delete a memory entry
 *     tags: [Memory]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Memory ID
 *     responses:
 *       204:
 *         description: Memory deleted
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Update a memory
app.put('/api/v1/memory/:id', auth, [
  param('id').isUUID().withMessage('invalid id'),
  body('text').optional().isString().trim().isLength({ min: 1, max: 10000 }).withMessage('text max 10k chars'),
  body('category').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('invalid category'),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be ISO date'),
], validate, async (req, res, next) => {
  const { text, category, expiresAt } = req.body;
  try {
    const memory = await Memory.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (memory) {
      if (typeof text === 'string') memory.text = text;
      if (typeof category === 'string') memory.category = category;
      if (typeof expiresAt === 'string') memory.expiresAt = new Date(expiresAt);
      await memory.save();
      
      // Invalidate memory cache
      await Promise.all([
        cache.del(`memory:${req.user.id}:includeExpired=true`),
        cache.del(`memory:${req.user.id}:includeExpired=false`)
      ]);
      
      res.json(memory);
    } else {
      const err = new Error('Memory not found');
      err.status = 404;
      next(err);
    }
  } catch (error) {
    next(error);
  }
});

// Delete a memory
app.delete('/api/v1/memory/:id', auth, param('id').isUUID().withMessage('invalid id'), validate, async (req, res, next) => {
  try {
    const deleted = await Memory.destroy({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (deleted) {
      // Invalidate memory cache
      await cache.del(`memory:${req.user.id}`);
      
      res.status(204).send(); // No Content
    } else {
      const err = new Error('Memory not found');
      err.status = 404;
      next(err);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/ad-view:
 *   post:
 *     summary: Record an ad view and grant tokens
 *     tags: [Monetization]
 *     responses:
 *       200:
 *         description: Tokens granted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 newBalance:
 *                   type: integer
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 */
// Endpoint to record ad view and grant tokens
app.post('/api/v1/ad-view', auth, body('preferredModel').optional().isIn(['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1']).withMessage('invalid model'), validate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      next(err);
    }

    // Get the user's preferred model for ad rewards (default to nano for most generous)
    const preferredModel = req.body.preferredModel || 'gpt-4.1-nano';
    const tokensToGrant = AD_REWARDS[preferredModel] || AD_REWARDS['gpt-4.1-nano'];

    // Grant tokens to the specific model
    const newBalance = await updateModelTokenBalance(req.user.id, preferredModel, tokensToGrant);

    await AdView.create({
      userId: user.id,
      adId: uuidv4(), // Generate a unique ID for the ad view
      modelId: preferredModel,
      tokensGranted: tokensToGrant,
      completed: true,
    });

    res.json({ 
      msg: 'Tokens granted successfully', 
      newBalance: newBalance,
      tokensGranted: tokensToGrant,
      modelUsed: preferredModel
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/purchase-tier:
 *   post:
 *     summary: Purchase a paid tier
 *     tags: [Monetization]
 *     responses:
 *       200:
 *         description: Paid tier activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 paidUntil:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 */
// Endpoint to handle paid tier purchase
app.post('/api/v1/purchase-tier', auth, validate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      next(err);
    }

    // For simplicity, assuming a fixed 1-week access for now
    const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
    const newPaidUntil = new Date(Date.now() + ONE_WEEK_IN_MS);

    user.isPaidUser = true;
    user.paidUntil = newPaidUntil;
    await user.save();

    res.json({ msg: 'Paid tier activated successfully', paidUntil: user.paidUntil });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/user-status:
 *   get:
 *     summary: Get the user's token balance and paid status
 *     tags: [User]
 *     responses:
 *       200:
 *         description: User status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokenBalance:
 *                   type: integer
 *                 isPaidUser:
 *                   type: boolean
 *                 paidUntil:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 */
// Endpoint to get user status (token balance, paid status)
app.get('/api/v1/user-status', auth, async (req, res, next) => {
  try {
    // Try to get from cache first
    const cacheKey = `user-status:v2:${req.user.id}`;
    let cachedStatus = await cache.get(cacheKey);
    
    if (cachedStatus) {
      return res.json(cachedStatus);
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['isPaidUser', 'paidUntil', 'planStatus'],
    });
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      next(err);
    }

    // Get all model-specific token balances
    const modelTokenBalances = await getAllModelTokenBalances(req.user.id);

    // Low token warning (if any model is below 20 tokens)
    const LOW_TOKEN_THRESHOLD = 20;
    let lowTokenWarning = false;
    let lowTokenModels = [];
    for (const [model, balance] of Object.entries(modelTokenBalances)) {
      if (balance < LOW_TOKEN_THRESHOLD) {
        lowTokenWarning = true;
        lowTokenModels.push(model);
      }
    }

    // Paid expiry warning (if paidUntil is within 2 days)
    let paidExpiryWarning = false;
    let daysLeft = null;
    if (user.isPaidUser && user.paidUntil) {
      const now = new Date();
      const paidUntil = new Date(user.paidUntil);
      const diffMs = paidUntil - now;
      daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysLeft <= 2) {
        paidExpiryWarning = true;
      }
    }

    const userStatus = {
      ...user.toJSON(),
      modelTokenBalances,
      lowTokenWarning,
      lowTokenModels,
      paidExpiryWarning,
      paidExpiryDaysLeft: daysLeft
    };

    // Cache the result for 1 minute
    await cache.set(cacheKey, userStatus, 60);

    res.json(userStatus);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/usage:
 *   get:
 *     summary: Get usage dashboard for the authenticated user
 *     tags: [Usage]
 *     responses:
 *       200:
 *         description: Usage dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokenUsage:
 *                   type: array
 *                   items:
 *                     type: object
 *                 adViews:
 *                   type: array
 *                   items:
 *                     type: object
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.get('/api/v1/usage', auth, async (req, res, next) => {
  try {
    const tokenUsage = await TokenUsage.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    const adViews = await AdView.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    res.json({ tokenUsage, adViews, payments });
  } catch (error) {
    console.error('Sequelize error in /api/v1/usage:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
/**
 * @swagger
 * /api/v1/supported-formats:
 *   get:
 *     summary: Get supported file formats for upload
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: List of supported file formats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 formats:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["pdf", "docx", "doc", "txt", "png", "jpg", "jpeg", "gif", "bmp"]
 */
/**
 * @swagger
 * /api/v1/models:
 *   get:
 *     summary: Get available AI models with their status
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: List of available models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       available:
 *                         type: boolean
 */
// Get available models
app.get('/api/v1/models', (req, res) => {
  const models = Object.values(MODEL_CONFIG).map(model => ({
    id: model.id,
    name: model.name,
    description: model.description,
    baseTokenCost: model.baseTokenCost,
    available: model.available
  }));
  res.json({ models });
});

// Get supported file formats
app.get('/api/v1/supported-formats', (req, res) => {
  const fileProcessor = new FileProcessor();
  res.json({ formats: fileProcessor.getSupportedFormats() });
});

// Register admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/v1/admin', adminRoutes);

// Remove duplicate health route (kept single definition above)

// Maintenance mode handler
app.use(maintenanceHandler);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Token counting now handled by utils/tokenizer

// Helper for LLM timeout
function withTimeout(promise, ms, fallbackMsg, logLabel) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      const err = new Error(fallbackMsg);
      err.isTimeout = true;
      reject(err);
    }, ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    timeoutPromise
  ]).catch(err => {
    console.error(`[LLM ${logLabel}]`, err);
    throw err;
  });
}

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Setup model associations
    setupAssociations();
    
    // Prefer migrations in production; optionally allow sync in dev
    if (env.ALLOW_DB_SYNC) {
      await sequelize.sync({ alter: true });
      console.log('✅ Database schema synchronized (sync)');
    } else {
      const { runMigrations } = require('./database/run-migrations');
      await runMigrations();
      console.log('✅ Database migrations applied');
    }
    
    // Start server
  const server = app.listen(port, () => {
      console.log(`🚀 Backend server listening at http://localhost:${port}`);
      console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
      console.log(`💾 Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      await cache.quit();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
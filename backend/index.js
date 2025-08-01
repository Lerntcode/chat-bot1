require('./models/associations');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const winston = require('winston');
const FileProcessor = require('./utils/fileProcessor');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    // You can add file transports here if needed
  ],
});

module.exports.logger = logger;

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

// --- TogetherAI Setup ---
const together = new TogetherAI({ apiKey: process.env.TOGETHER_API_KEY });

// --- OpenAI Setup ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Qwen Setup ---
const qwenClient = axios.create({
  baseURL: 'https://api.studio.nebius.ai/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.QWEN_API_KEY}`
  }
});

// --- Model Mapping for API calls ---
const MODEL_API_MAPPING = {
  'gpt-4.1-nano': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'gpt-4.1-mini': 'gpt-4o-mini',
  'gpt-4.1': 'Qwen/Qwen3-235B-A22B'
};

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
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Centralized error handler middleware
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    details: err.details || undefined
  });
});

// Rate limiter for chat
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: { error: 'Too many chat requests from this IP, please try again after a minute.' }
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Endpoints
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/monitoring', require('./routes/monitoring'));
app.use('/api/v1/admin', require('./routes/admin'));



const auth = require('./middleware/auth');

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

app.post('/api/v1/chat', chatLimiter, auth, upload.single('file'), technicalQuestionDetector, async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    logger.info({ action: 'chat_request', userId: req.user.id, conversationId, message, model: req.query.model || 'default' });

    // Always define selectedModel and modelConfig at the top
    const selectedModel = req.query.model || 'gpt-4.1-nano';
    const modelConfig = MODEL_CONFIG[selectedModel];
    if (!modelConfig) {
      const err = new Error(`Unsupported model: ${selectedModel}`);
      err.status = 400;
      next(err);
      return;
    }

  // --- Token Usage Logic ---
  const user = await User.findByPk(req.user.id);
  if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      next(err);
      return;
  }

  // Check if user is a paid user and their subscription is active
  const isPaidAndActive = user.isPaidUser && user.paidUntil && new Date(user.paidUntil) > new Date();

  if (!isPaidAndActive) {
    // Get model-specific token balance
    const modelTokenBalance = await getModelTokenBalance(req.user.id, selectedModel);

    // Check if user has enough tokens for the base cost
    if (modelTokenBalance < modelConfig.baseTokenCost) {
        const err = new Error(`Insufficient ${modelConfig.name} tokens. This message costs at least ${modelConfig.baseTokenCost} tokens. You have ${modelTokenBalance} ${modelConfig.name} tokens. Please watch an ad for ${modelConfig.name} or purchase more tokens.`);
        err.status = 403;
        next(err);
        return;
    }
  }

  let conversation;
  if (conversationId) {
    conversation = await Conversation.findByPk(conversationId, { include: [{ model: Message, as: 'Messages' }] });
  }

  if (!conversation) {
    conversation = await Conversation.create({ title: 'New Chat', lastMessageTimestamp: new Date(), userId: req.user.id });
  }

  let userMessage = message;
    let fileContent = null;
    let fileInfo = null;

  if (req.file) {
      try {
        const fileProcessor = new FileProcessor();
        const result = await fileProcessor.processFile(req.file.path, req.file.originalname);
        
        if (result.success) {
          fileContent = result.content;
          fileInfo = {
            fileName: result.fileName,
            fileType: result.fileType,
            wordCount: result.wordCount,
            summary: fileProcessor.getFileSummary(result.content)
          };
          
          // Add file info to user message
          userMessage += `\n\n📎 File attached: ${result.fileName} (${result.fileType}, ${result.wordCount} words)`;
          
          // If no text message, use file content as the message
          if (!message.trim()) {
            userMessage = `Please analyze this ${result.fileType} file: ${result.fileName}\n\nFile content:\n${fileContent}`;
          } else {
            // Add file content to the message for context
            userMessage += `\n\nFile content:\n${fileContent}`;
          }
          
          logger.info({ 
            action: 'file_processed', 
            userId: req.user.id, 
            fileName: result.fileName, 
            fileType: result.fileType, 
            wordCount: result.wordCount 
          });
        } else {
          userMessage += `\n\n❌ Failed to process file: ${result.error}`;
          logger.error({ 
            action: 'file_processing_error', 
            userId: req.user.id, 
            fileName: req.file.originalname, 
            error: result.error 
          });
        }
      } catch (error) {
        userMessage += `\n\n❌ Error processing file: ${error.message}`;
        logger.error({ 
          action: 'file_processing_exception', 
          userId: req.user.id, 
          fileName: req.file.originalname, 
          error: error.message 
        });
      }
  }

  // --- Intelligent Memory Logic ---
  const shouldRemember = async (message) => {
    // 1. Explicit keyword check
    if (message.toLowerCase().includes("remember")) {
      return { should: true, isExplicit: true };
    }

    // 2. AI judgment call
    try {
      const judgmentPrompt = `Does the following message contain a useful fact worth remembering for future conversations? Answer with only YES or NO. Message: "${message}"`;
              const response = await withTimeout(
        together.chat.completions.create({
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1", // Always use Mixtral for memory judgment
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
      return { should: false, isExplicit: false }; // Default to not remembering on error
    }
  };

  const memoryCheck = await shouldRemember(userMessage);

  if (memoryCheck.should) {
    let memoryToSave;
    let botResponseText;

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
        await Memory.create({ text: memoryToSave, timestamp: new Date().toISOString(), userId: req.user.id });
    }

    // If it was an explicit command, we can just send the confirmation and stop.
    if (memoryCheck.isExplicit) {
        const botResponse = {
            user: userMessage,
            bot: botResponseText,
            timestamp: new Date().toISOString()
        };
        await Message.create({ ...botResponse, conversationId: conversation.id });
        await conversation.update({ lastMessageTimestamp: new Date() });
        res.json({ conversationId: conversation.id, message: botResponse });
        return;
    }
    // If it was an implicit "remember", we still need to get a proper chat response.
    // We'll prepend the confirmation to the main response later.
  }

  let botResponseText = "";
  let thoughtProcessSteps = [];

  // --- Memory Retrieval Logic ---
  const memoryKeywords = ["what is my", "do you remember", "my name", "my favorite", "what's my"];
  let isMemoryRetrieval = false;
  let retrievedMemory = null;

  for (const keyword of memoryKeywords) {
    if (userMessage.toLowerCase().includes(keyword)) {
      isMemoryRetrieval = true;
      // Extract the relevant part of the query to search in memory
      const queryPart = userMessage.toLowerCase().split(keyword)[1]?.trim() || userMessage.toLowerCase();
      
      // Search for memory entries that contain the query part
      const memories = await Memory.findAll({
        where: {
          text: { [Op.like]: `%${queryPart}%` },
          userId: req.user.id
        },
        order: [['timestamp', 'DESC']],
        limit: 1
      });

      if (memories.length > 0) {
        retrievedMemory = memories[0].text;
        break;
      }
    }
  }

  if (isMemoryRetrieval && retrievedMemory) {
    botResponseText = `You told me: "${retrievedMemory}"`;
    thoughtProcessSteps.push("Retrieved information from memory.");
  } else {

  try {
    thoughtProcessSteps.push("Sending message to TogetherAI...");

    const messagesForTogetherAI = (conversation.Messages || []).flatMap(msg => {
      const formatted = [];
      if (msg.user) {
        formatted.push({ role: "user", content: msg.user });
      }
      if (msg.bot) {
        formatted.push({ role: "assistant", content: msg.bot });
      }
      return formatted;
    });

    // Add the current user message
    messagesForTogetherAI.push({ role: "user", content: userMessage });

            // Get the model from query parameters, default to nano for lowest cost
      const selectedModel = req.query.model || "gpt-4.1-nano";
      
          // Validate the model is supported using MODEL_CONFIG
    if (!MODEL_CONFIG[selectedModel]) {
      throw new Error(`Unsupported model: ${selectedModel}`);
    }

    // Check if the model has API access
    const apiModel = MODEL_API_MAPPING[selectedModel] || selectedModel;
    if (apiModel === selectedModel && selectedModel !== 'gpt-4.1-nano') {
      throw new Error(`Model ${selectedModel} is not yet available. Please use GPT-4.1 Nano for now.`);
    }

            

      let response;
      if (selectedModel === 'gpt-4.1-mini') {
        response = await openai.chat.completions.create({
          model: apiModel,
          messages: messagesForTogetherAI,
        });
      } else if (selectedModel === 'gpt-4.1') {
        // Qwen API call (Nebius AI Studio - OpenAI compatible)
        const qwenResponse = await qwenClient.post('/chat/completions', {
          model: apiModel,
          messages: messagesForTogetherAI,
        });
        response = { choices: [{ message: { content: qwenResponse.data.choices[0].message.content } }] };
      } else {
        response = await withTimeout(
          together.chat.completions.create({
            model: apiModel,
            messages: messagesForTogetherAI,
          }),
          10000,
          "I'm sorry, the AI took too long to respond. Please try again.",
          'Chat Completion'
        );
      }

    botResponseText = response.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    thoughtProcessSteps.push("Received response from TogetherAI.");
      logger.info({ action: 'llm_chat_success', userId: req.user.id, conversationId: conversation.id, model: selectedModel });

  } catch (error) {
      logger.error({ action: 'llm_chat_error', userId: req.user.id, conversationId: conversation.id, error: error.message, isTimeout: error.isTimeout, model: selectedModel });
      
      // Handle specific model errors
      if (error.message.includes('model') || error.message.includes('not found') || error.message.includes('access')) {
        botResponseText = `I'm sorry, the selected model "${selectedModel}" is currently unavailable. Please try a different model or contact support if this persists.`;
        thoughtProcessSteps.push(`Model error: ${error.message}`);
      } else if (error.isTimeout) {
        botResponseText = error.message;
        thoughtProcessSteps.push("Error communicating with TogetherAI.");
      } else {
        botResponseText = "I'm sorry, I couldn't get a response from the AI at the moment. Please try again.";
    thoughtProcessSteps.push("Error communicating with TogetherAI.");
      }
  }
}

  if (memoryCheck.should && !memoryCheck.isExplicit) {    const notedMessage = `(Noted: "${userMessage}")

`;    botResponseText = notedMessage + botResponseText;  }  const response = {
    user: userMessage,
    bot: botResponseText,
    timestamp: new Date().toISOString(),
    thoughtProcess: thoughtProcessSteps,
    conversationId: conversation.id,
    fileInfo: fileInfo
  };

  // Calculate actual token usage after getting the response
  if (!isPaidAndActive) {
    const userMessageTokens = estimateTokenCount(userMessage);
    const botResponseTokens = estimateTokenCount(botResponseText);
    const totalTokens = userMessageTokens + botResponseTokens;
    
    // Use the higher of actual tokens or base token cost
    const tokensToDeduct = Math.max(totalTokens, modelConfig.baseTokenCost);

    // Decrement model-specific token balance
    await updateModelTokenBalance(req.user.id, selectedModel, -tokensToDeduct);

    // Record token usage
    await TokenUsage.create({
      userId: user.id,
      tokensUsed: tokensToDeduct,
      modelUsed: selectedModel,
    });
  }

  await Message.create(response);
  await conversation.update({ lastMessageTimestamp: new Date(), title: conversation.title === 'New Chat' ? userMessage.substring(0, 30) + '...' : conversation.title });
  logger.info({ action: 'chat_response', userId: req.user.id, conversationId: conversation.id, botResponse: botResponseText });
  res.json({ conversationId: conversation.id, message: response });
  } catch (error) {
    console.error('Sequelize error in /api/v1/chat:', error);
    next(error);
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
// Get all conversations (metadata)
app.get('/api/v1/conversations', auth, async (req, res, next) => {
  try {
    const conversations = await Conversation.findAll({
      attributes: ['id', 'title', 'lastMessageTimestamp'],
      where: { userId: req.user.id },
      order: [['lastMessageTimestamp', 'DESC']],
    });
    res.json(conversations);
  } catch (error) {
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
app.get('/api/v1/conversations/:id', auth, async (req, res, next) => {
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
app.delete('/api/v1/conversations/:id', auth, async (req, res, next) => {
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
app.post('/api/v1/conversations/:id/summarize', auth, async (req, res, next) => {
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
    const memories = await Memory.findAll({
      where: { userId: req.user.id },
      order: [['timestamp', 'DESC']],
    });
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
app.put('/api/v1/memory/:id', auth, async (req, res, next) => {
  const { text } = req.body;
  try {
    const memory = await Memory.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (memory) {
      memory.text = text;
      await memory.save();
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
app.delete('/api/v1/memory/:id', auth, async (req, res, next) => {
  try {
    const deleted = await Memory.destroy({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (deleted) {
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
app.post('/api/v1/ad-view', auth, async (req, res, next) => {
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
app.post('/api/v1/purchase-tier', auth, async (req, res, next) => {
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
    const user = await User.findByPk(req.user.id, {
      attributes: ['isPaidUser', 'paidUntil'],
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

    res.json({
      ...user.toJSON(),
      modelTokenBalances,
      lowTokenWarning,
      lowTokenModels,
      paidExpiryWarning,
      paidExpiryDaysLeft: daysLeft
    });
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

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to estimate token count (rough approximation)
function estimateTokenCount(text) {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

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
    
    // Sync database schema
    await sequelize.sync({ force: false });
    console.log('✅ Database schema synchronized');
    
    // Start server
  app.listen(port, () => {
      console.log(`🚀 Backend server listening at http://localhost:${port}`);
      console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
      console.log(`💾 Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
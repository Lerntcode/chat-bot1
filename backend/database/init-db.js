const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

// Import all models
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ModelTokenBalance = require('../models/ModelTokenBalance');
const TokenUsage = require('../models/TokenUsage');
const AdView = require('../models/AdView');
const Payment = require('../models/Payment');
const FileUpload = require('../models/FileUpload');
const Memory = require('../models/Memory');
const EmailVerificationToken = require('../models/EmailVerificationToken');

// Define associations
const setupAssociations = () => {
  console.log('🔗 Setting up model associations...');
  
  // User associations
  User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Conversation, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(ModelTokenBalance, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(TokenUsage, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(AdView, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Payment, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(FileUpload, { foreignKey: 'userId', onDelete: 'CASCADE' });
  User.hasMany(Memory, { foreignKey: 'userId', onDelete: 'CASCADE' });

  // Conversation associations
  Conversation.hasMany(Message, { foreignKey: 'conversationId', onDelete: 'CASCADE' });
  Conversation.hasMany(FileUpload, { foreignKey: 'conversationId', onDelete: 'SET NULL' });

  // Reverse associations
  RefreshToken.belongsTo(User, { foreignKey: 'userId' });
  Conversation.belongsTo(User, { foreignKey: 'userId' });
  ModelTokenBalance.belongsTo(User, { foreignKey: 'userId' });
  TokenUsage.belongsTo(User, { foreignKey: 'userId' });
  TokenUsage.belongsTo(Conversation, { foreignKey: 'conversationId' });
  AdView.belongsTo(User, { foreignKey: 'userId' });
  Payment.belongsTo(User, { foreignKey: 'userId' });
  FileUpload.belongsTo(User, { foreignKey: 'userId' });
  FileUpload.belongsTo(Conversation, { foreignKey: 'conversationId' });
  Memory.belongsTo(User, { foreignKey: 'userId' });
  Message.belongsTo(Conversation, { foreignKey: 'conversationId' });
  EmailVerificationToken.belongsTo(User, { foreignKey: 'userId' });
  User.hasMany(EmailVerificationToken, { foreignKey: 'userId', onDelete: 'CASCADE' });

  console.log('✅ Model associations configured');
};

// Create sample data
const createSampleData = async () => {
  console.log('📝 Creating sample data...');
  
  try {
    // Create sample user
    const user = await User.create({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      password: '$2b$10$hashedpassword',
      name: 'Test User',
      planStatus: 'free',
      isActive: true
    });

    // Create model token balances
    await ModelTokenBalance.bulkCreate([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: user.id,
        modelId: 'gpt-4.1-nano',
        balance: 100
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        userId: user.id,
        modelId: 'gpt-4.1-mini',
        balance: 0
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        userId: user.id,
        modelId: 'gpt-4.1',
        balance: 0
      }
    ]);

    // Create sample conversation
    const conversation = await Conversation.create({
      id: '550e8400-e29b-41d4-a716-446655440004',
      userId: user.id,
      title: 'Sample Chat'
    });

    // Create sample messages
    await Message.bulkCreate([
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello, how are you?',
        user: 'Hello, how are you?'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440006',
        conversationId: conversation.id,
        role: 'bot',
        content: 'Hello! I am doing well, thank you for asking. How can I help you today?',
        bot: 'Hello! I am doing well, thank you for asking. How can I help you today?'
      }
    ]);

    // Create sample token usage
    await TokenUsage.bulkCreate([
      {
        id: '550e8400-e29b-41d4-a716-446655440007',
        userId: user.id,
        conversationId: conversation.id,
        tokensUsed: 20,
        modelUsed: 'gpt-4.1-nano',
        messageType: 'user'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440008',
        userId: user.id,
        conversationId: conversation.id,
        tokensUsed: 25,
        modelUsed: 'gpt-4.1-nano',
        messageType: 'bot'
      }
    ]);

    // Create sample ad view
    await AdView.create({
      id: '550e8400-e29b-41d4-a716-446655440009',
      userId: user.id,
      adId: 'ad_001',
      tokensGranted: 10000,
      modelId: 'gpt-4.1-nano',
      completed: true
    });

    // Create sample memory
    await Memory.create({
      id: '550e8400-e29b-41d4-a716-446655440010',
      userId: user.id,
      text: 'User prefers dark theme'
    });

    console.log('✅ Sample data created successfully');
  } catch (error) {
    console.log('⚠️ Sample data already exists or error occurred:', error.message);
  }
};

// Initialize database
const initDatabase = async () => {
  try {
    console.log('🚀 Initializing database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Setup associations
    setupAssociations();
    
    // Sync all models (create tables)
    console.log('📋 Creating database tables...');
    await sequelize.sync({ force: false }); // Set force: true to recreate all tables
    console.log('✅ Database tables created/updated');
    
    // Create sample data
    await createSampleData();
    
    console.log('🎉 Database initialization completed successfully!');
    console.log('\n📊 Database Schema Summary:');
    console.log('├── Users (authentication & user management)');
    console.log('├── RefreshTokens (secure session management)');
    console.log('├── Conversations (chat sessions)');
    console.log('├── Messages (individual chat messages)');
    console.log('├── ModelTokenBalances (model-specific token tracking)');
    console.log('├── TokenUsage (detailed usage analytics)');
    console.log('├── AdViews (ad monetization tracking)');
    console.log('├── Payments (subscription & payment processing)');
    console.log('├── FileUploads (file processing & OCR)');
    console.log('└── Memories (chatbot context & preferences)');
    
    console.log('\n🔗 Key Features:');
    console.log('├── Complete user authentication system');
    console.log('├── Model-specific token management');
    console.log('├── Comprehensive conversation tracking');
    console.log('├── Ad revenue and payment processing');
    console.log('├── File upload with OCR support');
    console.log('├── Memory system for context');
    console.log('├── Analytics views for business intelligence');
    console.log('└── Optimized indexes for performance');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

// Run initialization if this file is executed directly
if (require.main === module) {
  initDatabase().then(() => {
    console.log('\n✨ Database is ready for use!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { initDatabase, setupAssociations }; 
const Conversation = require('./Conversation');
const Message = require('./Message');
const User = require('./User');
const EmailVerificationToken = require('./EmailVerificationToken');

// User-Conversation
User.hasMany(Conversation, { foreignKey: 'userId', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'userId' });

// Conversation-Message
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'Messages', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'Conversation' });

module.exports = { Conversation, Message, User }; 

// User - EmailVerificationToken
User.hasMany(EmailVerificationToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
EmailVerificationToken.belongsTo(User, { foreignKey: 'userId' });

module.exports.EmailVerificationToken = EmailVerificationToken;
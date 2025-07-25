const Conversation = require('./Conversation');
const Message = require('./Message');
const User = require('./User');

// User-Conversation
User.hasMany(Conversation, { foreignKey: 'userId', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'userId' });

// Conversation-Message
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'Messages', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'Conversation' });

module.exports = { Conversation, Message, User }; 
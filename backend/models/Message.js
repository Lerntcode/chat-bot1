const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Conversation = require('./Conversation');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Conversations',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'bot', 'system'),
    allowNull: true, // Make optional for backward compatibility
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true, // Make optional for backward compatibility
  },
  user: {
    type: DataTypes.TEXT,
    allowNull: true, // Keep for backward compatibility
  },
  bot: {
    type: DataTypes.TEXT,
    allowNull: true, // Keep for backward compatibility
  },
  tokensUsed: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  modelUsed: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  thoughtProcess: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  fileInfo: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  indexes: [
    {
      fields: ['conversationId']
    },
    {
      fields: ['role']
    },
    {
      fields: ['modelUsed']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['createdAt']
    }
  ]
});

Conversation.hasMany(Message, { foreignKey: 'conversationId', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

module.exports = Message;

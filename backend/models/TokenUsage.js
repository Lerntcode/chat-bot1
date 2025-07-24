const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const TokenUsage = sequelize.define('TokenUsage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Conversations',
      key: 'id'
    }
  },
  tokensUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  modelUsed: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  messageType: {
    type: DataTypes.ENUM('user', 'bot', 'system'),
    defaultValue: 'user',
  },
  costPerToken: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true,
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 4),
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
      fields: ['userId']
    },
    {
      fields: ['conversationId']
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

User.hasMany(TokenUsage, { foreignKey: 'userId', onDelete: 'CASCADE' });
TokenUsage.belongsTo(User, { foreignKey: 'userId' });

module.exports = TokenUsage;
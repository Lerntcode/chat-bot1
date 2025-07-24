const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const Conversation = require('./Conversation');

const FileUpload = sequelize.define('FileUpload', {
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
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fileType: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  wordCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ocrText: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  processingStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  processingError: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
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
      fields: ['fileType']
    },
    {
      fields: ['processingStatus']
    },
    {
      fields: ['createdAt']
    }
  ]
});

User.hasMany(FileUpload, { foreignKey: 'userId', onDelete: 'CASCADE' });
FileUpload.belongsTo(User, { foreignKey: 'userId' });

Conversation.hasMany(FileUpload, { foreignKey: 'conversationId', onDelete: 'SET NULL' });
FileUpload.belongsTo(Conversation, { foreignKey: 'conversationId' });

module.exports = FileUpload; 
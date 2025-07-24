const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const AdView = sequelize.define('AdView', {
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
  adId: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  adType: {
    type: DataTypes.ENUM('banner', 'interstitial', 'rewarded'),
    defaultValue: 'rewarded',
  },
  tokensGranted: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  modelId: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  adProvider: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  revenue: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
  },
  viewDuration: {
    type: DataTypes.INTEGER, // seconds
    allowNull: true,
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
      fields: ['adId']
    },
    {
      fields: ['modelId']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['createdAt']
    }
  ]
});

User.hasMany(AdView, { foreignKey: 'userId', onDelete: 'CASCADE' });
AdView.belongsTo(User, { foreignKey: 'userId' });

module.exports = AdView;
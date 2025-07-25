const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  planStatus: {
    type: DataTypes.ENUM('free', 'pro', 'enterprise'),
    defaultValue: 'free',
  },
  isPaidUser: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  paidUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
      fields: ['email']
    },
    {
      fields: ['planStatus']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Only export User, do not set up associations here.
module.exports = User;
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Memory = sequelize.define('Memory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['timestamp']
    }
  ]
});

User.hasMany(Memory, { foreignKey: 'userId', onDelete: 'CASCADE' });
Memory.belongsTo(User, { foreignKey: 'userId' });

module.exports = Memory;

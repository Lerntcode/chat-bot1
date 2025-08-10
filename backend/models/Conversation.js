const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const Message = require('./Message');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastMessageTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['lastMessageTimestamp']
    }
  ]
});

module.exports = Conversation;

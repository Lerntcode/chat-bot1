const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const ModelTokenBalance = sequelize.define('ModelTokenBalance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  modelId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['userId', 'modelId']
    }
  ]
});

User.hasMany(ModelTokenBalance, { foreignKey: 'userId', onDelete: 'CASCADE' });
ModelTokenBalance.belongsTo(User, { foreignKey: 'userId' });

module.exports = ModelTokenBalance; 
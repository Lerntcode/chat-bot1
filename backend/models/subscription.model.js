const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Subscription = sequelize.define('Subscription', {
    stripeSubscriptionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'incomplete',
    },
    currentPeriodEnd: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  return Subscription;
};
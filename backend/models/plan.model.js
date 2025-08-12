const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Plan = sequelize.define('Plan', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    features: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    stripePriceId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  });

  return Plan;
};
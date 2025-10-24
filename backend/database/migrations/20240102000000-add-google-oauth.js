const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add Google OAuth fields to User table
    await queryInterface.addColumn('Users', 'googleId', {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    });

    await queryInterface.addColumn('Users', 'lastLogin', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    // Make password nullable for OAuth users
    await queryInterface.changeColumn('Users', 'password', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });

    // Add index for googleId
    await queryInterface.addIndex('Users', ['googleId'], {
      name: 'users_google_id_index',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove Google OAuth fields
    await queryInterface.removeIndex('Users', 'users_google_id_index');
    await queryInterface.removeColumn('Users', 'googleId');
    await queryInterface.removeColumn('Users', 'lastLogin');
    
    // Make password required again
    await queryInterface.changeColumn('Users', 'password', {
      type: DataTypes.STRING(255),
      allowNull: false,
    });
  }
};

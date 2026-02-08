const { sequelize } = require('./config/database');
const User = require('./models/User');
const ModelTokenBalance = require('./models/ModelTokenBalance');

const checkUserTokens = async (email) => {
  try {
    // Connect to the database
    await sequelize.authenticate();
    console.log('Connected to the database successfully');

    // Find the user by email
    const user = await User.findOne({
      where: { email: email }
    });

    if (!user) {
      console.log(`User with email ${email} not found in the database`);
      return;
    }

    console.log(`User found: ${user.name || 'No name'} (${user.email})`);
    console.log(`User ID: ${user.id}`);

    // Get all token balances for this user
    const tokenBalances = await ModelTokenBalance.findAll({
      where: { userId: user.id }
    });

    if (tokenBalances.length === 0) {
      console.log('No token balances found for this user');
    } else {
      console.log('\nToken Balances:');
      tokenBalances.forEach(balance => {
        console.log(`- Model: ${balance.modelId}, Balance: ${balance.balance}`);
      });
    }

  } catch (error) {
    console.error('Error checking tokens:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
};

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node check_tokens.js <email>');
    console.log('Example: node check_tokens.js khanrabiaonais194@gmail.com');
    process.exit(1);
  }

  const email = args[0];
  checkUserTokens(email);
}

module.exports = { checkUserTokens };
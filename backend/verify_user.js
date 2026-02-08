const { sequelize } = require('./config/database');
const User = require('./models/User');
const ModelTokenBalance = require('./models/ModelTokenBalance');

// Function to get model token balance (replicating the function from index.cjs)
async function getModelTokenBalance(userId, modelId) {
  const balance = await ModelTokenBalance.findOne({
    where: { userId, modelId }
  });
  return balance ? balance.balance : 0;
}

// Function to verify user and token status
const verifyUserAndTokens = async (email) => {
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
      return false;
    }

    console.log(`User found: ${user.name || 'No name'} (${user.email})`);
    console.log(`User ID: ${user.id}`);
    console.log(`Is paid user: ${user.isPaidUser}`);
    console.log(`Paid until: ${user.paidUntil}`);

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

    // Test the specific function that's used in the chat endpoint
    const nanoBalance = await getModelTokenBalance(user.id, 'gpt-4.1-nano');
    console.log(`\nBalance for gpt-4.1-nano (using chat endpoint function): ${nanoBalance}`);

    console.log('\nUser verification completed successfully');
    return true;

  } catch (error) {
    console.error('Error verifying user:', error);
    return false;
  } finally {
    // Close the database connection
    await sequelize.close();
  }
};

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node verify_user.js <email>');
    console.log('Example: node verify_user.js khanrabiaonais194@gmail.com');
    process.exit(1);
  }

  const email = args[0];
  verifyUserAndTokens(email)
    .then(success => {
      if (success) {
        console.log('✅ User verification completed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Failed to verify user');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { verifyUserAndTokens };
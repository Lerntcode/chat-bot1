const { sequelize } = require('./config/database');
const User = require('./models/User');
const ModelTokenBalance = require('./models/ModelTokenBalance');

// Function to reset a user's token balance and ensure proper setup
const resetUserTokens = async (email) => {
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
    console.log(`Email verified: ${user.emailVerified}`);
    console.log(`Is paid user: ${user.isPaidUser}`);

    // Check if the user is not email verified and update if needed for testing
    if (!user.emailVerified) {
      console.log('⚠️  User email is not verified. Setting email as verified for testing...');
      user.emailVerified = true;
      await user.save();
      console.log('✅ User email marked as verified');
    }

    // Ensure all model balances exist for the user
    const models = ['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1'];
    
    for (const model of models) {
      let balanceRecord = await ModelTokenBalance.findOne({
        where: { userId: user.id, modelId: model }
      });
      
      if (balanceRecord) {
        console.log(`- Found ${model} balance: ${balanceRecord.balance}`);
      } else {
        console.log(`- Missing ${model} balance, creating default entry...`);
        // Create default balance if missing
        await ModelTokenBalance.create({
          userId: user.id,
          modelId: model,
          balance: model === 'gpt-4.1-nano' ? 1000 : 0  // Set 1000 for nano as we intended, 0 for others
        });
        console.log(`- Created ${model} balance with 0 tokens`);
      }
    }

    console.log('\nUser token setup completed successfully');
    return true;

  } catch (error) {
    console.error('Error resetting user tokens:', error);
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
    console.log('Usage: node reset_user_tokens.js <email>');
    console.log('Example: node reset_user_tokens.js khanrabiaonais194@gmail.com');
    process.exit(1);
  }

  const email = args[0];
  resetUserTokens(email)
    .then(success => {
      if (success) {
        console.log('✅ User token reset completed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Failed to reset user tokens');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { resetUserTokens };
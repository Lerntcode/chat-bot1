const { sequelize } = require('./config/database');
const User = require('./models/User');
const ModelTokenBalance = require('./models/ModelTokenBalance');

const setTokensForEmail = async (email, tokens, modelId = 'gpt-4.1-nano') => {
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

    console.log(`Found user: ${user.name || 'No name'} (${user.email})`);

    // Check if a token balance record already exists for this user and model
    let tokenBalance = await ModelTokenBalance.findOne({
      where: {
        userId: user.id,
        modelId: modelId
      }
    });

    if (tokenBalance) {
      // Update existing token balance
      tokenBalance.balance = tokens;
      await tokenBalance.save();
      console.log(`Updated ${modelId} token balance for user ${email} to ${tokens}`);
    } else {
      // Create new token balance record
      tokenBalance = await ModelTokenBalance.create({
        userId: user.id,
        modelId: modelId,
        balance: tokens
      });
      console.log(`Created new token balance record for ${modelId} with ${tokens} tokens for user ${email}`);
    }

    console.log('Token update completed successfully');
    return true;

  } catch (error) {
    console.error('Error setting tokens:', error);
    return false;
  } finally {
    // Close the database connection
    await sequelize.close();
  }
};

// Command line execution
if (require.main === module) {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node set_tokens.js <email> <tokens> [modelId]');
    console.log('Example: node set_tokens.js khanrabiaonais194@gmail.com 1000');
    console.log('Default modelId: gpt-4.1-nano');
    process.exit(1);
  }

  const email = args[0];
  const tokens = parseInt(args[1]);
  const modelId = args[2] || 'gpt-4.1-nano';  // Default to gpt-4.1-nano if not provided

  if (isNaN(tokens)) {
    console.error('Tokens must be a valid number');
    process.exit(1);
  }

  console.log(`Setting ${tokens} tokens for ${email} (model: ${modelId})...`);

  setTokensForEmail(email, tokens, modelId)
    .then(success => {
      if (success) {
        console.log('✅ Tokens updated successfully!');
        process.exit(0);
      } else {
        console.log('❌ Failed to update tokens');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { setTokensForEmail };
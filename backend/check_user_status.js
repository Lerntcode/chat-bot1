const { sequelize } = require('./config/database');
const User = require('./models/User');
const ModelTokenBalance = require('./models/ModelTokenBalance');

// Function to get the exact same data the frontend would receive via /api/v1/user-status
const checkUserStatus = async (email) => {
  try {
    // Connect to the database
    await sequelize.authenticate();
    console.log('Connected to the database successfully');

    // Find the user by email
    const user = await User.findByPk('d40d1105-f9b4-4e72-b00b-a7dd8ff89088');

    if (!user) {
      console.log(`User with email ${email} not found in the database`);
      return false;
    }

    console.log(`User found: ${user.name || 'No name'} (${user.email})`);
    console.log(`Is paid user: ${user.isPaidUser}`);
    console.log(`Paid until: ${user.paidUntil}`);

    // Get all model-specific token balances (this is what the /api/v1/user-status endpoint does)
    const modelTokenBalances = {};
    const tokenBalances = await ModelTokenBalance.findAll({
      where: { userId: user.id }
    });

    console.log('\nAll model token balances:');
    for (const balance of tokenBalances) {
      modelTokenBalances[balance.modelId] = balance.balance;
      console.log(`- ${balance.modelId}: ${balance.balance} tokens`);
    }

    // Low token warning (if any model is below 20 tokens)
    const LOW_TOKEN_THRESHOLD = 20;
    let lowTokenWarning = false;
    let lowTokenModels = [];
    for (const [model, balance] of Object.entries(modelTokenBalances)) {
      if (balance < LOW_TOKEN_THRESHOLD) {
        lowTokenWarning = true;
        lowTokenModels.push(model);
      }
    }

    // Paid expiry warning (if paidUntil is within 2 days)
    let paidExpiryWarning = false;
    let daysLeft = null;
    if (user.isPaidUser && user.paidUntil) {
      const now = new Date();
      const paidUntil = new Date(user.paidUntil);
      const diffMs = paidUntil - now;
      daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysLeft <= 2) {
        paidExpiryWarning = true;
      }
    }

    const userStatus = {
      ...user.toJSON(),
      modelTokenBalances,
      lowTokenWarning,
      lowTokenModels,
      paidExpiryWarning,
      paidExpiryDaysLeft: daysLeft
    };

    console.log('\nData returned by /api/v1/user-status would be:');
    console.log(JSON.stringify(userStatus, null, 2));

    return true;

  } catch (error) {
    console.error('Error checking user status:', error);
    return false;
  } finally {
    // Close the database connection
    await sequelize.close();
  }
};

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const email = 'khanrabiaonais194@gmail.com';
  
  checkUserStatus(email)
    .then(success => {
      if (success) {
        console.log('\n✅ User status check completed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Failed to check user status');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { checkUserStatus };
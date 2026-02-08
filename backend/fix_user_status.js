const { sequelize } = require('./config/database');
const User = require('./models/User');

// Function to fix any potential user status issues
const fixUserStatus = async (email) => {
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

    console.log(`Current user status:`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Plan Status: ${user.planStatus}`);
    console.log(`- Is Paid User: ${user.isPaidUser}`);
    console.log(`- Paid Until: ${user.paidUntil}`);

    // In the application logic, having planStatus as 'enterprise' might cause unexpected behavior
    // if the user is not actually a paid user. Let's ensure consistency.
    if (user.planStatus === 'enterprise' && !user.isPaidUser) {
      console.log(`\n⚠️  Inconsistency detected: User has enterprise plan but is not a paid user.`);
      console.log(`   Setting planStatus to 'free' for consistency...`);
      
      user.planStatus = 'free';
      await user.save();
      console.log(`   ✅ Plan status updated to 'free'`);
    } else {
      console.log(`\n✅ User status is consistent`);
    }

    console.log(`\nUpdated user status:`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Plan Status: ${user.planStatus}`);
    console.log(`- Is Paid User: ${user.isPaidUser}`);
    console.log(`- Paid Until: ${user.paidUntil}`);

    return true;

  } catch (error) {
    console.error('Error fixing user status:', error);
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
    console.log('Usage: node fix_user_status.js <email>');
    console.log('Example: node fix_user_status.js khanrabiaonais194@gmail.com');
    process.exit(1);
  }

  const email = args[0];
  fixUserStatus(email)
    .then(success => {
      if (success) {
        console.log('\n✅ User status fix completed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Failed to fix user status');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { fixUserStatus };
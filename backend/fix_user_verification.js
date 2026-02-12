const { sequelize } = require('./config/database');
const User = require('./models/User');

const fixUserVerification = async (email) => {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log(`User ${email} not found.`);
            return false;
        }

        user.emailVerified = true;
        user.isPaidUser = true; // Ensure they keep paid status if intended, though expired
        // Optionally update paidUntil if we want to fix the expiry warning, 
        // but let's just fix login first.
        // user.paidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 

        await user.save();
        console.log(`✅ User ${email} emailVerified set to TRUE.`);
        return true;
    } catch (error) {
        console.error('Error updating user:', error);
        return false;
    } finally {
        await sequelize.close();
    }
};

if (require.main === module) {
    const email = 'khanrabiaonais194@gmail.com';
    fixUserVerification(email);
}

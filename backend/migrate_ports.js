const { getUserModel } = require('./models/User');
const { connectDB } = require('./config/db');

async function migrate() {
    await connectDB();
    const User = getUserModel();
    const users = await User.findAll();
    let count = 0;
    for (const user of users) {
        if (user.profileImage && user.profileImage.includes(':5005')) {
            user.profileImage = user.profileImage.replace(':5005', ':5005');
            await user.save();
            count++;
        }
    }
    console.log(`Migrated ${count} users.`);
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});

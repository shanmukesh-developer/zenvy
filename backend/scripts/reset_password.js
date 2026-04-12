const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../local_dev.sqlite'),
  logging: false
});

const reset = async () => {
    try {
        const hashedPassword = await bcrypt.hash('123456', 10);
        await sequelize.query(`UPDATE DeliveryPartners SET password = '${hashedPassword}' WHERE phone = 'driver1'`);
        console.log('Password for driver1 reset to 123456');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

reset();

const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../local_dev.sqlite'),
  logging: false
});

const check = async () => {
    try {
        const [data] = await sequelize.query("SELECT phone, name FROM DeliveryPartners LIMIT 5;");
        console.log('--- Delivery Partners Registry ---');
        console.log(JSON.stringify(data, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();

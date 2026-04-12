const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../local_dev.sqlite'),
  logging: false
});

const check = async () => {
    try {
        const [results] = await sequelize.query("SELECT * FROM MenuItems;");
        console.log('--- MenuItems ---');
        console.log(JSON.stringify(results, null, 2));
        
        const [res] = await sequelize.query("SELECT * FROM Restaurants;");
        console.log('--- Restaurants ---');
        console.log(JSON.stringify(res, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();

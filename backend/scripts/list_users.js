const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../local_dev.sqlite'),
  logging: false
});

const listUsers = async () => {
    try {
        const [results] = await sequelize.query("SELECT id, name, phone, role FROM Users;");
        console.log('--- Users in Database ---');
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Database Error:', err.message);
        process.exit(1);
    }
};

listUsers();

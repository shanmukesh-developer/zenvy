/* eslint-disable */
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../local_dev.sqlite'),
  logging: false
});

const deleteUser = async (phone) => {
    if (!phone) {
        console.error('Usage: node delete_user.js <phone_number>');
        process.exit(1);
    }
    try {
        const [results] = await sequelize.query(`DELETE FROM Users WHERE phone = '${phone}';`);
        console.log(`--- Deleted User with Phone: ${phone} ---`);
        process.exit(0);
    } catch (err) {
        console.error('Database Error:', err.message);
        process.exit(1);
    }
};

const phoneToDelete = process.argv[2];
deleteUser(phoneToDelete);

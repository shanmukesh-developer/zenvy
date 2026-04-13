require('dotenv').config();
const { Sequelize } = require('sequelize'); 
const s = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres', 
  dialectOptions: {ssl: {require: true, rejectUnauthorized: false}}, 
  logging: false
}); 

s.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'DeliveryPartners' AND column_name = 'currentOrderId';`)
  .then(res => { console.log(res[0]); process.exit(0); })
  .catch(console.error);

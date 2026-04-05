require('dotenv').config();
const { connectDB } = require('./config/db');
const { getOrderModel } = require('./models/Order');

const clearOrders = async () => {
  await connectDB();
  const Order = getOrderModel();
  
  await Order.destroy({ where: {} });
  console.log('--- ALL HISTORICAL DUMMY ORDERS DESTROYED IN REAL-TIME ---');
  process.exit();
};

clearOrders().catch((err) => {
  console.error(err);
  process.exit(1);
});

const { connectDB, getSequelize } = require('./config/db');
const { initOrderModel, getOrderModel } = require('./models/Order');

async function check() {
  await connectDB();
  const Order = getOrderModel() || initOrderModel(getSequelize());
  const orders = await Order.findAll({ limit: 5 });
  console.log('--- Orders in DB ---');
  orders.forEach(o => {
    console.log(`ID: ${o.id}, Total: ${o.totalPrice}, Final: ${o.finalPrice}, Status: ${o.status}`);
  });
  process.exit(0);
}

check();

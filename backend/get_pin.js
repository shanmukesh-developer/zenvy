const { getOrderModel } = require('./models/Order');
const { connectDB } = require('./config/db');
const dotenv = require('dotenv');
dotenv.config();

async function getPin() {
  await connectDB();
  const Order = getOrderModel();
  const order = await Order.findOne({ order: [['createdAt', 'DESC']] });
  if (order) {
    console.log("PIN:", order.deliveryPin, "ID:", order.id, "STATUS:", order.status);
  } else {
    console.log("No orders found");
  }
  process.exit(0);
}
getPin();

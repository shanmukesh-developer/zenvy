require('dotenv').config();
const { connectDB } = require('./config/db');
const { getOrderModel } = require('./models/Order');

const run = async () => {
    await connectDB();
    const Order = getOrderModel();
    const orders = await Order.findAll({ order: [['createdAt', 'DESC']] });
    console.log(`Found ${orders.length} orders.`);
    if(orders.length > 0) {
        console.log("Latest:", orders[0].toJSON());
    }
    process.exit();
}
run();

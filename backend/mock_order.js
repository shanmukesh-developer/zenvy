const { Sequelize, DataTypes } = require('sequelize');

async function mockOrder() {
  console.log('Connecting to database to mock an order...');
  try {
    const sequelize = new Sequelize('postgresql://hostelbites_backend_user:t439r68H2iP06pZixkM5fB1TzMmsO809@dpg-csvvugq3esus73eb5l90-a.oregon-postgres.render.com/hostelbites_backend', {
      dialect: 'postgres',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: false
    });
    
    await sequelize.authenticate();
    
    const Order = sequelize.define('Order', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      restaurantId: { type: DataTypes.STRING },
      items: { type: DataTypes.JSONB },
      totalPrice: { type: DataTypes.FLOAT },
      status: { type: DataTypes.STRING, defaultValue: 'Pending' }
    });

    // We just create a dummy order for testing the restaurant app
    // In restaurant-mobile, DashboardScreen fetches orders by restaurant ID
    const mockOrder = await Order.create({
      restaurantId: 'MOCK_REST_01', // We can use a dummy ID or a real one
      totalPrice: 450,
      status: 'Pending',
      items: [
        { name: 'Chicken Biryani', quantity: 2, price: 150 },
        { name: 'Paneer Butter Masala', quantity: 1, price: 150 }
      ]
    });

    console.log('Mock Order Created successfully!');
    console.log(mockOrder.toJSON());
    process.exit(0);
  } catch (err) {
    console.error('Error mocking order:', err);
    process.exit(1);
  }
}

mockOrder();

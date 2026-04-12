const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const dbPath = './local_dev.sqlite';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

const Restaurant = sequelize.define('Restaurant', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  location: { type: DataTypes.STRING, allowNull: false },
  imageUrl: { type: DataTypes.STRING },
  rating: { type: DataTypes.FLOAT, defaultValue: 0 },
  deliveryTime: { type: DataTypes.INTEGER, defaultValue: 30 },
  commissionRate: { type: DataTypes.FLOAT, defaultValue: 15.0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  isOffline: { type: DataTypes.BOOLEAN, defaultValue: false },
  password: { type: DataTypes.STRING }
});

const MenuItem = sequelize.define('MenuItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  restaurantId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.FLOAT, allowNull: false },
  imageUrl: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING, defaultValue: 'Main Course' },
  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
  tags: { type: DataTypes.JSON, defaultValue: [] }
});

async function run() {
  await sequelize.authenticate();
  const resId = '11111111-1111-1111-1111-111111111111';
  
  // Destroy if exists
  await Restaurant.destroy({ where: { id: resId } });
  await MenuItem.destroy({ where: { name: 'Cosmic Pizza' } });

  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('agent123', salt);

  await Restaurant.create({
    id: resId,
    name: 'Agentic Pizzeria',
    location: 'Cyber Hub',
    password: password
  });

  await MenuItem.create({
    restaurantId: resId,
    name: 'Cosmic Pizza',
    description: 'A pizza from outer space',
    price: 499,
    category: 'Pizza'
  });

  console.log(`✅ Agentic Pizzeria created! ID: ${resId}, PW: agent123`);
  process.exit(0);
}

run().catch(console.error);

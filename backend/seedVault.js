const { Sequelize } = require('sequelize');
const { initVaultItemModel } = require('./models/VaultItem');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, './local_dev.sqlite'),
  logging: false
});

const VaultItem = initVaultItemModel(sequelize);

const seedVault = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });

    // Clear existing vault items
    await VaultItem.destroy({ where: {} });

    const items = [
      {
        name: 'Silver Origin Coffee',
        price: 149,
        originalPrice: 499,
        remainingCount: 5,
        imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?q=80&w=800&auto=format&fit=crop',
        isActive: true,
        streakRequirement: 3
      },
      {
        name: 'Elite Cyber Membership',
        price: 199,
        originalPrice: 999,
        remainingCount: 2,
        imageUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800&auto=format&fit=crop',
        isActive: true,
        streakRequirement: 7
      },
      {
        name: 'Golden Truffle Croissant',
        price: 89,
        originalPrice: 249,
        remainingCount: 8,
        imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=800&auto=format&fit=crop',
        isActive: true,
        streakRequirement: 0
      }
    ];

    await VaultItem.bulkCreate(items);
    console.log('✅ Zenvy Vault seeded with ultra-premium items!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed vault:', error);
    process.exit(1);
  }
};

seedVault();

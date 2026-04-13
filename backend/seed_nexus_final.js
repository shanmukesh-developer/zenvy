/* eslint-disable */
const dotenv = require('dotenv');
const path = require('path');
const { Sequelize } = require('sequelize');

dotenv.config({ path: path.join(__dirname, '.env') });

const { connectDB, getSequelize } = require('./config/db');

const seed = async () => {
  try {
    await connectDB();
    const sequelize = getSequelize();
    const { 
      User, Restaurant, MenuItem, Order, DeliveryPartner, VaultItem 
    } = sequelize.models;

    console.log('--- Clearing Database ---');
    await VaultItem.destroy({ where: {} });
    await Order.destroy({ where: {} });
    await MenuItem.destroy({ where: {} });
    await Restaurant.destroy({ where: {} });
    await DeliveryPartner.destroy({ where: {} });
    await User.destroy({ where: {} });

    console.log('--- Seeding Hyper-Fidelity Users ---');
    const u1 = await User.create({
      name: "Sanya Gupta", phone: "9123456789", password: "password123",
      role: 'student', walletBalance: 2500, streakCount: 15, isElite: true,
      profileImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      dietaryPreference: "Veg", address: "GH-2, Room 105, SRM AP"
    });

    console.log('--- Seeding Respected Assets ---');
    const categoryAssets = {
        'Biryani': ['https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800'],
        'Stationary': ['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800'],
        'Rental': ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800'],
        'Pharmacy': ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800'],
        'Laundry': ['https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=800'],
        'Gym': ['https://images.unsplash.com/photo-1593095191070-9a7011ec687c?w=800'],
        'Drinks': ['https://images.unsplash.com/photo-1563223771-5fe4038fbfc9?w=800'],
        'Sweets': ['https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=800'],
        'Fruits': ['https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800']
    };

    const categories = Object.keys(categoryAssets);
    const createdRestaurants = [];

    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const res = await Restaurant.create({
            name: `Elite ${cat} Node`,
            location: `Nexus Mall Block ${i+1}`,
            lat: 16.50 + (i * 0.005),
            lon: 80.60 + (i * 0.015), // Vary longitude more for distance diffs
            zone: 'Amaravathi_Central',
            imageUrl: categoryAssets[cat][0],
            rating: (3.8 + (i % 4)*0.4).toFixed(1), // Ratings 3.8, 4.2, 4.6, 5.0
            isActive: true,
            tags: [cat.toLowerCase(), 'premium']
        });
        createdRestaurants.push(res);

        for (let j = 1; j <= 5; j++) {
            // Price diversity: 80, 200, 350, 550, 800
            const price = [80, 200, 350, 550, 800][j-1];
            const itemTags = [cat.toLowerCase(), 'respected'];
            if (j === 1) itemTags.push('jain', 'eggless');
            
            await MenuItem.create({
                name: `Master ${cat} ${j}`,
                price: price,
                restaurantId: res.id,
                category: cat,
                imageUrl: categoryAssets[cat][0],
                isAvailable: true,
                tags: itemTags,
                isVegetarian: j !== 5, // Item 5 is Non-Veg
                isEliteOnly: price > 500
            });
        }
    }

    console.log('--- Seeding Orders ---');
    await Order.create({
        userId: u1.id,
        restaurantId: createdRestaurants[0].id,
        items: JSON.stringify([{ name: "Master Biryani 1", price: 200, quantity: 1 }]),
        totalPrice: 200,
        deliveryFee: 40,
        finalPrice: 240,
        status: 'Delivered',
        paymentStatus: 'Completed',
        paymentMethod: 'UPI',
        deliverySlot: 'Standard',
        deliveryAddress: "GH-2, Room 105"
    });

    console.log('✅ DIVERSIFIED HYPER-FIDELITY SEEDING DONE!');
    process.exit(0);
  } catch (error) {
    console.error('❌ SEEDING FAILED:', error);
    process.exit(1);
  }
};

seed();

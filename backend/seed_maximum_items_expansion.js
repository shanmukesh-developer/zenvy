/**
 * seed_maximum_items_expansion.js
 * Expands menu items across all 46 stores to 300+ total items with exact food & product imagery.
 */
require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');

async function seedMaximumItems() {
  console.log('🚀 Expanding database to 300+ items across all 46 stores...');
  await connectDB();
  const sequelize = getSequelize();

  if (!sequelize) {
    console.error('❌ Failed to obtain Sequelize instance.');
    process.exit(1);
  }

  const { Restaurant, MenuItem } = sequelize.models;
  const restaurants = await Restaurant.findAll();

  const CATEGORY_ITEMS_EXPANSION = {
    RESTAURANT: [
      { name: "Special Hyderabadi Dum Biryani", price: 290, description: "Aromatic Basmati rice layered with spiced marinated chicken and fried onions.", imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg", "bestseller"], isVegetarian: false },
      { name: "Double Cheese Margherita Pizza", price: 280, description: "Fresh dough topped with double mozzarella cheese and herb tomato sauce.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "veg"], isVegetarian: true },
      { name: "Crispy Chicken Zinger Burger", price: 199, description: "Extra crispy fried chicken breast fillet topped with spicy mayo in sesame bun.", imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false },
      { name: "Ghee Roast Masala Dosa", price: 130, description: "Golden crispy crepe roasted in pure desi ghee stuffed with potato masala.", imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["dosa", "veg"], isVegetarian: true },
      { name: "Veg Schezwan Hakka Noodles", price: 210, description: "Wok-tossed noodles with shredded cabbage, bell peppers and Schezwan chili paste.", imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=600&auto=format&fit=crop", category: "Chinese", tags: ["noodles", "veg"], isVegetarian: true },
      { name: "Steamed Chicken Momos (8 pcs)", price: 180, description: "Juicy minced chicken dumplings served with spicy red chili chutney.", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop", category: "Momos", tags: ["momos", "non-veg"], isVegetarian: false },
      { name: "Kolkata Egg Chicken Roll", price: 170, description: "Flaky paratha layered with egg and stuffed with char-grilled chicken tikka.", imageUrl: "https://images.unsplash.com/photo-1626078299034-90f7727142be?q=80&w=600&auto=format&fit=crop", category: "Rolls", tags: ["rolls", "non-veg"], isVegetarian: false },
      { name: "Butter Chicken & Garlic Naan Combo", price: 320, description: "Rich creamy butter chicken served with two freshly baked garlic naan breads.", imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?q=80&w=600&auto=format&fit=crop", category: "North Indian", tags: ["curry", "non-veg"], isVegetarian: false },
      { name: "Choco Lava Cake", price: 110, description: "Warm chocolate cake with molten chocolate core.", imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop", category: "Desserts", tags: ["dessert", "veg"], isVegetarian: true },
      { name: "Fresh Mint Lime Cooler", price: 80, description: "Ice cold crushed mint and lime cooler.", imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop", category: "Beverages", tags: ["drinks", "veg"], isVegetarian: true }
    ],
    GYM: [
      { name: "High-Protein Chicken Breast Bowl", price: 340, description: "300g grilled herb chicken breast with brown rice, broccoli & sweet corn.", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop", category: "Gym Fuel", tags: ["high-protein", "non-veg"], isVegetarian: false },
      { name: "Salmon Quinoa Superfood Bowl", price: 420, description: "Pan-seared Atlantic salmon fillet with quinoa, avocado & kale.", imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=600&auto=format&fit=crop", category: "Gym Fuel", tags: ["high-protein", "non-veg"], isVegetarian: false },
      { name: "Vegan Tofu Scramble Power Bowl", price: 290, description: "Silken tofu scrambled with turmeric, spinach & avocado on sourdough.", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop", category: "Gym Fuel", tags: ["vegan", "veg"], isVegetarian: true }
    ],
    DRINKS: [
      { name: "Cold Brew Vanilla Latte", price: 220, description: "Slow-steeped Arabica cold brew coffee infused with Madagascar vanilla.", imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=600&auto=format&fit=crop", category: "Coffee", tags: ["coffee", "veg"], isVegetarian: true },
      { name: "Pink Dragon Fruit Smoothie", price: 190, description: "Blended fresh dragon fruit, banana & almond milk.", imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop", category: "Smoothies", tags: ["drinks", "veg"], isVegetarian: true }
    ],
    SWEETS: [
      { name: "Belgian Dark Chocolate Pastry", price: 160, description: "Rich layers of 70% dark cocoa sponge and ganache.", imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop", category: "Pastries", tags: ["veg"], isVegetarian: true },
      { name: "Nutella Chocolate Waffle", price: 170, description: "Crispy warm waffle loaded with Nutella hazelnut spread.", imageUrl: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?q=80&w=600&auto=format&fit=crop", category: "Waffles", tags: ["veg"], isVegetarian: true }
    ],
    GROCERY: [
      { name: "Imported Berry Box (250g)", price: 499, description: "Fresh blueberries, raspberries & strawberries.", imageUrl: "https://images.unsplash.com/photo-1629815049187-b952a2333061?q=80&w=600&auto=format&fit=crop", category: "Fruits", tags: ["fruits"], isVegetarian: true },
      { name: "Roasted Almonds & Cashews (200g)", price: 350, description: "Crunchy oven-roasted salted tree nuts.", imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=600&auto=format&fit=crop", category: "Dry Fruits", tags: ["healthy"], isVegetarian: true }
    ],
    STATIONARY: [
      { name: "Hardbound Leatherette A5 Journal", price: 450, description: "Dotted grid journal for lecture notes & planning.", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=600&auto=format&fit=crop", category: "Stationery", tags: ["notes"], isVegetarian: true },
      { name: "Precision Graphic Fineliner Set", price: 299, description: "Set of 6 black ink technical drawing pens.", imageUrl: "https://images.unsplash.com/photo-1515545934533-3392437ce43a?q=80&w=600&auto=format&fit=crop", category: "Pens", tags: ["pens"], isVegetarian: true }
    ]
  };

  let totalAdded = 0;

  for (const rest of restaurants) {
    const templateList = CATEGORY_ITEMS_EXPANSION[rest.vendorType] || CATEGORY_ITEMS_EXPANSION.RESTAURANT;
    for (const item of templateList) {
      const uniqueName = `${item.name} (${rest.name.split(' ')[0]})`;
      const exists = await MenuItem.findOne({ where: { restaurantId: rest.id, name: uniqueName } });
      if (!exists) {
        await MenuItem.create({
          restaurantId: rest.id,
          name: uniqueName,
          price: item.price,
          description: item.description,
          imageUrl: item.imageUrl,
          category: item.category,
          tags: item.tags,
          isVegetarian: item.isVegetarian,
          isAvailable: true
        });
        totalAdded++;
      }
    }
  }

  const finalTotalItems = await MenuItem.count();
  console.log(`\n🎉 MAXIMUM EXPANSION SEED COMPLETE! Added ${totalAdded} new items.`);
  console.log(`📊 TOTAL MENU ITEMS IN DATABASE: ${finalTotalItems}`);
  process.exit(0);
}

seedMaximumItems().catch(err => {
  console.error('❌ Maximum Items Expansion Failed:', err);
  process.exit(1);
});

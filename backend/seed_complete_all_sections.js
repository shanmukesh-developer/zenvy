/**
 * seed_complete_all_sections.js
 * Populates Community Posts, Vault Secret Items, Birthday Celebrations, and Ensures Every Single Store Has Full Menu & High-Res Unsplash Images.
 */
require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');

async function seedAllSections() {
  console.log('🚀 Seeding Community Posts, Zenvy Vault Items, Birthdays & Full Menu Images...');
  await connectDB();
  const sequelize = getSequelize();

  if (!sequelize) {
    console.error('❌ Failed to obtain Sequelize instance.');
    process.exit(1);
  }

  const {
    User,
    Restaurant,
    MenuItem,
    CommunityPost,
    VaultItem,
    BirthdayCelebration,
    BirthdayWish
  } = sequelize.models;

  const admin = await User.findOne({ where: { role: 'admin' } });
  const student = await User.findOne({ where: { role: 'student' } }) || admin;

  // ── 1. COMMUNITY FEED POSTS & FOOD REVIEWS ─────────────────────
  console.log('💬 Seeding Community Feed Posts & Food Reviews...');
  const COMMUNITY_POSTS = [
    {
      userId: student.id,
      userName: student.name || 'Shanmukesh (SRM AP)',
      userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop',
      content: 'Just tried the Dum Mutton Biryani from Royal Biryani Handi at Gate 1. Absolutely incredible flavor and super juicy mutton pieces! Must try for biryani lovers 🌶️🔥',
      imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop',
      likes: 28,
      postType: 'review',
      starRating: 5.0,
      restaurantName: 'Royal Biryani Handi',
      productName: 'Dum Mutton Biryani'
    },
    {
      userId: admin.id,
      userName: 'Ananya Roy',
      userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop',
      content: 'Anyone heading to Vijayawada Railway Station tomorrow morning around 7 AM? Looking for a BikePool co-rider! 🏍️💨',
      imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800&auto=format&fit=crop',
      likes: 14,
      postType: 'post'
    },
    {
      userId: student.id,
      userName: 'Karthik Raja',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
      content: 'Lost a blue Boat Airdopes case near Central Library Floor 2. If anyone finds it, please reply or DM! 🎧',
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=800&auto=format&fit=crop',
      likes: 9,
      postType: 'post'
    },
    {
      userId: admin.id,
      userName: 'Preeti Sharma',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      content: 'Late night study fuel at Zenvy Juice Booth — Cold Brew Espresso keeps the energy 100%! ☕✨',
      imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop',
      likes: 35,
      postType: 'review',
      starRating: 4.8,
      restaurantName: 'Zenvy Juice & Smoothie Bar',
      productName: 'Cold Brew Espresso'
    }
  ];

  for (const post of COMMUNITY_POSTS) {
    const exists = await CommunityPost.findOne({ where: { content: post.content } });
    if (!exists) {
      await CommunityPost.create(post);
    }
  }
  console.log('✅ Community Feed Posts seeded.');

  // ── 2. ZENVY VAULT SECRET DEALS & PASSES ───────────────────────
  console.log('🕯️ Seeding Zenvy Vault Secret Items...');
  const VAULT_ITEMS = [
    {
      name: 'Midnight Craving Pass (Flat ₹100 Off)',
      price: 49,
      originalPrice: 150,
      remainingCount: 15,
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600&auto=format&fit=crop',
      streakRequirement: 3,
      isActive: true
    },
    {
      name: 'Free Artisan Coffee Voucher',
      price: 29,
      originalPrice: 220,
      remainingCount: 8,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop',
      streakRequirement: 5,
      isActive: true
    },
    {
      name: 'Zenvy Elite VIP Badge (1 Month)',
      price: 99,
      originalPrice: 299,
      remainingCount: 20,
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
      streakRequirement: 7,
      isActive: true
    },
    {
      name: 'Free Waffle Card - Belgian Waffle Co',
      price: 39,
      originalPrice: 170,
      remainingCount: 12,
      imageUrl: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?q=80&w=600&auto=format&fit=crop',
      streakRequirement: 4,
      isActive: true
    }
  ];

  if (VaultItem) {
    for (const vItem of VAULT_ITEMS) {
      const exists = await VaultItem.findOne({ where: { name: vItem.name } });
      if (!exists) {
        await VaultItem.create(vItem);
      }
    }
  }
  console.log('✅ Zenvy Vault Items seeded.');

  // ── 3. BIRTHDAY CELEBRATIONS ──────────────────────────────────
  console.log('🎂 Seeding Active Birthday Celebrations...');
  if (BirthdayCelebration) {
    const todayStr = new Date().toISOString().split('T')[0];
    let bday = await BirthdayCelebration.findOne({ where: { candidateName: 'Rahul Verma' } });
    if (!bday) {
      bday = await BirthdayCelebration.create({
        userId: student.id,
        candidateName: 'Rahul Verma',
        candidatePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
        birthdayDate: todayStr,
        status: 'approved',
        wishCount: 18,
        expiresAt: new Date(Date.now() + 86400000)
      });
    }

    if (BirthdayWish && bday) {
      await BirthdayWish.findOrCreate({
        where: { celebrationId: bday.id, senderUserId: admin.id },
        defaults: {
          senderName: 'Ananya Roy',
          message: 'Happy Birthday Rahul! Hope you have an awesome year ahead at SRM! 🎉🎂'
        }
      });
    }
  }
  console.log('✅ Birthday Celebrations seeded.');

  // ── 4. ENSURE ALL STORES HAVE FULL MENU & VALID IMAGES ─────────
  console.log('📷 Populating Full Menus for All 46 Stores...');
  const restaurants = await Restaurant.findAll();

  const GENERIC_MENU_TEMPLATES = {
    RESTAURANT: [
      { name: "Chef Special Combo Meal", price: 250, description: "Delicious balanced meal box with appetizer, main dish & refreshment.", imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop", category: "Combos", tags: ["combo", "popular"], isVegetarian: true },
      { name: "Crispy Paneer Starter", price: 180, description: "Golden fried cottage cheese marinated in aromatic house spices.", imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=600&auto=format&fit=crop", category: "Starters", tags: ["starter", "veg"], isVegetarian: true },
      { name: "Signature House Drink", price: 90, description: "Refreshing ice chilled beverage blend.", imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=600&auto=format&fit=crop", category: "Beverages", tags: ["drinks"], isVegetarian: true }
    ],
    GROCERY: [
      { name: "Organic Fresh Fruit Basket", price: 299, description: "Seasonal assorted organic fresh fruits.", imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=600&auto=format&fit=crop", category: "Fruits", tags: ["organic"], isVegetarian: true },
      { name: "Premium Dry Fruit Mix (250g)", price: 380, description: "Almonds, cashews, raisins, and walnuts mix.", imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=600&auto=format&fit=crop", category: "Dry Fruits", tags: ["healthy"], isVegetarian: true }
    ],
    STATIONARY: [
      { name: "Executive Hardbound Notebook", price: 199, description: "200 page premium ruled notebook for campus lectures.", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=600&auto=format&fit=crop", category: "Stationery", tags: ["notes"], isVegetarian: true },
      { name: "Metal Ballpoint Pen Set (Pack of 3)", price: 149, description: "Smooth writing liquid ink ballpoint pens.", imageUrl: "https://images.unsplash.com/photo-1515545934533-3392437ce43a?q=80&w=600&auto=format&fit=crop", category: "Pens", tags: ["pens"], isVegetarian: true }
    ]
  };

  for (const rest of restaurants) {
    const existingCount = await MenuItem.count({ where: { restaurantId: rest.id } });
    if (existingCount < 2) {
      const template = GENERIC_MENU_TEMPLATES[rest.vendorType] || GENERIC_MENU_TEMPLATES.RESTAURANT;
      for (const tItem of template) {
        await MenuItem.create({
          restaurantId: rest.id,
          name: `${tItem.name} - ${rest.name.split(' ')[0]}`,
          price: tItem.price,
          description: tItem.description,
          imageUrl: tItem.imageUrl,
          category: tItem.category,
          tags: tItem.tags,
          isVegetarian: tItem.isVegetarian,
          isAvailable: true
        });
      }
    }
  }

  const finalTotalItems = await MenuItem.count();
  const finalTotalPosts = await CommunityPost.count();
  const finalTotalVault = await VaultItem ? await VaultItem.count() : 0;

  console.log('\n🎉 ALL ECOSYSTEM SECTIONS SEEDED SUCCESSFULLY!');
  console.log(`📊 TOTAL STORES: ${restaurants.length}`);
  console.log(`📊 TOTAL MENU ITEMS: ${finalTotalItems}`);
  console.log(`📊 TOTAL COMMUNITY POSTS: ${finalTotalPosts}`);
  console.log(`📊 TOTAL VAULT DEALS: ${finalTotalVault}`);

  process.exit(0);
}

seedAllSections().catch(err => {
  console.error('❌ Seeding All Sections Failed:', err);
  process.exit(1);
});

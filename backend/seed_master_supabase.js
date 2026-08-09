/**
 * seed_master_supabase.js
 * Comprehensive Seeding Script for Zenvy / HostelBites
 * Seeds Users, Restaurants, MenuItems, PG Hostels & Rooms, BikePools, Wall Events, Submissions & Coupons.
 */
require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');

async function runMasterSeed() {
  console.log('🚀 Starting Zenvy Complete Database Seeding...');
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
    PGHostel,
    PGRoom,
    BikePool,
    WallEvent,
    WallSubmission,
    WallLike,
    Coupon
  } = sequelize.models;

  console.log('🧹 Clearing old data for a fresh, clean ecosystem...');
  try {
    if (WallLike) await WallLike.destroy({ where: {} });
    if (WallSubmission) await WallSubmission.destroy({ where: {} });
    if (WallEvent) await WallEvent.destroy({ where: {} });
    if (PGRoom) await PGRoom.destroy({ where: {} });
    if (PGHostel) await PGHostel.destroy({ where: {} });
    if (BikePool) await BikePool.destroy({ where: {} });
    if (Coupon) await Coupon.destroy({ where: {} });
    if (MenuItem) await MenuItem.destroy({ where: {} });
    if (Restaurant) await Restaurant.destroy({ where: {} });
  } catch (err) {
    console.warn('⚠️ Warning while clearing existing tables:', err.message);
  }

  // ── 1. USERS & ACCOUNTS ─────────────────────────────────
  console.log('👤 Seeding Users & Admin Accounts...');

  let adminUser = await User.findOne({ where: { phone: '9999999999' } });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Zenvy Super Admin',
      email: 'admin@zenvy.com',
      phone: '9999999999',
      password: 'admin123',
      role: 'admin',
      isElite: true,
      walletBalance: 5000,
      zenPoints: 2500,
      profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      hostelBlock: 'Block A (Admin Core)',
      roomNumber: 'A-101'
    });
  }

  let studentUser = await User.findOne({ where: { phone: '7777777777' } });
  if (!studentUser) {
    studentUser = await User.create({
      name: 'Shanmukesh (SRM AP)',
      email: 'shanmukesh@srm.edu.in',
      phone: '7777777777',
      password: 'student123',
      role: 'student',
      isElite: true,
      walletBalance: 1200,
      zenPoints: 650,
      profileImage: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop',
      hostelBlock: 'Hostel Block C',
      roomNumber: 'C-304',
      gender: 'Male'
    });
  }

  let studentUser2 = await User.findOne({ where: { phone: '6666666666' } });
  if (!studentUser2) {
    studentUser2 = await User.create({
      name: 'Ananya Roy',
      email: 'ananya@srm.edu.in',
      phone: '6666666666',
      password: 'student123',
      role: 'student',
      isElite: false,
      walletBalance: 800,
      zenPoints: 320,
      profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop',
      hostelBlock: 'Girls Block B',
      roomNumber: 'B-210',
      gender: 'Female'
    });
  }

  console.log('✅ Users seeded successfully.');

  // ── 2. RESTAURANTS & COMPLETE MENUS ──────────────────────
  console.log('🍕 Seeding 15+ Restaurants & Detailed Categories...');

  const RESTAURANTS_DATA = [
    {
      name: "Royal Biryani Handi", location: "Nexus Gate 1", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop",
      tags: ["restaurant", "food", "biryani", "popular"],
      menu: [
        { name: "Dum Mutton Biryani", price: 340, description: "Slow-cooked juicy goat meat layered with saffron Basmati rice.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg", "bestseller"], isVegetarian: false },
        { name: "Kolkata Chicken Biryani", price: 280, description: "Aromatic light chicken biryani cooked with egg and boiled potato.", imageUrl: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg"], isVegetarian: false },
        { name: "Paneer Dum Biryani", price: 240, description: "Marinated cottage cheese cubes dum-cooked in spiced rice.", imageUrl: "https://images.unsplash.com/photo-1642821373181-696a54913e93?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "veg"], isVegetarian: true },
        { name: "Mirchi Ka Salan (Gravy)", price: 80, description: "Traditional spicy peanut and sesame chili gravy side.", imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=600&auto=format&fit=crop", category: "Sides", tags: ["gravy", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Artisanal Pizza Lab", location: "Nexus Central", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
      tags: ["restaurant", "food", "pizza", "italian"],
      menu: [
        { name: "Italian Buffalo Margherita", price: 320, description: "San Marzano tomato sauce, fresh buffalo mozzarella, fresh basil.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "veg"], isVegetarian: true },
        { name: "Truffle Mushroom Pizza", price: 450, description: "Wild portobello mushrooms topped with black truffle drizzle.", imageUrl: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "premium"], isVegetarian: true },
        { name: "Pepperoni Supreme Pizza", price: 490, description: "Smoked beef & pepperoni slices with extra melted mozzarella.", imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "non-veg"], isVegetarian: false },
        { name: "Cheesy Garlic Doughballs", price: 160, description: "Freshly baked doughballs stuffed with garlic herb butter.", imageUrl: "https://images.unsplash.com/photo-1544982503-9f984c14501a?q=80&w=600&auto=format&fit=crop", category: "Sides", tags: ["sides", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "South Indian Soul", location: "Nexus Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1630383249896-424e482df921?q=80&w=800&auto=format&fit=crop",
      tags: ["restaurant", "food", "south-indian", "tiffin"],
      menu: [
        { name: "Ghee Roast Masala Dosa", price: 120, description: "Crispy golden dosa roasted in pure ghee filled with potato masala.", imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["south-indian", "veg", "bestseller"], isVegetarian: true },
        { name: "Steamed Button Idli (4 pcs)", price: 90, description: "Soft fluffy idlis served with coconut chutney & spicy sambar.", imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["south-indian", "veg"], isVegetarian: true },
        { name: "Authentic Filter Kaapi", price: 50, description: "Traditional brass filter brewed chicory coffee with frothy milk.", imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop", category: "Drinks", tags: ["coffee", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Burger Bunker", location: "Central Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop",
      tags: ["burgers", "fast-food"],
      menu: [
        { name: "Double Angus Jalapeño Burger", price: 380, description: "Flame-grilled double beef patties with melted cheddar & fiery jalapeños.", imageUrl: "https://images.unsplash.com/photo-1550317138-10000687ad32?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false },
        { name: "Classic Cheese Melt Burger", price: 290, description: "Triple cheese blend patty with caramelized onion jam.", imageUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "veg"], isVegetarian: true },
        { name: "Truffle Parmesan Fries", price: 170, description: "Crispy french fries tossed in truffle oil and grated parmesan.", imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=600&auto=format&fit=crop", category: "Sides", tags: ["fries", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Mandarin Magic", location: "Nexus Central Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=800&auto=format&fit=crop",
      tags: ["chinese", "asian"],
      menu: [
        { name: "Special Veg Hakka Noodles", price: 220, description: "Wok-tossed noodles with bell peppers, cabbage, and soy sauce.", imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=600&auto=format&fit=crop", category: "Chinese", tags: ["chinese", "veg"], isVegetarian: true },
        { name: "Chili Garlic Dry Chicken", price: 280, description: "Crispy tossed chicken morsels with scallions & burnt garlic.", imageUrl: "https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=600&auto=format&fit=crop", category: "Chinese", tags: ["chinese", "non-veg"], isVegetarian: false },
        { name: "Steamed Schezwan Momos (8 pcs)", price: 180, description: "Juicy vegetable dumplings served with hot Schezwan dip.", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop", category: "Momos", tags: ["chinese", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Roll Republic", location: "South Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626078299034-90f7727142be?q=80&w=800&auto=format&fit=crop",
      tags: ["rolls", "street-food"],
      menu: [
        { name: "Kolkata Egg Chicken Roll", price: 180, description: "Double egg washed paratha wrapped around spicy chicken tikka.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Rolls", tags: ["rolls", "non-veg"], isVegetarian: false },
        { name: "Paneer Tikka Mint Wrap", price: 150, description: "Smoky char-grilled paneer wrapped with crunchy onions & mint chutney.", imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?q=80&w=600&auto=format&fit=crop", category: "Rolls", tags: ["rolls", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Iron Kitchen: Elite Fuel", location: "Campus Gym Wing", vendorType: "GYM",
      imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop",
      tags: ["gym", "high-protein", "healthy"],
      menu: [
        { name: "Grilled Salmon Quinoa Bowl", price: 420, description: "Fresh Atlantic salmon with organic quinoa, avocado, and kale.", imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=600&auto=format&fit=crop", category: "Gym", tags: ["gym", "high-protein", "healthy"], isVegetarian: false },
        { name: "Vegan Tofu Power Scramble", price: 290, description: "Silken organic tofu scramble with turmeric, spinach, and sourdough toast.", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop", category: "Gym", tags: ["gym", "veg", "healthy"], isVegetarian: true }
      ]
    },
    {
      name: "Zenvy Juice & Smoothie Bar", location: "Central Plaza", vendorType: "DRINKS",
      imageUrl: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=800&auto=format&fit=crop",
      tags: ["drinks", "smoothies", "juices"],
      menu: [
        { name: "Pink Dragon Fruit Cooler", price: 180, description: "Cold-pressed pitaya fruit juice with fresh crushed mint and lime.", imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop", category: "Drinks", tags: ["drinks", "juices"], isVegetarian: true },
        { name: "12-Hour Cold Brew Espresso", price: 220, description: "Slow-steeped Arabica coffee served chilled over ice blocks.", imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=600&auto=format&fit=crop", category: "Drinks", tags: ["drinks", "coffee"], isVegetarian: true }
      ]
    },
    {
      name: "Bakehouse & Sweet Tooth", location: "Gate 2 Mall", vendorType: "SWEETS",
      imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=800&auto=format&fit=crop",
      tags: ["sweets", "bakery", "dessert"],
      menu: [
        { name: "Belgian Dark Chocolate Pastry", price: 160, description: "Rich layers of 70% dark cocoa sponge and ganache.", imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop", category: "Sweets", tags: ["bakery", "veg"], isVegetarian: true },
        { name: "Royal Saffron Rasmalai", price: 190, description: "Soft cottage cheese discs soaked in saffron cardamom milk.", imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=600&auto=format&fit=crop", category: "Sweets", tags: ["sweets", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "KFC Premium Franchise", location: "Nexus Gate 1", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop",
      tags: ["restaurant", "food", "burgers", "chicken", "premium"],
      brandTheme: {
        primaryColor: "#E4002B",
        secondaryColor: "#111111",
        accentColor: "#FFC72C",
        gradient: "linear-gradient(135deg, #E4002B 0%, #111111 100%)",
        fontColor: "#FFFFFF",
        logoAnimationType: "kfc-bucket-drop",
        logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/1200px-KFC_logo.svg.png"
      },
      menu: [
        { name: "KFC Zinger Burger", price: 199, description: "Signature crispy chicken fillet in sesame bun with mayo.", imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false },
        { name: "KFC 8pc Hot & Crispy Bucket", price: 649, description: "8 pieces of secret recipe hot and crispy fried chicken.", imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=600&auto=format&fit=crop", category: "Fried Chicken", tags: ["chicken", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Domino's Pizza Franchise", location: "Nexus Central", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
      tags: ["restaurant", "food", "pizza", "premium"],
      brandTheme: {
        primaryColor: "#006491",
        secondaryColor: "#E31B23",
        accentColor: "#006491",
        gradient: "linear-gradient(135deg, #006491 0%, #E31B23 100%)",
        fontColor: "#FFFFFF",
        logoAnimationType: "dominos-flip",
        logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Domino%27s_pizza_logo.svg/1200px-Domino%27s_pizza_logo.svg.png"
      },
      menu: [
        { name: "Domino's Cheese Burst Margherita", price: 299, description: "Oozing liquid cheese crust with rich tomato puree.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "veg"], isVegetarian: true },
        { name: "Domino's Choco Lava Cake", price: 109, description: "Freshly baked warm chocolate cake with liquid chocolate center.", imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop", category: "Desserts", tags: ["dessert", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Nexus E-Fleet Rentals", location: "Gate 1 Parking", vendorType: "RENTAL",
      imageUrl: "https://images.unsplash.com/photo-1614165939096-45ef13bcbc0e?q=80&w=800&auto=format&fit=crop",
      tags: ["rental", "ebike"],
      menu: [
        { name: "Nexus E-Bike Pro (2-Hour Pass)", price: 100, description: "High-speed electric bike rental for fast campus commute.", imageUrl: "https://images.unsplash.com/photo-1593764592116-bfb2a97c642a?q=80&w=600&auto=format&fit=crop", category: "Rental", tags: ["rental", "ebike"], isVegetarian: true },
        { name: "Electric Skate X Full Day Pass", price: 250, description: "All-day access to electric board with safety helmet.", imageUrl: "https://images.unsplash.com/photo-1547444801-f99a9f60e392?q=80&w=600&auto=format&fit=crop", category: "Rental", tags: ["rental", "skate"], isVegetarian: true }
      ]
    }
  ];

  for (const rData of RESTAURANTS_DATA) {
    const rest = await Restaurant.create({
      name: rData.name,
      location: rData.location,
      imageUrl: rData.imageUrl,
      vendorType: rData.vendorType,
      commissionRate: 10,
      commissionType: 'percentage',
      operatingHours: JSON.stringify({ start: '08:00', end: '23:59' }),
      isActive: true,
      tags: JSON.stringify(rData.tags),
      rating: (Math.random() * (5.0 - 4.5) + 4.5).toFixed(1),
      time: "15-30 min",
      brandTheme: rData.brandTheme ? rData.brandTheme : null
    });

    for (let i = 0; i < rData.menu.length; i++) {
      const item = rData.menu[i];
      await MenuItem.create({
        restaurantId: rest.id,
        name: item.name,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        category: item.category,
        tags: item.tags || [],
        isVegetarian: item.isVegetarian !== undefined ? item.isVegetarian : true,
        isAvailable: true,
        isEliteOnly: i === 1
      });
    }
  }
  console.log(`✅ Seeded ${RESTAURANTS_DATA.length} Stores & Restaurants.`);

  // ── 3. PG HOSTELS & ROOMS ──────────────────────────────
  console.log('🏠 Seeding PG Hostels & Rooms...');
  if (PGHostel && PGRoom) {
    const boysPG = await PGHostel.create({
      ownerId: adminUser.id,
      name: 'Zenvy Premium Boys Hostel',
      address: 'Near SRM AP Gate 1, Neerukonda, Amaravathi',
      distanceFromCollege: 0.4,
      genderType: 'Boys',
      baseRent: 7500,
      securityDeposit: 15000,
      totalRooms: 20,
      amenities: ['High-Speed WiFi', 'AC Rooms', 'Washing Machine', 'Daily Housekeeping', 'Power Backup', 'Gym', 'Common Lounge', 'CCTV Security'],
      images: [
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=800&auto=format&fit=crop'
      ],
      description: 'Luxury AC hostel specifically built for SRM students. Walkable distance from Gate 1 with top-notch security & mess hall.'
    });

    await PGRoom.create({
      hostelId: boysPG.id,
      roomNumber: '101-A',
      roomType: 'Single AC',
      capacity: 1,
      availableBeds: 1,
      rentPerMonth: 12000,
      securityDeposit: 15000,
      amenities: ['Private Washroom', 'AC', 'Study Table', 'Balcony'],
      furnishing: 'Fully Furnished',
      hasAttachedBathroom: true,
      hasAC: true,
      hasBalcony: true
    });

    await PGRoom.create({
      hostelId: boysPG.id,
      roomNumber: '102-B',
      roomType: 'Double Sharing AC',
      capacity: 2,
      availableBeds: 2,
      rentPerMonth: 7500,
      securityDeposit: 10000,
      amenities: ['Attached Washroom', 'AC', 'Twin Beds'],
      furnishing: 'Fully Furnished',
      hasAttachedBathroom: true,
      hasAC: true
    });

    const girlsPG = await PGHostel.create({
      ownerId: adminUser.id,
      name: 'Starlight Girls Residence',
      address: 'SRM-VIT Connecting Road, Inavolu, Amaravathi',
      distanceFromCollege: 0.8,
      genderType: 'Girls',
      baseRent: 8500,
      securityDeposit: 12000,
      totalRooms: 15,
      amenities: ['24/7 Security CCTV', 'Biometric Entry', 'Gym', 'Attached Washroom', 'Study Room', 'In-house Nurse'],
      images: [
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop'
      ],
      description: 'Safe & modern residence for female students with 24/7 warden guard & biometric access.'
    });

    await PGRoom.create({
      hostelId: girlsPG.id,
      roomNumber: 'G-201',
      roomType: 'Single Luxury Suite',
      capacity: 1,
      availableBeds: 1,
      rentPerMonth: 13500,
      securityDeposit: 15000,
      furnishing: 'Fully Furnished',
      hasAttachedBathroom: true,
      hasAC: true,
      hasBalcony: true
    });
  }
  console.log('✅ Seeded PG Hostels & Rooms.');

  // ── 4. BIKE POOL / RIDE SHARING ──────────────────────────
  console.log('🏍️ Seeding Co-Ride Bike Pool listings...');
  if (BikePool) {
    await BikePool.create({
      creatorId: studentUser.id,
      origin: 'SRM AP Gate 1',
      destination: 'Vijayawada Railway Station',
      departureTime: new Date(Date.now() + 3600000 * 3), // in 3 hours
      estimatedCost: 80,
      vehicleModel: 'Hero Splendor Plus (AP 16 XX 4321)',
      vehicleType: 'Bike',
      availableSeats: 1,
      notes: 'Heading to catch train. Helmets provided.',
      rideVibe: 'Music Lover',
      autoApprove: true,
      status: 'OPEN'
    });

    await BikePool.create({
      creatorId: studentUser2.id,
      origin: 'SRM Girls Hostel Block B',
      destination: 'PVP Square Mall, Vijayawada',
      departureTime: new Date(Date.now() + 3600000 * 6),
      estimatedCost: 120,
      vehicleModel: 'TVS Jupiter 125',
      vehicleType: 'Scooty',
      availableSeats: 1,
      notes: 'Weekend shopping trip. Girls only preference.',
      rideVibe: 'Chill Talk',
      autoApprove: false,
      status: 'OPEN'
    });
  }
  console.log('✅ Seeded BikePools.');

  // ── 5. WALL EVENT & HALL OF FAME SUBMISSIONS ────────────
  console.log('📸 Seeding The Wall Event & Photo Submissions...');
  if (WallEvent && WallSubmission) {
    const wallEvent = await WallEvent.create({
      title: 'SRM Campus Life Photo Contest 2026',
      description: 'Capture the finest sunset, hostel vibe, or campus moments at SRM AP! Top voted photo wins ₹500 food coupon!',
      bannerText: '📸 SHOWCASE YOUR CAMPUS VIBES & WIN A ₹500 COUPON!',
      bannerGradient: 'fire',
      couponCode: 'WALLWIN500',
      couponValue: 500,
      status: 'ACTIVE',
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000 * 7) // 7 days from now
    });

    await WallSubmission.create({
      eventId: wallEvent.id,
      userId: studentUser.id,
      photoUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop',
      caption: 'Sunset hues behind the SRM Central Library 🌅',
      likeCount: 42,
      isApproved: true
    });

    await WallSubmission.create({
      eventId: wallEvent.id,
      userId: studentUser2.id,
      photoUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop',
      caption: 'Late night study & chai sessions at Hostel Block B ☕✨',
      likeCount: 29,
      isApproved: true
    });
  }
  console.log('✅ Seeded The Wall Event & Submissions.');

  // ── 6. COUPONS ──────────────────────────────────────────
  console.log('🏷️ Seeding Discount Coupons...');
  if (Coupon) {
    await Coupon.create({
      code: 'WELCOME50',
      discountPercentage: 50,
      maxDiscount: 100,
      minOrderAmount: 150,
      isActive: true,
      description: '50% off on your first Zenvy order'
    });

    await Coupon.create({
      code: 'ZENVYELITE',
      discountPercentage: 20,
      maxDiscount: 200,
      minOrderAmount: 300,
      isActive: true,
      description: 'Flat 20% off for Zenvy Elite Pass Holders'
    });
  }
  console.log('✅ Seeded Coupons.');

  console.log('\n🎉 ALL DATA SEEDED SUCCESSFULLY TO SUPABASE POSTGRESQL DATABASE!');
  process.exit(0);
}

runMasterSeed().catch(err => {
  console.error('❌ Master Seeding Failed:', err);
  process.exit(1);
});

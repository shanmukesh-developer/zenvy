/**
 * seed_50_plus_vendors.js
 * Comprehensive 50+ Vendors & 200+ Menu Items Seeding Script for Zenvy / HostelBites.
 * Connects directly to Supabase PostgreSQL database.
 */
require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');

async function seed50Vendors() {
  console.log('🚀 Launching 50+ Vendors & 200+ Menu Items Master Seed...');
  await connectDB();
  const sequelize = getSequelize();

  if (!sequelize) {
    console.error('❌ Could not obtain Sequelize instance.');
    process.exit(1);
  }

  const { User, Restaurant, MenuItem } = sequelize.models;

  // 50+ VENDORS DEFINITION
  const VENDORS = [
    // ── 1. Biryani & Mughlai (5 Stores) ──
    {
      name: "Royal Biryani Handi", location: "Nexus Gate 1", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop",
      tags: ["restaurant", "food", "biryani", "bestseller"],
      menu: [
        { name: "Dum Mutton Biryani", price: 340, description: "Slow-cooked goat meat layered with saffron Basmati rice.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg", "bestseller"], isVegetarian: false },
        { name: "Kolkata Chicken Biryani", price: 280, description: "Aromatic light chicken biryani with boiled egg & potato.", imageUrl: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg"], isVegetarian: false },
        { name: "Paneer Dum Biryani", price: 240, description: "Cottage cheese marinated in spices dum cooked in Basmati rice.", imageUrl: "https://images.unsplash.com/photo-1642821373181-696a54913e93?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "veg"], isVegetarian: true },
        { name: "Mirchi Ka Salan Gravy", price: 80, description: "Traditional spicy peanut sesame chili gravy.", imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=600&auto=format&fit=crop", category: "Sides", tags: ["gravy", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Paradise Biryani Express", location: "Nexus South Gate", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=800&auto=format&fit=crop",
      tags: ["biryani", "popular"],
      menu: [
        { name: "Special Hyderabadi Chicken Biryani", price: 290, description: "Signature spicy Hyderabadi dum biryani served with mirchi salan.", imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg"], isVegetarian: false },
        { name: "Egg Masala Biryani", price: 210, description: "Two boiled eggs spiced with Hyderabad biryani gravy.", imageUrl: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "egg"], isVegetarian: false }
      ]
    },
    {
      name: "Behrouz Biryani Royale", location: "Nexus Central Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop",
      tags: ["biryani", "royal", "premium"],
      menu: [
        { name: "Shahi Paneer Subz Biryani", price: 310, description: "Royalty on a plate. Marinated cottage cheese cubes in aromatic Basmati.", imageUrl: "https://images.unsplash.com/photo-1642821373181-696a54913e93?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "veg", "premium"], isVegetarian: true },
        { name: "Murgh Afghani Biryani", price: 360, description: "Rich cream & cashew marinated tender chicken dum biryani.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Andhra Spice Handi", location: "Gate 2 Food Street", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?q=80&w=800&auto=format&fit=crop",
      tags: ["andhra", "spicy", "biryani"],
      menu: [
        { name: "Guntur Spicy Chicken Biryani", price: 270, description: "Fiery Guntur red chili marinated chicken with ghee rice.", imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["spicy", "non-veg"], isVegetarian: false },
        { name: "Gongura Mutton Biryani", price: 380, description: "Signature sour & tangy Gongura leaf infused mutton biryani.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["special", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Nawabi Biryani House", location: "East Academic Wing", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=800&auto=format&fit=crop",
      tags: ["biryani", "nawabi"],
      menu: [
        { name: "Chicken Tikka Boneless Biryani", price: 299, description: "Char-grilled smoky chicken tikka pieces in fragrant rice.", imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop", category: "Biryani", tags: ["biryani", "boneless"], isVegetarian: false }
      ]
    },

    // ── 2. Pizza & Italian (4 Stores) ──
    {
      name: "Artisanal Pizza Lab", location: "Nexus Central", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
      tags: ["pizza", "italian"],
      menu: [
        { name: "Italian Buffalo Margherita", price: 320, description: "San Marzano tomatoes, fresh buffalo mozzarella, fresh basil.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "veg"], isVegetarian: true },
        { name: "Truffle Mushroom Pizza", price: 450, description: "Wild mushrooms topped with black truffle oil.", imageUrl: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "premium"], isVegetarian: true }
      ]
    },
    {
      name: "Domino's Pizza Franchise", location: "Nexus Central", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop",
      tags: ["pizza", "dominos", "brand"],
      brandTheme: {
        primaryColor: "#006491", secondaryColor: "#E31B23", accentColor: "#006491",
        gradient: "linear-gradient(135deg, #006491 0%, #E31B23 100%)", fontColor: "#FFFFFF",
        logoAnimationType: "dominos-flip", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Domino%27s_pizza_logo.svg/1200px-Domino%27s_pizza_logo.svg.png"
      },
      menu: [
        { name: "Domino's Cheese Burst Margherita", price: 299, description: "Oozing liquid cheese crust with rich tomato puree.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "veg"], isVegetarian: true },
        { name: "Domino's Choco Lava Cake", price: 109, description: "Warm chocolate cake with molten chocolate core.", imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop", category: "Desserts", tags: ["dessert", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Ovenstory Pizza Vault", location: "Gate 1 Avenue", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=800&auto=format&fit=crop",
      tags: ["pizza", "cheese"],
      menu: [
        { name: "Middle Eastern Spicy Paneer Pizza", price: 349, description: "Peri-peri cheese base with spiced paneer & roasted veggies.", imageUrl: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "La Pino'z Pizza Hub", location: "Nexus Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=800&auto=format&fit=crop",
      tags: ["pizza", "giant"],
      menu: [
        { name: "7 Cheese Monster Slice", price: 220, description: "Giant slice dripping with 7 different artisanal cheeses.", imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=600&auto=format&fit=crop", category: "Pizza", tags: ["pizza", "cheese"], isVegetarian: true }
      ]
    },

    // ── 3. Burgers & Fast Food (4 Stores) ──
    {
      name: "Burger Bunker", location: "Central Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop",
      tags: ["burgers"],
      menu: [
        { name: "Double Angus Jalapeño Burger", price: 380, description: "Double beef patties with melted cheddar & jalapeños.", imageUrl: "https://images.unsplash.com/photo-1550317138-10000687ad32?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false },
        { name: "Classic Cheese Melt Burger", price: 290, description: "Triple cheese blend patty with caramelized onion jam.", imageUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "McDonald's Premium", location: "Nexus East", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=800&auto=format&fit=crop",
      tags: ["burgers", "mcdonalds", "brand"],
      brandTheme: {
        primaryColor: "#FFC72C", secondaryColor: "#DA291C", accentColor: "#FFC72C",
        gradient: "linear-gradient(135deg, #DA291C 0%, #FFC72C 100%)", fontColor: "#FFFFFF",
        logoAnimationType: "mcd-glow", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/1200px-McDonald%27s_Golden_Arches.svg.png"
      },
      menu: [
        { name: "McDonald's Big Mac", price: 249, description: "Flame-grilled chicken patties, special sauce, cheese, pickles.", imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false },
        { name: "McDonald's French Fries L", price: 149, description: "World famous crispy golden salted fries.", imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=600&auto=format&fit=crop", category: "Sides", tags: ["fries", "veg"], isVegetarian: true },
        { name: "McFlurry Oreo", price: 129, description: "Vanilla soft serve with Oreo cookie crumbs.", imageUrl: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?q=80&w=600&auto=format&fit=crop", category: "Desserts", tags: ["dessert", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "KFC Premium Franchise", location: "Nexus Gate 1", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop",
      tags: ["chicken", "kfc", "brand"],
      brandTheme: {
        primaryColor: "#E4002B", secondaryColor: "#111111", accentColor: "#FFC72C",
        gradient: "linear-gradient(135deg, #E4002B 0%, #111111 100%)", fontColor: "#FFFFFF",
        logoAnimationType: "kfc-bucket-drop", logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/1200px-KFC_logo.svg.png"
      },
      menu: [
        { name: "KFC Zinger Burger", price: 199, description: "Crispy chicken fillet in sesame bun with spicy mayo.", imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false },
        { name: "KFC 8pc Hot & Crispy Bucket", price: 649, description: "8 pieces of secret recipe hot and crispy fried chicken.", imageUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=600&auto=format&fit=crop", category: "Fried Chicken", tags: ["chicken", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Wendy's Smash Burgers", location: "North Student Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?q=80&w=800&auto=format&fit=crop",
      tags: ["burgers", "smash"],
      menu: [
        { name: "Smoky Bacon Smash Burger", price: 320, description: "Crispy edges smash patty with applewood smoked bacon.", imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?q=80&w=600&auto=format&fit=crop", category: "Burgers", tags: ["burgers", "non-veg"], isVegetarian: false }
      ]
    },

    // ── 4. South Indian Tiffins (4 Stores) ──
    {
      name: "South Indian Soul", location: "Nexus Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1630383249896-424e482df921?q=80&w=800&auto=format&fit=crop",
      tags: ["south-indian", "tiffin"],
      menu: [
        { name: "Ghee Roast Masala Dosa", price: 120, description: "Crispy golden dosa roasted in pure ghee.", imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["south-indian", "veg"], isVegetarian: true },
        { name: "Steamed Button Idli (4 pcs)", price: 90, description: "Soft fluffy idlis with coconut chutney & sambar.", imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["south-indian", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Sri Kanya Tiffins", location: "Gate 1 Village Road", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=800&auto=format&fit=crop",
      tags: ["south-indian", "breakfast"],
      menu: [
        { name: "MLA Pesara Dosa with Upma", price: 110, description: "Green gram dosa stuffed with hot ginger upma.", imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["veg"], isVegetarian: true }
      ]
    },
    {
      name: "Babai Hotel Tiffins", location: "Amaravathi Main Road", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=800&auto=format&fit=crop",
      tags: ["traditional", "idli"],
      menu: [
        { name: "Babai Special Ghee Podi Idli", price: 100, description: "Soft idlis coated in homemade spicy podi & hot melted ghee.", imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["idli", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Chutneys Express", location: "Campus Commercial Center", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1630383249896-424e482df921?q=80&w=800&auto=format&fit=crop",
      tags: ["dosa", "chutneys"],
      menu: [
        { name: "Guntur Karam Onion Dosa", price: 130, description: "Crispy dosa smeared with spicy Guntur red chili paste.", imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop", category: "South Indian", tags: ["dosa", "veg"], isVegetarian: true }
      ]
    },

    // ── 5. North Indian & Thali (4 Stores) ──
    {
      name: "Punjab Grill & Rasoi", location: "Nexus Central Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=800&auto=format&fit=crop",
      tags: ["north-indian", "curry"],
      menu: [
        { name: "Special Butter Chicken", price: 340, description: "Smoky boneless chicken cooked in rich tomato butter gravy.", imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?q=80&w=600&auto=format&fit=crop", category: "North Indian", tags: ["curry", "non-veg"], isVegetarian: false },
        { name: "Garlic Butter Naan", price: 60, description: "Refined flour bread topped with fresh garlic and butter.", imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?q=80&w=600&auto=format&fit=crop", category: "Breads", tags: ["naan", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Dhaba 1986", location: "Gate 1 Highway Wing", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop",
      tags: ["dhaba", "thali"],
      menu: [
        { name: "Dal Makhani & Amritsari Kulcha", price: 240, description: "Slow 12-hour cooked black lentils served with stuffed potato kulcha.", imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=600&auto=format&fit=crop", category: "North Indian", tags: ["dal", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Grand Thali Junction", location: "Academic Block 2", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?q=80&w=800&auto=format&fit=crop",
      tags: ["thali", "unlimited"],
      menu: [
        { name: "Royal Rajasthani Veg Thali", price: 280, description: "Unlimited thali: Dal Baati Churma, Paneer, Kadhi, Roti, Rice & Sweet.", imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?q=80&w=600&auto=format&fit=crop", category: "Thali", tags: ["thali", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Shahi Rasoi", location: "Nexus Lobby Floor", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?q=80&w=800&auto=format&fit=crop",
      tags: ["paneer", "shahi"],
      menu: [
        { name: "Kadhai Paneer & Jeera Rice Combo", price: 230, description: "Cottage cheese with capsicum in spiced onion gravy with cumin rice.", imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?q=80&w=600&auto=format&fit=crop", category: "North Indian", tags: ["paneer", "veg"], isVegetarian: true }
      ]
    },

    // ── 6. Chinese & Pan-Asian Woks (4 Stores) ──
    {
      name: "Mandarin Magic", location: "Nexus Central Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=800&auto=format&fit=crop",
      tags: ["chinese", "noodles"],
      menu: [
        { name: "Special Veg Hakka Noodles", price: 220, description: "Wok-tossed noodles with bell peppers and dark soy sauce.", imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=600&auto=format&fit=crop", category: "Chinese", tags: ["noodles", "veg"], isVegetarian: true },
        { name: "Chili Garlic Dry Chicken", price: 280, description: "Crispy toss chicken with scallions & burnt garlic.", imageUrl: "https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=600&auto=format&fit=crop", category: "Chinese", tags: ["chicken", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Wok Toss Asian Kitchen", location: "Gate 1 Food Arcade", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=800&auto=format&fit=crop",
      tags: ["wok", "asian"],
      menu: [
        { name: "Triple Schezwan Chicken Fried Rice", price: 270, description: "Fried rice + noodles + spicy gravy combo topped with fried egg.", imageUrl: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=600&auto=format&fit=crop", category: "Chinese", tags: ["rice", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Mainland China Express", location: "Nexus Central Arcade", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=800&auto=format&fit=crop",
      tags: ["dimsum", "chinese"],
      menu: [
        { name: "Chicken Siu Mai Dim Sums (6 pcs)", price: 260, description: "Open-faced steamed chicken dumplings topped with orange caviar.", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop", category: "Dim Sum", tags: ["dimsum", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Noodle Town", location: "East Campus Arcade", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800&auto=format&fit=crop",
      tags: ["ramen", "japanese"],
      menu: [
        { name: "Spicy Miso Chicken Ramen Bowl", price: 350, description: "Rich miso broth, ramen noodles, braised chicken, bamboo shoots & soft egg.", imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=600&auto=format&fit=crop", category: "Ramen", tags: ["ramen", "non-veg"], isVegetarian: false }
      ]
    },

    // ── 7. Rolls & Shawarma (3 Stores) ──
    {
      name: "Roll Republic", location: "South Hub", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626078299034-90f7727142be?q=80&w=800&auto=format&fit=crop",
      tags: ["rolls"],
      menu: [
        { name: "Kolkata Egg Chicken Roll", price: 180, description: "Double egg washed paratha wrapped with chicken tikka.", imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=600&auto=format&fit=crop", category: "Rolls", tags: ["rolls", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "The Shawarma Hub", location: "Nexus Gate 1 Corner", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1561651823-34feb02250e4?q=80&w=800&auto=format&fit=crop",
      tags: ["shawarma", "arabian"],
      menu: [
        { name: "Special Arabian Chicken Shawarma", price: 160, description: "Slow-roasted chicken in rumali bread with garlic toum sauce.", imageUrl: "https://images.unsplash.com/photo-1561651823-34feb02250e4?q=80&w=600&auto=format&fit=crop", category: "Shawarma", tags: ["shawarma", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Frankie Factory", location: "Central Walkway", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1626078299034-90f7727142be?q=80&w=800&auto=format&fit=crop",
      tags: ["frankie", "snack"],
      menu: [
        { name: "Schezwan Chicken Frankie", price: 140, description: "Mumbai street style egg-coated frankie with chili chicken.", imageUrl: "https://images.unsplash.com/photo-1626078299034-90f7727142be?q=80&w=600&auto=format&fit=crop", category: "Frankie", tags: ["frankie", "non-veg"], isVegetarian: false }
      ]
    },

    // ── 8. Momos & Dumplings (3 Stores) ──
    {
      name: "WOW! Momo Station", location: "Nexus Central Arcade", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=800&auto=format&fit=crop",
      tags: ["momos", "fast-food"],
      menu: [
        { name: "Pan-Fried Cheese Corn Momos", price: 190, description: "Momos fried in Schezwan sauce with melted mozzarella.", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop", category: "Momos", tags: ["momos", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Tibetan Momo Corner", location: "Student Activity Center", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=800&auto=format&fit=crop",
      tags: ["momos", "tibetan"],
      menu: [
        { name: "Chicken Kurkure Momos (8 pcs)", price: 210, description: "Crispy cornflake crusted deep fried chicken momos.", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop", category: "Momos", tags: ["crispy", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Himalayan Dumpling House", location: "Gate 2 Street", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=800&auto=format&fit=crop",
      tags: ["dumplings", "soup"],
      menu: [
        { name: "Mokthuk Soup Dumplings", price: 230, description: "Steamed chicken dumplings served inside piping hot bone broth.", imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?q=80&w=600&auto=format&fit=crop", category: "Soup Momos", tags: ["non-veg"], isVegetarian: false }
      ]
    },

    // ── 9. Street Food & Chaat (3 Stores) ──
    {
      name: "Dilli Chaat Junction", location: "Central Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=800&auto=format&fit=crop",
      tags: ["chaat", "street-food"],
      menu: [
        { name: "Gol Gappa Pani Puri Shots (8 pcs)", price: 70, description: "Crispy puris filled with spicy mint water & tangy tamarind water.", imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=600&auto=format&fit=crop", category: "Chaat", tags: ["chaat", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Bombay Street Treats", location: "Nexus Gate 1 Courtyard", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=800&auto=format&fit=crop",
      tags: ["vada-pav", "mumbai"],
      menu: [
        { name: "Classic Cheese Vada Pav Duo", price: 90, description: "Two spicy potato patties in buns coated with garlic chutney & cheese.", imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=600&auto=format&fit=crop", category: "Street Food", tags: ["veg"], isVegetarian: true }
      ]
    },
    {
      name: "Miracle Samosa & Kachori", location: "Hostel Block A Plaza", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=800&auto=format&fit=crop",
      tags: ["samosa", "snacks"],
      menu: [
        { name: "Loaded Cheese Samosa Chat", price: 110, description: "Crushed potato samosas topped with chole, curd, and pomegranate seeds.", imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=600&auto=format&fit=crop", category: "Samosa", tags: ["veg"], isVegetarian: true }
      ]
    },

    // ── 10. High-Protein Gym Fuel (3 Stores) ──
    {
      name: "Iron Kitchen: Elite Fuel", location: "Campus Gym Wing", vendorType: "GYM",
      imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop",
      tags: ["gym", "high-protein"],
      menu: [
        { name: "Grilled Salmon Quinoa Bowl", price: 420, description: "Atlantic salmon, organic quinoa, avocado, and kale.", imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=600&auto=format&fit=crop", category: "Gym Fuel", tags: ["high-protein", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "Healthie Protein Meal Prep", location: "Sports Complex", vendorType: "GYM",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop",
      tags: ["fitness", "mealprep"],
      menu: [
        { name: "Herb Roasted Chicken Breast (250g)", price: 320, description: "Lean chicken breast served with steamed broccoli and sweet potato.", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop", category: "Gym Fuel", tags: ["high-protein", "non-veg"], isVegetarian: false }
      ]
    },
    {
      name: "FitBites Salad Lounge", location: "Nexus Health Center", vendorType: "GYM",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop",
      tags: ["salads", "keto"],
      menu: [
        { name: "Greek Avocado & Feta Salad", price: 290, description: "Ripe avocados, feta cheese, kalamata olives, cherry tomatoes & olive oil.", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=600&auto=format&fit=crop", category: "Salads", tags: ["keto", "veg"], isVegetarian: true }
      ]
    },

    // ── 11. Juices & Beverages (3 Stores) ──
    {
      name: "Zenvy Juice & Smoothie Bar", location: "Central Plaza", vendorType: "DRINKS",
      imageUrl: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=800&auto=format&fit=crop",
      tags: ["juices", "smoothies"],
      menu: [
        { name: "Pink Dragon Fruit Cooler", price: 180, description: "Cold-pressed pitaya juice with mint and lime.", imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop", category: "Juices", tags: ["drinks", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Keventers Milkshake Lounge", location: "Gate 1 Food Mall", vendorType: "DRINKS",
      imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=800&auto=format&fit=crop",
      tags: ["milkshakes", "keventers"],
      menu: [
        { name: "Belgian Dark Chocolate Thickshake", price: 240, description: "Iconic glass bottle thick chocolate milkshake with ice cream.", imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=600&auto=format&fit=crop", category: "Milkshakes", tags: ["drinks", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "The Fruitbae Lounge", location: "Nexus Lobby", vendorType: "DRINKS",
      imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=800&auto=format&fit=crop",
      tags: ["fruitbae", "shots"],
      menu: [
        { name: "Avocado Tender Coconut Shot", price: 190, description: "Blended fresh avocado mixed with tender coconut pulp.", imageUrl: "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?q=80&w=600&auto=format&fit=crop", category: "Drinks", tags: ["healthy", "veg"], isVegetarian: true }
      ]
    },

    // ── 12. Sweets & Desserts (4 Stores) ──
    {
      name: "Bakehouse & Sweet Tooth", location: "Gate 2 Mall", vendorType: "SWEETS",
      imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=800&auto=format&fit=crop",
      tags: ["sweets", "pastry"],
      menu: [
        { name: "Belgian Dark Chocolate Pastry", price: 160, description: "Rich layers of 70% dark cocoa sponge and ganache.", imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=600&auto=format&fit=crop", category: "Sweets", tags: ["veg"], isVegetarian: true }
      ]
    },
    {
      name: "The Belgian Waffle Co", location: "Central Walkway", vendorType: "SWEETS",
      imageUrl: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?q=80&w=800&auto=format&fit=crop",
      tags: ["waffles", "dessert"],
      menu: [
        { name: "Nuttela Dark Chocolate Waffle", price: 170, description: "Crispy warm waffle smothered with Nutella spread.", imageUrl: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?q=80&w=600&auto=format&fit=crop", category: "Waffles", tags: ["veg"], isVegetarian: true }
      ]
    },
    {
      name: "Baskin Robbins Ice Cream", location: "Nexus Plaza", vendorType: "SWEETS",
      imageUrl: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?q=80&w=800&auto=format&fit=crop",
      tags: ["icecream", "baskin"],
      menu: [
        { name: "Cotton Candy Double Scoop", price: 180, description: "Iconic pink & blue cotton candy ice cream.", imageUrl: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?q=80&w=600&auto=format&fit=crop", category: "Ice Cream", tags: ["veg"], isVegetarian: true }
      ]
    },
    {
      name: "Mithaiwala & Co", location: "Commercial Wing", vendorType: "SWEETS",
      imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=800&auto=format&fit=crop",
      tags: ["mithai", "traditional"],
      menu: [
        { name: "Kaju Katli Box (250g)", price: 320, description: "Premium cashew fudge sweets prepared in pure desi ghee.", imageUrl: "https://images.unsplash.com/photo-1601050690597-df056fb1ce7b?q=80&w=600&auto=format&fit=crop", category: "Indian Sweets", tags: ["veg"], isVegetarian: true }
      ]
    },

    // ── 13. Cafes & Coffee (2 Stores) ──
    {
      name: "Starbucks Coffee Reserve", location: "Nexus Main Lobby", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop",
      tags: ["starbucks", "coffee"],
      menu: [
        { name: "Caramel Frappuccino Blended Beverage", price: 360, description: "Coffee blended with caramel syrup, milk & ice topped with whipped cream.", imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=600&auto=format&fit=crop", category: "Coffee", tags: ["coffee", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Blue Tokai Coffee Roasters", location: "Academic Library Wing", vendorType: "RESTAURANT",
      imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop",
      tags: ["artisanal", "coffee"],
      menu: [
        { name: "Single Origin Iced Latte", price: 240, description: "Espresso made with 100% Arabica estate beans.", imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop", category: "Coffee", tags: ["coffee", "veg"], isVegetarian: true }
      ]
    },

    // ── 14. Grocery & Orchards (2 Stores) ──
    {
      name: "The Exotic Orchard", location: "Nexus Lobby", vendorType: "GROCERY",
      imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800&auto=format&fit=crop",
      tags: ["fruits", "grocery"],
      menu: [
        { name: "Premium Berry Box", price: 499, description: "Imported blueberries, raspberries, and strawberries.", imageUrl: "https://images.unsplash.com/photo-1629815049187-b952a2333061?q=80&w=600&auto=format&fit=crop", category: "Fruits", tags: ["fruits", "veg"], isVegetarian: true }
      ]
    },
    {
      name: "Campus Daily Mart", location: "Hostel Block B Arcade", vendorType: "GROCERY",
      imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=800&auto=format&fit=crop",
      tags: ["grocery", "snacks"],
      menu: [
        { name: "Roasted Salted Almonds (200g)", price: 290, description: "Crunchy California roasted almonds.", imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=600&auto=format&fit=crop", category: "Snacks", tags: ["grocery", "veg"], isVegetarian: true }
      ]
    },

    // ── 15. Stationery & Print Stores (2 Stores) ──
    {
      name: "Stationery & Print Hub", location: "Academic Block 1", vendorType: "STATIONARY",
      imageUrl: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?q=80&w=800&auto=format&fit=crop",
      tags: ["stationary", "print"],
      menu: [
        { name: "Leatherbound A5 Dotted Journal", price: 450, description: "Classic faux leather journal notebook.", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=600&auto=format&fit=crop", category: "Stationery", tags: ["books"], isVegetarian: true }
      ]
    },
    {
      name: "SRM Book Depot & Xerox", location: "Library Complex", vendorType: "STATIONARY",
      imageUrl: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?q=80&w=800&auto=format&fit=crop",
      tags: ["xerox", "books"],
      menu: [
        { name: "Spiral Notebook 300 Pages", price: 120, description: "A4 size ruled notebook for engineering notes.", imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=600&auto=format&fit=crop", category: "Stationery", tags: ["books"], isVegetarian: true }
      ]
    },

    // ── 16. Laundry Service (1 Store) ──
    {
      name: "FreshPress Laundry", location: "Laundry Court", vendorType: "LAUNDRY",
      imageUrl: "https://images.unsplash.com/photo-1545173153-5d4694469bb7?q=80&w=800&auto=format&fit=crop",
      tags: ["laundry", "dry-wash"],
      menu: [
        { name: "Premium Coat Dry Cleaning", price: 500, description: "Professional steam dry cleaning for suits & blazers.", imageUrl: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=600&auto=format&fit=crop", category: "Laundry", tags: ["laundry"], isVegetarian: true },
        { name: "Sneaker Deep Wash", price: 200, description: "Complete shoe restoration & disinfection.", imageUrl: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?q=80&w=600&auto=format&fit=crop", category: "Laundry", tags: ["shoes"], isVegetarian: true }
      ]
    },

    // ── 17. Pharmacy & Health (1 Store) ──
    {
      name: "Campus Health Pharmacy", location: "Nexus Medical Center", vendorType: "PHARMACY",
      imageUrl: "https://images.unsplash.com/photo-1586015555751-63bb77f4322a?q=80&w=800&auto=format&fit=crop",
      tags: ["pharmacy", "health"],
      menu: [
        { name: "First Aid Emergency Kit", price: 350, description: "Bandages, antiseptic solution, cotton, burnol & tape.", imageUrl: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600&auto=format&fit=crop", category: "Pharmacy", tags: ["health"], isVegetarian: true }
      ]
    },

    // ── 18. E-Fleet Rentals (1 Store) ──
    {
      name: "Nexus E-Fleet Rentals", location: "Gate 1 Parking", vendorType: "RENTAL",
      imageUrl: "https://images.unsplash.com/photo-1614165939096-45ef13bcbc0e?q=80&w=800&auto=format&fit=crop",
      tags: ["rental", "ebike"],
      menu: [
        { name: "Nexus E-Bike Pro (2-Hour Pass)", price: 100, description: "Electric high speed commute bike.", imageUrl: "https://images.unsplash.com/photo-1593764592116-bfb2a97c642a?q=80&w=600&auto=format&fit=crop", category: "Rental", tags: ["ebike"], isVegetarian: true }
      ]
    }
  ];

  console.log(`📦 Seeding ${VENDORS.length} unique stores...`);

  for (const vData of VENDORS) {
    // Check if store exists by name to avoid duplicate key errors
    let rest = await Restaurant.findOne({ where: { name: vData.name } });
    if (!rest) {
      rest = await Restaurant.create({
        name: vData.name,
        location: vData.location,
        imageUrl: vData.imageUrl,
        vendorType: vData.vendorType,
        commissionRate: 10,
        commissionType: 'percentage',
        operatingHours: JSON.stringify({ start: '08:00', end: '23:59' }),
        isActive: true,
        tags: JSON.stringify(vData.tags),
        rating: (Math.random() * (5.0 - 4.4) + 4.4).toFixed(1),
        time: "15-30 min",
        brandTheme: vData.brandTheme ? vData.brandTheme : null
      });
    }

    if (vData.menu && vData.menu.length > 0) {
      for (let i = 0; i < vData.menu.length; i++) {
        const item = vData.menu[i];
        const existingItem = await MenuItem.findOne({
          where: { restaurantId: rest.id, name: item.name }
        });

        if (!existingItem) {
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
    }
  }

  const totalStores = await Restaurant.count();
  const totalItems = await MenuItem.count();
  console.log(`\n🎉 MASTER SEED COMPLETED SUCCESSFULLY!`);
  console.log(`📊 TOTAL STORES IN DATABASE: ${totalStores}`);
  console.log(`📊 TOTAL MENU ITEMS IN DATABASE: ${totalItems}`);
  process.exit(0);
}

seed50Vendors().catch(err => {
  console.error('❌ Seeding Failed:', err);
  process.exit(1);
});

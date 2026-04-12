const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const dbPath = path.join(__dirname, '../local_dev.sqlite');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

const seed = async () => {
    try {
        console.log('🌱 Starting Precise Universal Seed...');
        
        // --- Official Restaurant Model ---
        const Restaurant = sequelize.define('Restaurant', {
            id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
            name: { type: DataTypes.STRING, allowNull: false },
            location: { type: DataTypes.STRING, allowNull: false },
            lat: { type: DataTypes.FLOAT, defaultValue: 16.5062 },
            lon: { type: DataTypes.FLOAT, defaultValue: 80.6480 },
            zone: { type: DataTypes.STRING, defaultValue: 'Amaravathi_Central' },
            imageUrl: { type: DataTypes.STRING },
            vendorType: { type: DataTypes.STRING, defaultValue: 'EXPRESS' },
            rating: { type: DataTypes.FLOAT, defaultValue: 4.8 },
            deliveryTime: { type: DataTypes.INTEGER, defaultValue: 25 },
            commissionRate: { type: DataTypes.FLOAT, defaultValue: 10 },
            commissionType: { type: DataTypes.ENUM('percentage', 'flat'), defaultValue: 'percentage' },
            tags: { type: DataTypes.JSON, defaultValue: [] },
            operatingHours: { type: DataTypes.JSON, defaultValue: { start: '09:00', end: '22:00' } },
            isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
            isOffline: { type: DataTypes.BOOLEAN, defaultValue: false },
            password: { type: DataTypes.STRING, allowNull: true }
        }, { timestamps: true });

        // --- Official MenuItem Model ---
        const MenuItem = sequelize.define('MenuItem', {
            id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
            restaurantId: { type: DataTypes.UUID, allowNull: false },
            name: { type: DataTypes.STRING, allowNull: false },
            price: { type: DataTypes.FLOAT, allowNull: false },
            description: { type: DataTypes.TEXT },
            imageUrl: { type: DataTypes.STRING },
            category: { type: DataTypes.STRING },
            tags: { type: DataTypes.JSON, defaultValue: [] },
            isVegetarian: { type: DataTypes.BOOLEAN, defaultValue: true },
            isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true },
            isEliteOnly: { type: DataTypes.BOOLEAN, defaultValue: false },
            customCommission: { type: DataTypes.FLOAT }
        }, { timestamps: true });

        await sequelize.sync({ force: true });
        console.log('✅ Official Schema Synchronized.');

        const res = await Restaurant.create({
            name: "Nexus Omni-Catalog",
            location: "Amaravathi Central",
            imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop",
            tags: ["Gourmet", "Universal", "Express"]
        });

        const items = [
            // --- Interactive Chips ---
            { name: "Hyderabadi Chicken Biryani", price: 280, description: "Authentic slow-cooked dum biryani.", category: "Biryani", tags: ["biryani", "spicy"], isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1589302168068-9a4960d57bb8?w=800&q=80" },
            { name: "Margherita Gold Pizza", price: 350, description: "Classic cheese pizza with basil.", category: "Pizza", tags: ["pizza", "cheese"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80" },
            { name: "Ghee Roast Masala Dosa", price: 120, description: "Crispy dosa with potato filling.", category: "South Indian", tags: ["south indian", "veg"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80" },
            { name: "Classic Double Burger", price: 220, description: "Flame-grilled beef patties.", category: "Burgers", tags: ["burgers", "fast-food"], isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80" },
            { name: "Schezwan Hakka Noodles", price: 240, description: "Spicy stir-fried noodles.", category: "Chinese", tags: ["chinese", "spicy"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&q=80" },
            { name: "Butter Chicken Roll", price: 190, description: "Tandoori chicken in a soft wrap.", category: "Rolls", tags: ["rolls", "non-veg"], isVegetarian: false, imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b547b4e5c?w=800&q=80" },
            
            // --- Section Direct Mapping ---
            { name: "Fuji Red Apples (1kg)", price: 160, category: "Fruits", tags: ["fruits", "healthy"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6bcd6?w=800&q=80" },
            { name: "Tropical Fruit Medley", price: 220, category: "Fruits", tags: ["fruits", "seasonal"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&q=80" },
            
            { name: "Zenvy Stealth Cycle", price: 149, category: "Rentals", tags: ["rental", "bike"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80" },
            { name: "Matte Black Umbrella", price: 40, category: "Rentals", tags: ["rental", "seasonal"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1510103551351-78923a109761?w=800&q=80" },
            
            { name: "Suit Set Dry Cleaning", price: 350, category: "Laundry", tags: ["laundry", "dry-wash"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1545173153-936c5c62f50e?w=800&q=80" },
            { name: "Vitamin C Supplements", price: 450, category: "Pharmacy", tags: ["pharmacy", "medicine"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80" },
            
            { name: "Premium Moleskine Journal", price: 850, category: "Stationary", tags: ["stationary", "books"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1531346878377-a5ec20888eb5?w=800&q=80" },
            { name: "Color Print Service (Bulk)", price: 5, category: "Stationary", tags: ["stationary", "print"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1583485088034-7160b5bbbc88?w=800&q=80" },
            
            { name: "Motichoor Laddu (Premium)", price: 180, category: "Sweets", tags: ["sweets", "desserts"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1589119908995-c6837fa14848?w=800&q=80" },
            { name: "Signature Iced Latte", price: 190, category: "Drinks", tags: ["drinks", "beverages"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80" },
            
            { name: "ISO-Whey Isolate (Van)", price: 299, category: "Health", tags: ["gym", "high-protein"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1593095163351-50e50f39e3f7?w=800&q=80" },
            { name: "Quinoa Protein Bowl", price: 280, category: "Health", tags: ["gym", "healthy"], isVegetarian: true, imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80" }
        ];

        for (const item of items) {
            await MenuItem.create({ ...item, restaurantId: res.id });
        }

        const count = await MenuItem.count();
        console.log(`📊 Unified Seeding Complete! Populated ${count} items onto Official Schema.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ SEED FAILED:', err);
        process.exit(1);
    }
};

seed();

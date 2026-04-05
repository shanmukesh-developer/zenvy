const LEGACY_DATA = [
  {
    "id": "biryani-hub", "name": "Biryani Hub", "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs", "Main Course"], "vendorType": "RESTAURANT",
    "menu": [
      { "id": "bir-01", "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", "category": "Biryani" },
      { "id": "bir-02", "name": "Royal Egg Biryani", "price": 220, "description": "Fragrant rice with double eggs.", "image": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400", "category": "Biryani" }
    ]
  },
  {
    "id": "burger-club", "name": "The Burger Club", "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400",
    "categories": ["Burgers", "Sides", "Shakes"], "vendorType": "RESTAURANT",
    "menu": [
      { "id": "brg-01", "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "Burgers" }
    ]
  },
  {
    "id": "pizza-paradise", "name": "Pizza Paradise", "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    "categories": ["Pizza", "Pasta", "Sides"], "vendorType": "RESTAURANT",
    "menu": [
      { "id": "piz-01", "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400", "category": "Pizza" }
    ]
  },
  {
    "id": "campus-pharmacy", "name": "Campus MedPoint", "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",
    "categories": ["First Aid", "Vitamins", "Hygiene"], "vendorType": "PHARMACY",
    "menu": [
      { "id": "ph-01", "name": "First Aid Compact Kit", "price": 199, "description": "Essential campus first aid essentials.", "image": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400", "category": "First Aid" },
      { "id": "ph-02", "name": "Vitamin C Booster", "price": 150, "description": "Immune support tablets.", "image": "https://images.unsplash.com/photo-1547489432-cf93fa6c71ee?w=400", "category": "Vitamins" },
      { "id": "ph-03", "name": "Hand Sanitizer Pack", "price": 80, "description": "Alcohol-based sanitizer 3-pack.", "image": "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=400", "category": "Hygiene" }
    ]
  },
  {
    "id": "campus-stationary", "name": "Nexus BookHouse", "imageUrl": "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400",
    "categories": ["Notebooks", "Pens", "Drafting"], "vendorType": "STATIONARY",
    "menu": [
      { "id": "st-01", "name": "Executive Leather Journal", "price": 599, "description": "Premium leather-bound A5 journal.", "image": "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400", "category": "Notebooks" },
      { "id": "st-02", "name": "Precision Pen Set", "price": 850, "description": "Professional drafting pen collection.", "image": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400", "category": "Pens" },
      { "id": "st-03", "name": "Graph Pad A4 (Pack of 5)", "price": 120, "description": "Engineering graph paper pads.", "image": "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400", "category": "Drafting" }
    ]
  },
  {
    "id": "campus-laundry", "name": "FreshPress Laundry", "imageUrl": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400",
    "categories": ["Dry Wash", "Ironing", "Sneaker Care"], "vendorType": "LAUNDRY",
    "menu": [
      { "id": "lnd-01", "name": "Express Dry Cleaning (Suit)", "price": 499, "description": "Premium dry wash for formal wear.", "image": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400", "category": "Dry Wash" },
      { "id": "lnd-02", "name": "Sneaker Deep Restore", "price": 250, "description": "Full sneaker cleaning & whitening.", "image": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400", "category": "Sneaker Care" },
      { "id": "lnd-03", "name": "Weekly Ironing Pack (10 pcs)", "price": 150, "description": "Iron & fold service for 10 items.", "image": "https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?w=400", "category": "Ironing" }
    ]
  },
  {
    "id": "gym-nutrition-hq", "name": "Iron Kitchen: Pro Meals", "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
    "categories": ["Protein Bowls", "Shakes", "Supplements"], "vendorType": "GYM",
    "menu": [
      { "id": "gm-01", "name": "High-Protein Salmon Bowl", "price": 350, "description": "30g protein with quinoa & avocado.", "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400", "category": "Protein Bowls" },
      { "id": "gm-02", "name": "Whey Isolate Shake", "price": 199, "description": "Vanilla whey isolate, 25g protein.", "image": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", "category": "Shakes" },
      { "id": "gm-03", "name": "Vegan Protein Crisp Bar", "price": 120, "description": "Plant-based protein bar.", "image": "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400", "category": "Supplements" }
    ]
  },
  {
    "id": "campus-cafe", "name": "Zenvy Brew Bar", "imageUrl": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400",
    "categories": ["Coffee", "Tea", "Mocktails"], "vendorType": "DRINKS",
    "menu": [
      { "id": "dr-01", "name": "Iced Caramel Macchiato", "price": 160, "description": "Double-shot espresso with caramel drizzle.", "image": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400", "category": "Coffee" },
      { "id": "dr-02", "name": "Matcha Green Tea Latte", "price": 140, "description": "Premium matcha with steamed milk.", "image": "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400", "category": "Tea" }
    ]
  },
  {
    "id": "seasonal-gifting", "name": "Nexus Gift Lounge", "imageUrl": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400",
    "categories": ["Hampers", "Merch", "Limited Edition"], "vendorType": "SEASONAL",
    "menu": [
      { "id": "se-01", "name": "Nexus Holiday Hamper", "price": 999, "description": "Curated premium gift box.", "image": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400", "category": "Hampers" }
    ]
  },
  {
    "id": "campus-rentals", "name": "Nexus Campus Fleet", "imageUrl": "https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400",
    "categories": ["E-Bikes", "Scooters", "Boards"], "vendorType": "RENTAL",
    "menu": [
      { "id": "rn-01", "name": "Nexus E-Bike Pro (Hourly)", "price": 50, "description": "Electric bike rental per hour.", "image": "https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400", "category": "E-Bikes" }
    ]
  },
  {
    "id": "fruit-market", "name": "Fresh Harvest Hub", "imageUrl": "https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=400",
    "categories": ["Exotic", "Seasonal", "Bundles"], "vendorType": "GROCERY",
    "menu": [
      { "id": "fr-01", "name": "Organic Dragon Fruit", "price": 120, "description": "Premium imported dragon fruit.", "image": "https://images.unsplash.com/photo-1527325541517-4506b7d44c8c?w=400", "category": "Exotic" }
    ]
  },
  {
    "id": "sweets-boutique", "name": "Le Macaron Boutique", "imageUrl": "https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=400",
    "categories": ["Chocolates", "Pastries", "Pralines"], "vendorType": "SWEETS",
    "menu": [
      { "id": "sw-01", "name": "Gold Leaf Belgian Pralines", "price": 699, "description": "Handcrafted gold leaf chocolates.", "image": "https://images.unsplash.com/photo-1581798459219-3385269f0653?w=400", "category": "Pralines" }
    ]
  }
];

fetch('http://localhost:5001/api/admin/seed', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZjFhMmIzYzRkNWU2ZjdhOGI5YzAwMCIsIm5hbWUiOiJBZG1pbiBVc2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc0MzM5ODMxLCJleHAiOjE3NzY5MzE4MzF9.Uxu3cFn4Uz23z4Orc3otNoI2JSRrTXIyWpvBOX-wJcs'
  },
  body: JSON.stringify({ restaurants: LEGACY_DATA })
}).then(async r => {
  console.log('Status:', r.status);
  console.log(await r.json());
}).catch(console.error);

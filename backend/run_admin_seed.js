const LEGACY_DATA = [
  {
    "id": "biryani-hub", "name": "Biryani Hub", "imageUrl": "https://picsum.photos/seed/biryani/400/300",
    "categories": ["Biryani", "Kebabs", "Main Course"], "vendorType": "RESTAURANT",
    "menu": [
      { "id": "bir-01", "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://picsum.photos/seed/mutton/400/300", "category": "Biryani" },
      { "id": "bir-02", "name": "Royal Egg Biryani", "price": 220, "description": "Fragrant rice with double eggs.", "image": "https://picsum.photos/seed/egg/400/300", "category": "Biryani" }
    ]
  },
  {
    "id": "burger-club", "name": "The Burger Club", "imageUrl": "https://picsum.photos/seed/burger-club/400/300",
    "categories": ["Burgers", "Sides", "Shakes"], "vendorType": "RESTAURANT",
    "menu": [
      { "id": "brg-01", "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://picsum.photos/seed/cheese/400/300", "category": "Burgers" }
    ]
  },
  {
    "id": "pizza-paradise", "name": "Pizza Paradise", "imageUrl": "https://picsum.photos/seed/pizza-hub/400/300",
    "categories": ["Pizza", "Pasta", "Sides"], "vendorType": "RESTAURANT",
    "menu": [
      { "id": "piz-01", "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "https://picsum.photos/seed/pizza/400/300", "category": "Pizza" }
    ]
  },
  {
    "id": "campus-pharmacy", "name": "Campus MedPoint", "imageUrl": "https://picsum.photos/seed/pharmacy/400/300",
    "categories": ["First Aid", "Vitamins", "Hygiene"], "vendorType": "PHARMACY",
    "menu": [
      { "id": "ph-01", "name": "First Aid Compact Kit", "price": 199, "description": "Essential campus first aid essentials.", "image": "https://picsum.photos/seed/health/400/300", "category": "First Aid" },
      { "id": "ph-02", "name": "Vitamin C Booster", "price": 150, "description": "Immune support tablets.", "image": "https://picsum.photos/seed/vitamins/400/300", "category": "Vitamins" },
      { "id": "ph-03", "name": "Hand Sanitizer Pack", "price": 80, "description": "Alcohol-based sanitizer 3-pack.", "image": "https://picsum.photos/seed/hygiene/400/300", "category": "Hygiene" }
    ]
  },
  {
    "id": "campus-stationary", "name": "Nexus BookHouse", "imageUrl": "https://picsum.photos/seed/books/400/300",
    "categories": ["Notebooks", "Pens", "Drafting"], "vendorType": "STATIONARY",
    "menu": [
      { "id": "st-01", "name": "Executive Leather Journal", "price": 599, "description": "Premium leather-bound A5 journal.", "image": "https://picsum.photos/seed/journal/400/300", "category": "Notebooks" },
      { "id": "st-02", "name": "Precision Pen Set", "price": 850, "description": "Professional drafting pen collection.", "image": "https://picsum.photos/seed/pen/400/300", "category": "Pens" },
      { "id": "st-03", "name": "Graph Pad A4 (Pack of 5)", "price": 120, "description": "Engineering graph paper pads.", "image": "https://picsum.photos/seed/pad/400/300", "category": "Drafting" }
    ]
  },
  {
    "id": "campus-laundry", "name": "FreshPress Laundry", "imageUrl": "https://picsum.photos/seed/laundry/400/300",
    "categories": ["Dry Wash", "Ironing", "Sneaker Care"], "vendorType": "LAUNDRY",
    "menu": [
      { "id": "lnd-01", "name": "Express Dry Cleaning (Suit)", "price": 499, "description": "Premium dry wash for formal wear.", "image": "https://picsum.photos/seed/suit/400/300", "category": "Dry Wash" },
      { "id": "lnd-02", "name": "Sneaker Deep Restore", "price": 250, "description": "Full sneaker cleaning & whitening.", "image": "https://picsum.photos/seed/sneaker/400/300", "category": "Sneaker Care" },
      { "id": "lnd-03", "name": "Weekly Ironing Pack (10 pcs)", "price": 150, "description": "Iron & fold service for 10 items.", "image": "https://picsum.photos/seed/iron/400/300", "category": "Ironing" }
    ]
  },
  {
    "id": "gym-nutrition-hq", "name": "Iron Kitchen: Pro Meals", "imageUrl": "https://picsum.photos/seed/gym-meals/400/300",
    "categories": ["Protein Bowls", "Shakes", "Supplements"], "vendorType": "GYM",
    "menu": [
      { "id": "gm-01", "name": "High-Protein Salmon Bowl", "price": 350, "description": "30g protein with quinoa & avocado.", "image": "https://picsum.photos/seed/salmon/400/300", "category": "Protein Bowls" },
      { "id": "gm-02", "name": "Whey Isolate Shake", "price": 199, "description": "Vanilla whey isolate, 25g protein.", "image": "https://picsum.photos/seed/whey/400/300", "category": "Shakes" },
      { "id": "gm-03", "name": "Vegan Protein Crisp Bar", "price": 120, "description": "Plant-based protein bar.", "image": "https://picsum.photos/seed/protein-bar/400/300", "category": "Supplements" }
    ]
  },
  {
    "id": "campus-cafe", "name": "Zenvy Brew Bar", "imageUrl": "https://picsum.photos/seed/coffee-shop/400/300",
    "categories": ["Coffee", "Tea", "Mocktails"], "vendorType": "DRINKS",
    "menu": [
      { "id": "dr-01", "name": "Iced Caramel Macchiato", "price": 160, "description": "Double-shot espresso with caramel drizzle.", "image": "https://picsum.photos/seed/macchiato/400/300", "category": "Coffee" },
      { "id": "dr-02", "name": "Matcha Green Tea Latte", "price": 140, "description": "Premium matcha with steamed milk.", "image": "https://picsum.photos/seed/matcha/400/300", "category": "Tea" }
    ]
  },
  {
    "id": "seasonal-gifting", "name": "Nexus Gift Lounge", "imageUrl": "https://picsum.photos/seed/gift/400/300",
    "categories": ["Hampers", "Merch", "Limited Edition"], "vendorType": "SEASONAL",
    "menu": [
      { "id": "se-01", "name": "Nexus Holiday Hamper", "price": 999, "description": "Curated premium gift box.", "image": "https://picsum.photos/seed/hamper/400/300", "category": "Hampers" }
    ]
  },
  {
    "id": "campus-rentals", "name": "Nexus Campus Fleet", "imageUrl": "https://picsum.photos/seed/ebike/400/300",
    "categories": ["E-Bikes", "Scooters", "Boards"], "vendorType": "RENTAL",
    "menu": [
      { "id": "rn-01", "name": "Nexus E-Bike Pro (Hourly)", "price": 50, "description": "Electric bike rental per hour.", "image": "https://picsum.photos/seed/bike/400/300", "category": "E-Bikes" }
    ]
  },
  {
    "id": "fruit-market", "name": "Fresh Harvest Hub", "imageUrl": "https://picsum.photos/seed/grocery/400/300",
    "categories": ["Exotic", "Seasonal", "Bundles"], "vendorType": "GROCERY",
    "menu": [
      { "id": "fr-01", "name": "Organic Dragon Fruit", "price": 120, "description": "Premium imported dragon fruit.", "image": "https://picsum.photos/seed/dragon-fruit/400/300", "category": "Exotic" }
    ]
  },
  {
    "id": "sweets-boutique", "name": "Le Macaron Boutique", "imageUrl": "https://picsum.photos/seed/macaron/400/300",
    "categories": ["Chocolates", "Pastries", "Pralines"], "vendorType": "SWEETS",
    "menu": [
      { "id": "sw-01", "name": "Gold Leaf Belgian Pralines", "price": 699, "description": "Handcrafted gold leaf chocolates.", "image": "https://picsum.photos/seed/chocolate/400/300", "category": "Pralines" }
    ]
  }
];

fetch('http://localhost:5005/api/admin/seed', {
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

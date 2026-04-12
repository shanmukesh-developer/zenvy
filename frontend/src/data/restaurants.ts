export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  rating?: string;
  time?: string;
  isCake?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  rating: string;
  time: string;
  description: string;
  imageUrl: string;
  categories: string[];
  menu: Product[];
}

export const restaurants: Restaurant[] = [
  {
    "id": "biryani-hub",
    "name": "Biryani Hub",
    "rating": "4.8",
    "time": "15m",
    "description": "Premium Biryani & Kebabs serving SRM AP community.",
    "imageUrl": "https://picsum.photos/seed/biryani/400/300",
    "categories": ["Biryani", "Kebabs", "Main Course"],
    "menu": [
      { "id": "bir-01", "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://picsum.photos/seed/mutton/400/300", "category": "Biryani" },
      { "id": "bir-02", "name": "Royal Egg Biryani", "price": 220, "description": "Fragrant rice with double eggs.", "image": "https://picsum.photos/seed/egg/400/300", "category": "Biryani" },
      { "id": "bir-03", "name": "Chicken Tikka Kebab", "price": 180, "description": "Juicy grilled chicken skewers.", "image": "https://picsum.photos/seed/tikka/400/300", "category": "Kebabs" },
      { "id": "bir-04", "name": "Hyderabadi Dum Biryani", "price": 250, "description": "Classic slow-cooked chicken biryani.", "image": "https://picsum.photos/seed/dum/400/300", "category": "Biryani" },
      { "id": "bir-05", "name": "Paneer Tikka Kebab", "price": 160, "description": "Grilled cottage cheese with herbs.", "image": "https://picsum.photos/seed/paneer/400/300", "category": "Kebabs" },
      { "id": "bir-06", "name": "Tandoori Roti", "price": 40, "description": "Freshly baked clay oven bread.", "image": "https://picsum.photos/seed/roti/400/300", "category": "Main Course" },
      { "id": "bir-07", "name": "Butter Chicken", "price": 240, "description": "Creamy tomato based chicken curry.", "image": "https://picsum.photos/seed/butter/400/300", "category": "Main Course" },
      { "id": "bir-08", "name": "Dal Makhani", "price": 190, "description": "Rich black lentils cooked overnight.", "image": "https://picsum.photos/seed/dal/400/300", "category": "Main Course" },
      { "id": "bir-09", "name": "Garlic Naan", "price": 60, "description": "Soft bread with toasted garlic.", "image": "https://picsum.photos/seed/naan/400/300", "category": "Main Course" },
      { "id": "bir-10", "name": "Gulab Jamun", "price": 80, "description": "Sweet milk dumplings in syrup.", "image": "https://picsum.photos/seed/gulab/400/300", "category": "Dessert" }
    ]
  },
  {
    "id": "burger-club",
    "name": "The Burger Club",
    "rating": "4.6",
    "time": "20m",
    "description": "Gourmet burgers and artisanal sides.",
    "imageUrl": "https://picsum.photos/seed/burger-club/400/300",
    "categories": ["Burgers", "Sides", "Shakes"],
    "menu": [
      { "id": "brg-01", "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://picsum.photos/seed/cheese/400/300", "category": "Burgers" },
      { "id": "brg-02", "name": "Bacon Blaze Burger", "price": 220, "description": "Crispy bacon with spicy aioli.", "image": "https://picsum.photos/seed/bacon/400/300", "category": "Burgers" },
      { "id": "brg-03", "name": "Mushroom Swiss", "price": 190, "description": "Sautéed mushrooms and swiss cheese.", "image": "https://picsum.photos/seed/mushroom/400/300", "category": "Burgers" },
      { "id": "brg-04", "name": "Peri Peri Chicken Burger", "price": 180, "description": "Flaming peri peri grilled chicken.", "image": "https://picsum.photos/seed/peri/400/300", "category": "Burgers" },
      { "id": "brg-05", "name": "Veggie Delight", "price": 140, "description": "Crispy veg patty with fresh greens.", "image": "https://picsum.photos/seed/veggie/400/300", "category": "Burgers" },
      { "id": "brg-06", "name": "Peri Peri Fries", "price": 80, "description": "Spicy seasoned crinkle cut fries.", "image": "https://picsum.photos/seed/fries/400/300", "category": "Sides" },
      { "id": "brg-07", "name": "Onion Rings", "price": 90, "description": "Beer battered crispy onion rings.", "image": "https://picsum.photos/seed/onion/400/300", "category": "Sides" },
      { "id": "brg-08", "name": "Chocolate Shake", "price": 120, "description": "Thick belgian chocolate shake.", "image": "https://picsum.photos/seed/shake/400/300", "category": "Shakes" },
      { "id": "brg-09", "name": "Strawberry Frost", "price": 110, "description": "Fresh strawberry creamy shake.", "image": "https://picsum.photos/seed/strawberry/400/300", "category": "Shakes" },
      { "id": "brg-10", "name": "Chicken Nuggets", "price": 130, "description": "Crispy golden chicken bites.", "image": "https://picsum.photos/seed/nugget/400/300", "category": "Sides" }
    ]
  },
  {
    "id": "pizza-paradise",
    "name": "Pizza Paradise",
    "rating": "4.7",
    "time": "25m",
    "description": "Authentic wood-fired pizzas.",
    "imageUrl": "https://picsum.photos/seed/pizza-hub/400/300",
    "categories": ["Pizza", "Pasta", "Sides"],
    "menu": [
      { "id": "piz-01", "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "/assets/margherita_classica.png", "category": "Pizza" },
      { "id": "piz-02", "name": "Pepperoni Feast", "price": 350, "description": "Double pepperoni with herb blend.", "image": "https://picsum.photos/seed/pepperoni/400/300", "category": "Pizza" },
      { "id": "piz-03", "name": "Farmhouse Special", "price": 320, "description": "Bell peppers, mushrooms, corn & onion.", "image": "https://picsum.photos/seed/farm/400/300", "category": "Pizza" },
      { "id": "piz-04", "name": "Chicken Tikka Pizza", "price": 340, "description": "Indian fusion tikka with capsicum.", "image": "https://picsum.photos/seed/tikka-pizza/400/300", "category": "Pizza" },
      { "id": "piz-05", "name": "Arrabiata Pasta", "price": 240, "description": "Spicy tomato sauce with penne.", "image": "https://picsum.photos/seed/pasta/400/300", "category": "Pasta" },
      { "id": "piz-06", "name": "Creamy Alfredo", "price": 260, "description": "White sauce pasta with mushrooms.", "image": "/assets/creamy_alfredo.png", "category": "Pasta" },
      { "id": "piz-07", "name": "Garlic Breadsticks", "price": 90, "description": "Baked fresh with garlic butter.", "image": "/assets/garlic_breadsticks.png", "category": "Sides" },
      { "id": "piz-08", "name": "Stuffed Garlic Bread", "price": 140, "description": "Cheese & jalapeno stuffed bread.", "image": "https://picsum.photos/seed/garlic/400/300", "category": "Sides" },
      { "id": "piz-09", "name": "Garden Salad", "price": 120, "description": "Fresh seasonal greens with dressing.", "image": "https://picsum.photos/seed/salad/400/300", "category": "Sides" },
      { "id": "piz-10", "name": "Tiramisu Cup", "price": 180, "description": "Coffee-flavored Italian dessert.", "image": "https://picsum.photos/seed/tiramisu/400/300", "category": "Dessert" }
    ]
  },
  {
    "id": "subway-fresh",
    "name": "Subway Fresh",
    "rating": "4.4",
    "time": "12m",
    "description": "Healthy subs and wraps made fresh.",
    "imageUrl": "/assets/subway_fresh_sandwich_1773853791547.png",
    "categories": ["Subs", "Salads", "Cookies"],
    "menu": [
      { "id": "sub-01", "name": "Roasted Chicken Sub", "price": 190, "description": "Succulent chicken with fresh veggies.", "image": "https://picsum.photos/seed/sub/400/300", "category": "Subs" },
      { "id": "sub-02", "name": "Paneer Tikka Sub", "price": 170, "description": "Spicy paneer in choice of bread.", "image": "https://picsum.photos/seed/paneer-sub/400/300", "category": "Subs" },
      { "id": "sub-03", "name": "Italian B.M.T.", "price": 220, "description": "Genoa salami, pepperoni & ham.", "image": "https://picsum.photos/seed/italian/400/300", "category": "Subs" },
      { "id": "sub-04", "name": "Vegi Delite", "price": 140, "description": "Loaded with fresh seasonal veggies.", "image": "https://picsum.photos/seed/vegi/400/300", "category": "Subs" },
      { "id": "sub-05", "name": "Chicken Kofta Sub", "price": 200, "description": "Spicy chicken meatballs with sauce.", "image": "https://picsum.photos/seed/kofta/400/300", "category": "Subs" },
      { "id": "sub-06", "name": "Aloo Patty Wrap", "price": 130, "description": "Spiced potato patty in a soft wrap.", "image": "https://picsum.photos/seed/aloo/400/300", "category": "Subs" },
      { "id": "sub-07", "name": "Corn & Peas Salad", "price": 160, "description": "Sweet corn and peas mix.", "image": "https://picsum.photos/seed/corn/400/300", "category": "Salads" },
      { "id": "sub-08", "name": "Dark Chocolate Cookie", "price": 50, "description": "Soft & chewy chocolate chip cookie.", "image": "https://picsum.photos/seed/cookie/400/300", "category": "Cookies" },
      { "id": "sub-09", "name": "Oatmeal Raisin Cookie", "price": 50, "description": "Healthy oats and raisin sweet.", "image": "https://picsum.photos/seed/oatmeal/400/300", "category": "Cookies" },
      { "id": "sub-10", "name": "Coke Zero", "price": 40, "description": "Chilled sugar-free refreshment.", "image": "https://picsum.photos/seed/coke/400/300", "category": "Drinks" }
    ]
  },
  {
    "id": "la-pinoz",
    "name": "La Pino'z",
    "rating": "4.5",
    "time": "18m",
    "description": "Innovative pizza slices & giant pizzas.",
    "imageUrl": "https://picsum.photos/seed/lapinoz/400/300",
    "categories": ["Pizza", "Sides", "Beverages"],
    "menu": [
      { "id": "lap-01", "name": "7 Layer Pizza", "price": 380, "description": "Loaded with unique layers of toppings.", "image": "https://picsum.photos/seed/layered/400/300", "category": "Pizza" },
      { "id": "lap-02", "name": "Cheesy Macaroni", "price": 180, "description": "Hot & cheesy classic macaroni.", "image": "https://picsum.photos/seed/mac/400/300", "category": "Sides" },
      { "id": "lap-03", "name": "Paneer Makhani Slice", "price": 120, "description": "Giant slice with makhani gravy.", "image": "https://picsum.photos/seed/makhani/400/300", "category": "Pizza" },
      { "id": "lap-04", "name": "Peri Peri Garlic Bread", "price": 110, "description": "Spicy twist on garlic bread.", "image": "https://picsum.photos/seed/peri-garlic/400/300", "category": "Sides" },
      { "id": "lap-05", "name": "English Vinglish Pizza", "price": 290, "description": "Exotic vegetable pizza blend.", "image": "https://picsum.photos/seed/english/400/300", "category": "Pizza" },
      { "id": "lap-06", "name": "Chicken Tikka Tacos", "price": 150, "description": "Fusion tacos with tikka filling.", "image": "https://picsum.photos/seed/taco/400/300", "category": "Sides" },
      { "id": "lap-07", "name": "Fries Overloaded", "price": 140, "description": "Fries topped with cheese & jalapenos.", "image": "https://picsum.photos/seed/loaded-fries/400/300", "category": "Sides" },
      { "id": "lap-08", "name": "Choco Lava Cake", "price": 90, "description": "Molten chocolate center cake.", "image": "https://picsum.photos/seed/lava/400/300", "category": "Dessert" },
      { "id": "lap-09", "name": "Cold Coffee", "price": 100, "description": "Creamy whipped cold coffee.", "image": "https://picsum.photos/seed/coffee/400/300", "category": "Beverages" },
      { "id": "lap-10", "name": "Mountain Dew", "price": 40, "description": "Chilled citrus refreshment.", "image": "https://picsum.photos/seed/dew/400/300", "category": "Beverages" }
    ]
  },
  {
    "id": "gym-1",
    "name": "Iron Kitchen: Pro Meals",
    "rating": "4.9",
    "time": "1h Prep",
    "description": "High-protein gourmet meals for the campus athlete.",
    "imageUrl": "/assets/zenvy_gym_rats_nutrition_1773839650320.png",
    "categories": ["Protein Bowls", "Lean Salads", "Keto"],
    "menu": [
      { "id": "gp-1", "name": "Whey Protein Bowl", "price": 250, "description": "30g protein, quinoa, avocado and chicken.", "image": "/assets/whey_protein_bowl.png", "category": "Protein Bowls" },
      { "id": "gp-2", "name": "Lean Muscle Salad", "price": 220, "description": "Grilled turkey with kale and almond flakes.", "image": "https://picsum.photos/seed/paleo/400/300", "category": "Lean Salads" }
    ]
  },
  {
    "id": "gym-2",
    "name": "Zenvy Fuel: Protein Shakes",
    "rating": "5.0",
    "time": "Instant",
    "description": "Premium nutrition shakes and supplements.",
    "imageUrl": "/assets/zenvy_protein_shake_bottles_1773839980833.png",
    "categories": ["Whey", "Vegan", "Mass Gainer"],
    "menu": [
      { "id": "gs-1", "name": "Dark Gold Whey (30g)", "price": 180, "description": "Elite recovery with 100% whey isolate.", "image": "/assets/zenvy_protein_shake_bottles_1773839980833.png", "category": "Whey" },
      { "id": "gs-2", "name": "Bulk Master Gainer", "price": 210, "description": "High calorie mass gainer for hard gainers.", "image": "/assets/zenvy_protein_shake_bottles_1773839980833.png", "category": "Mass Gainer" }
    ]
  },
  {
    "id": "boutique-fruits-elite",
    "name": "Fresh Harvest: Elite",
    "rating": "4.9",
    "time": "30m",
    "description": "Exotic fruit platters and healthy bowls.",
    "imageUrl": "https://picsum.photos/seed/exotic/400/300",
    "categories": ["Platters", "Bowls", "Juices"],
    "menu": [
      { "id": "fp-01", "name": "Exotic Fruit Platter", "price": 180, "description": "Dragon fruit, Mango, Kiwi & Berries.", "image": "https://picsum.photos/seed/fruit-platter/400/300", "category": "Platters" },
      { "id": "fp-02", "name": "Power Citrus Bowl", "price": 140, "description": "Orange, Grapefruit & Pomegranate.", "image": "https://picsum.photos/seed/citrus/400/300", "category": "Bowls" }
    ]
  },
  {
    "id": "gym-gear",
    "name": "Zenvy Elite Gear",
    "rating": "5.0",
    "time": "Same Day",
    "description": "Professional training equipment and fitness accessories.",
    "imageUrl": "https://picsum.photos/seed/gym/400/300",
    "categories": ["Lifting Belts", "Straps", "Accessories"],
    "menu": [
      { "id": "gg-1", "name": "Professional Lever Belt", "price": 2500, "description": "13mm thick genuine leather with steel lever.", "image": "https://picsum.photos/seed/belt/400/300", "category": "Lifting Belts" },
      { "id": "gg-2", "name": "Gold-Grip Lifting Straps", "price": 450, "description": "Heavy-duty cotton with anti-slip gold grip.", "image": "https://picsum.photos/seed/straps/400/300", "category": "Straps" },
      { "id": "gg-3", "name": "Elite Matte Shaker", "price": 800, "description": "Stainless steel, 750ml with leak-proof lid.", "image": "https://picsum.photos/seed/shaker/400/300", "category": "Accessories" }
    ]
  },
  {
    "id": "boutique-summer-elite",
    "name": "Summer Oasis: Elite",
    "rating": "5.0",
    "time": "15m",
    "description": "Premium seasonal coolants and refreshing summer treats.",
    "imageUrl": "https://picsum.photos/seed/summer/400/300",
    "categories": ["Coolants", "Traditional", "Ice Creams"],
    "menu": [
      { "id": "ss-01", "name": "Chilled Tender Coconut", "price": 60, "description": "Freshly cut natural coconut water with pulp.", "image": "https://picsum.photos/seed/coconut/400/300", "category": "Coolants" },
      { "id": "ss-02", "name": "Golden Badam Palu", "price": 90, "description": "Authentic almond milk with saffron and nuts.", "image": "https://picsum.photos/seed/badam/400/300", "category": "Traditional" },
      { "id": "ss-03", "name": "Zesty Masala Soda", "price": 50, "description": "Refreshing lime soda with a secret spice blend.", "image": "https://picsum.photos/seed/soda/400/300", "category": "Coolants" },
      { "id": "ss-04", "name": "Traditional Sugandhi", "price": 70, "description": "Natural Sarsaparilla coolant with lemon.", "image": "https://picsum.photos/seed/herb/400/300", "category": "Traditional" },
      { "id": "ss-05", "name": "Artisanal Mango Gelato", "price": 150, "description": "House-made creamy mango ice cream.", "image": "https://picsum.photos/seed/mango/400/300", "category": "Ice Creams" }
    ]
  },
  {
    "id": "boutique-bakery-elite",
    "name": "Zenvy Bakery: Elite",
    "rating": "5.0",
    "time": "20m",
    "description": "Handcrafted sourdough and butter-rich French pastries.",
    "imageUrl": "https://picsum.photos/seed/pastry/400/300",
    "categories": ["Pastries", "Sourdough", "Cookies"],
    "menu": [
      { "id": "bak-01", "name": "Flaky Butter Croissant", "price": 120, "description": "Authentic French style, 24-layer buttery pastry.", "image": "https://picsum.photos/seed/croissant/400/300", "category": "Pastries" },
      { "id": "bak-02", "name": "Dark Chocolate Cookie", "price": 80, "description": "Sea salt and 70% dark Belgian chocolate.", "image": "https://picsum.photos/seed/dark-choc/400/300", "category": "Cookies" },
      { "id": "bak-03", "name": "Red Velvet Cupcake", "price": 95, "description": "Classic red velvet with cream cheese frosting.", "image": "https://picsum.photos/seed/cupcake/400/300", "category": "Cupcakes" },
      { "id": "bak-04", "name": "Zenvy Signature Cake", "price": 1200, "description": "Luxurious tiered Belgian chocolate cake.", "image": "https://picsum.photos/seed/cake/400/300", "category": "Cakes", "isCake": true }
    ]
  },
  {
    "id": "boutique-sweets-elite",
    "name": "Royal Sweet Boutique: Elite",
    "rating": "5.0",
    "time": "15m",
    "description": "Gourmet traditional Indian sweets and fine pralines.",
    "imageUrl": "https://picsum.photos/seed/sweets/400/300",
    "categories": ["Traditional", "Gourmet", "Festive"],
    "menu": [
      { "id": "swt-01", "name": "Saffron Gulab Jamun", "price": 110, "description": "Soft milk dumplings in infused saffron syrup.", "image": "https://picsum.photos/seed/ras/400/300", "category": "Traditional" },
      { "id": "swt-02", "name": "Pistachio Rasmalai", "price": 130, "description": "Kesar infused milk discs with crushed pistachios.", "image": "https://picsum.photos/seed/pistachio/400/300", "category": "Traditional" },
      { "id": "swt-03", "name": "Kaju Katli (Elite Edition)", "price": 250, "description": "Premium cashews with pure silver vark.", "image": "/assets/kaju_katli_elite.png", "category": "Gourmet" }
    ]
  }
];

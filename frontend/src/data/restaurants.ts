export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  rating?: string;
  time?: string;
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
    "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs", "Main Course"],
    "menu": [
      { "id": "bir-01", "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", "category": "Biryani" },
      { "id": "bir-02", "name": "Royal Egg Biryani", "price": 220, "description": "Fragrant rice with double eggs.", "image": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400", "category": "Biryani" },
      { "id": "bir-03", "name": "Chicken Tikka Kebab", "price": 180, "description": "Juicy grilled chicken skewers.", "image": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400", "category": "Kebabs" },
      { "id": "bir-04", "name": "Hyderabadi Dum Biryani", "price": 250, "description": "Classic slow-cooked chicken biryani.", "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=400", "category": "Biryani" },
      { "id": "bir-05", "name": "Paneer Tikka Kebab", "price": 160, "description": "Grilled cottage cheese with herbs.", "image": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400", "category": "Kebabs" },
      { "id": "bir-06", "name": "Tandoori Roti", "price": 40, "description": "Freshly baked clay oven bread.", "image": "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400", "category": "Main Course" },
      { "id": "bir-07", "name": "Butter Chicken", "price": 240, "description": "Creamy tomato based chicken curry.", "image": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400", "category": "Main Course" },
      { "id": "bir-08", "name": "Dal Makhani", "price": 190, "description": "Rich black lentils cooked overnight.", "image": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400", "category": "Main Course" },
      { "id": "bir-09", "name": "Garlic Naan", "price": 60, "description": "Soft bread with toasted garlic.", "image": "https://images.unsplash.com/photo-1601050638917-3f0483810bb2?w=400", "category": "Main Course" },
      { "id": "bir-10", "name": "Gulab Jamun", "price": 80, "description": "Sweet milk dumplings in syrup.", "image": "https://images.unsplash.com/photo-1596797038530-2c39bb9ed9bc?w=400", "category": "Dessert" }
    ]
  },
  {
    "id": "burger-club",
    "name": "The Burger Club",
    "rating": "4.6",
    "time": "20m",
    "description": "Gourmet burgers and artisanal sides.",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400",
    "categories": ["Burgers", "Sides", "Shakes"],
    "menu": [
      { "id": "brg-01", "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "Burgers" },
      { "id": "brg-02", "name": "Bacon Blaze Burger", "price": 220, "description": "Crispy bacon with spicy aioli.", "image": "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400", "category": "Burgers" },
      { "id": "brg-03", "name": "Mushroom Swiss", "price": 190, "description": "Sautéed mushrooms and swiss cheese.", "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400", "category": "Burgers" },
      { "id": "brg-04", "name": "Peri Peri Chicken Burger", "price": 180, "description": "Flaming peri peri grilled chicken.", "image": "https://images.unsplash.com/photo-1513185158878-8d8c182b013d?w=400", "category": "Burgers" },
      { "id": "brg-05", "name": "Veggie Delight", "price": 140, "description": "Crispy veg patty with fresh greens.", "image": "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400", "category": "Burgers" },
      { "id": "brg-06", "name": "Peri Peri Fries", "price": 80, "description": "Spicy seasoned crinkle cut fries.", "image": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400", "category": "Sides" },
      { "id": "brg-07", "name": "Onion Rings", "price": 90, "description": "Beer battered crispy onion rings.", "image": "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400", "category": "Sides" },
      { "id": "brg-08", "name": "Chocolate Shake", "price": 120, "description": "Thick belgian chocolate shake.", "image": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400", "category": "Shakes" },
      { "id": "brg-09", "name": "Strawberry Frost", "price": 110, "description": "Fresh strawberry creamy shake.", "image": "https://images.unsplash.com/photo-1579739678184-fa0c493a22ec?w=400", "category": "Shakes" },
      { "id": "brg-10", "name": "Chicken Nuggets", "price": 130, "description": "Crispy golden chicken bites.", "image": "https://images.unsplash.com/photo-1562967914-608f82629710?w=400", "category": "Sides" }
    ]
  },
  {
    "id": "pizza-paradise",
    "name": "Pizza Paradise",
    "rating": "4.7",
    "time": "25m",
    "description": "Authentic wood-fired pizzas.",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    "categories": ["Pizza", "Pasta", "Sides"],
    "menu": [
      { "id": "piz-01", "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "https://images.unsplash.com/photo-1574071318508-1cdbad80ad50?w=400", "category": "Pizza" },
      { "id": "piz-02", "name": "Pepperoni Feast", "price": 350, "description": "Double pepperoni with herb blend.", "image": "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400", "category": "Pizza" },
      { "id": "piz-03", "name": "Farmhouse Special", "price": 320, "description": "Bell peppers, mushrooms, corn & onion.", "image": "https://images.unsplash.com/photo-1548365328-8c6db3220e4c?w=400", "category": "Pizza" },
      { "id": "piz-04", "name": "Chicken Tikka Pizza", "price": 340, "description": "Indian fusion tikka with capsicum.", "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400", "category": "Pizza" },
      { "id": "piz-05", "name": "Arrabiata Pasta", "price": 240, "description": "Spicy tomato sauce with penne.", "image": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400", "category": "Pasta" },
      { "id": "piz-06", "name": "Creamy Alfredo", "price": 260, "description": "White sauce pasta with mushrooms.", "image": "https://images.unsplash.com/photo-1645112481338-356cda07504e?w=400", "category": "Pasta" },
      { "id": "piz-07", "name": "Garlic Breadsticks", "price": 90, "description": "Baked fresh with garlic butter.", "image": "https://images.unsplash.com/photo-1549611016-3a7b07c97ffb?w=400", "category": "Sides" },
      { "id": "piz-08", "name": "Stuffed Garlic Bread", "price": 140, "description": "Cheese & jalapeno stuffed bread.", "image": "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=400", "category": "Sides" },
      { "id": "piz-09", "name": "Garden Salad", "price": 120, "description": "Fresh seasonal greens with dressing.", "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400", "category": "Sides" },
      { "id": "piz-10", "name": "Tiramisu Cup", "price": 180, "description": "Coffee-flavored Italian dessert.", "image": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400", "category": "Dessert" }
    ]
  },
  {
    "id": "subway-fresh",
    "name": "Subway Fresh",
    "rating": "4.4",
    "time": "12m",
    "description": "Healthy subs and wraps made fresh.",
    "imageUrl": "https://images.unsplash.com/photo-1598214811103-ba9c0d11ec9c?w=400",
    "categories": ["Subs", "Salads", "Cookies"],
    "menu": [
      { "id": "sub-01", "name": "Roasted Chicken Sub", "price": 190, "description": "Succulent chicken with fresh veggies.", "image": "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400", "category": "Subs" },
      { "id": "sub-02", "name": "Paneer Tikka Sub", "price": 170, "description": "Spicy paneer in choice of bread.", "image": "https://images.unsplash.com/photo-1534422298391-e4f8c170dbbd?w=400", "category": "Subs" },
      { "id": "sub-03", "name": "Italian B.M.T.", "price": 220, "description": "Genoa salami, pepperoni & ham.", "image": "https://images.unsplash.com/photo-1509722747041-619da372295a?w=400", "category": "Subs" },
      { "id": "sub-04", "name": "Vegi Delite", "price": 140, "description": "Loaded with fresh seasonal veggies.", "image": "https://images.unsplash.com/photo-1619096279114-42353723722e?w=400", "category": "Subs" },
      { "id": "sub-05", "name": "Chicken Kofta Sub", "price": 200, "description": "Spicy chicken meatballs with sauce.", "image": "https://images.unsplash.com/photo-1529692236671-f1f6cf9460bb?w=400", "category": "Subs" },
      { "id": "sub-06", "name": "Aloo Patty Wrap", "price": 130, "description": "Spiced potato patty in a soft wrap.", "image": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400", "category": "Subs" },
      { "id": "sub-07", "name": "Corn & Peas Salad", "price": 160, "description": "Sweet corn and peas mix.", "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400", "category": "Salads" },
      { "id": "sub-08", "name": "Dark Chocolate Cookie", "price": 50, "description": "Soft & chewy chocolate chip cookie.", "image": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400", "category": "Cookies" },
      { "id": "sub-09", "name": "Oatmeal Raisin Cookie", "price": 50, "description": "Healthy oats and raisin sweet.", "image": "https://images.unsplash.com/photo-1605807646983-377bc5a76493?w=400", "category": "Cookies" },
      { "id": "sub-10", "name": "Coke Zero", "price": 40, "description": "Chilled sugar-free refreshment.", "image": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400", "category": "Drinks" }
    ]
  },
  {
    "id": "la-pinoz",
    "name": "La Pino'z",
    "rating": "4.5",
    "time": "18m",
    "description": "Innovative pizza slices & giant pizzas.",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
    "categories": ["Pizza", "Sides", "Beverages"],
    "menu": [
      { "id": "lap-01", "name": "7 Layer Pizza", "price": 380, "description": "Loaded with unique layers of toppings.", "image": "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400", "category": "Pizza" },
      { "id": "lap-02", "name": "Cheesy Macaroni", "price": 180, "description": "Hot & cheesy classic macaroni.", "image": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400", "category": "Sides" },
      { "id": "lap-03", "name": "Paneer Makhani Slice", "price": 120, "description": "Giant slice with makhani gravy.", "image": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400", "category": "Pizza" },
      { "id": "lap-04", "name": "Peri Peri Garlic Bread", "price": 110, "description": "Spicy twist on garlic bread.", "image": "https://images.unsplash.com/photo-1549611016-3a7b07c97ffb?w=400", "category": "Sides" },
      { "id": "lap-05", "name": "English Vinglish Pizza", "price": 290, "description": "Exotic vegetable pizza blend.", "image": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400", "category": "Pizza" },
      { "id": "lap-06", "name": "Chicken Tikka Tacos", "price": 150, "description": "Fusion tacos with tikka filling.", "image": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400", "category": "Sides" },
      { "id": "lap-07", "name": "Fries Overloaded", "price": 140, "description": "Fries topped with cheese & jalapenos.", "image": "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400", "category": "Sides" },
      { "id": "lap-08", "name": "Choco Lava Cake", "price": 90, "description": "Molten chocolate center cake.", "image": "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400", "category": "Dessert" },
      { "id": "lap-09", "name": "Cold Coffee", "price": 100, "description": "Creamy whipped cold coffee.", "image": "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=400", "category": "Beverages" },
      { "id": "lap-10", "name": "Mountain Dew", "price": 40, "description": "Chilled citrus refreshment.", "image": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400", "category": "Beverages" }
    ]
  }
];

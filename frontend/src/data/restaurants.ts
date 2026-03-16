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
    "rating": "4.5",
    "time": "16m",
    "description": "Authentic Biryani Hub serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Biryani",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "bir-01",
        "name": "Special Pepperoni",
        "price": 113,
        "description": "Delicious Special Pepperoni from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-02",
        "name": "Royal Farmhouse",
        "price": 127,
        "description": "Delicious Royal Farmhouse from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-03",
        "name": "Spicy Cheese Burst",
        "price": 141,
        "description": "Delicious Spicy Cheese Burst from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-04",
        "name": "Crispy Paneer Tikka",
        "price": 155,
        "description": "Delicious Crispy Paneer Tikka from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-05",
        "name": "Premium Chicken Festive",
        "price": 174,
        "description": "Delicious Premium Chicken Festive from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-06",
        "name": "Loaded Margherita",
        "price": 188,
        "description": "Delicious Loaded Margherita from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-07",
        "name": "Gourmet Pepperoni Plus",
        "price": 202,
        "description": "Delicious Gourmet Pepperoni from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-08",
        "name": "Rustic Farmhouse Plus",
        "price": 216,
        "description": "Delicious Rustic Farmhouse from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-09",
        "name": "Signature Cheese Burst Plus",
        "price": 230,
        "description": "Delicious Signature Cheese Burst from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-10",
        "name": "Classic Paneer Tikka Plus",
        "price": 249,
        "description": "Delicious Classic Paneer Tikka from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-11",
        "name": "Special Chicken Festive Plus",
        "price": 263,
        "description": "Delicious Special Chicken Festive from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-12",
        "name": "Royal Margherita Plus",
        "price": 277,
        "description": "Delicious Royal Margherita from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-13",
        "name": "Spicy Pepperoni Plus",
        "price": 291,
        "description": "Delicious Spicy Pepperoni from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-14",
        "name": "Crispy Farmhouse Plus",
        "price": 305,
        "description": "Delicious Crispy Farmhouse from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-15",
        "name": "Premium Cheese Burst Plus",
        "price": 324,
        "description": "Delicious Premium Cheese Burst from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-16",
        "name": "Loaded Paneer Tikka Plus",
        "price": 338,
        "description": "Delicious Loaded Paneer Tikka from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-17",
        "name": "Gourmet Chicken Festive Plus",
        "price": 352,
        "description": "Delicious Gourmet Chicken Festive from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-18",
        "name": "Rustic Margherita Plus",
        "price": 366,
        "description": "Delicious Rustic Margherita from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-19",
        "name": "Signature Pepperoni Plus",
        "price": 380,
        "description": "Delicious Signature Pepperoni from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-20",
        "name": "Classic Farmhouse Plus",
        "price": 399,
        "description": "Delicious Classic Farmhouse from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-21",
        "name": "Special Cheese Burst Plus",
        "price": 413,
        "description": "Delicious Special Cheese Burst from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-22",
        "name": "Royal Paneer Tikka Plus",
        "price": 427,
        "description": "Delicious Royal Paneer Tikka from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-23",
        "name": "Spicy Chicken Festive Plus",
        "price": 441,
        "description": "Delicious Spicy Chicken Festive from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-24",
        "name": "Crispy Margherita Plus",
        "price": 455,
        "description": "Delicious Crispy Margherita from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-25",
        "name": "Premium Pepperoni Plus",
        "price": 474,
        "description": "Delicious Premium Pepperoni from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-26",
        "name": "Loaded Farmhouse Plus",
        "price": 488,
        "description": "Delicious Loaded Farmhouse from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-27",
        "name": "Gourmet Cheese Burst Plus",
        "price": 502,
        "description": "Delicious Gourmet Cheese Burst from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-28",
        "name": "Rustic Paneer Tikka Plus",
        "price": 516,
        "description": "Delicious Rustic Paneer Tikka from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-29",
        "name": "Signature Chicken Festive Plus",
        "price": 530,
        "description": "Delicious Signature Chicken Festive from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-30",
        "name": "Classic Margherita Plus",
        "price": 549,
        "description": "Delicious Classic Margherita from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-31",
        "name": "Special Pepperoni Plus",
        "price": 563,
        "description": "Delicious Special Pepperoni from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "bir-32",
        "name": "Royal Farmhouse Plus",
        "price": 577,
        "description": "Delicious Royal Farmhouse from BIR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      }
    ]
  },
  {
    "id": "the-burger-club",
    "name": "The Burger Club",
    "rating": "4.3",
    "time": "28m",
    "description": "Authentic The Burger Club serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Burgers",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "the-01",
        "name": "Special Chicken Zinger",
        "price": 113,
        "description": "Delicious Special Chicken Zinger from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-02",
        "name": "Royal Double Cheese",
        "price": 127,
        "description": "Delicious Royal Double Cheese from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-03",
        "name": "Spicy Aloo Tikki",
        "price": 141,
        "description": "Delicious Spicy Aloo Tikki from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-04",
        "name": "Crispy Spicy Paneer",
        "price": 155,
        "description": "Delicious Crispy Spicy Paneer from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-05",
        "name": "Premium Crispy Chicken",
        "price": 174,
        "description": "Delicious Premium Crispy Chicken from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-06",
        "name": "Loaded Veg Whopper",
        "price": 188,
        "description": "Delicious Loaded Veg Whopper from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-07",
        "name": "Gourmet Chicken Zinger Plus",
        "price": 202,
        "description": "Delicious Gourmet Chicken Zinger from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-08",
        "name": "Rustic Double Cheese Plus",
        "price": 216,
        "description": "Delicious Rustic Double Cheese from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-09",
        "name": "Signature Aloo Tikki Plus",
        "price": 230,
        "description": "Delicious Signature Aloo Tikki from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-10",
        "name": "Classic Spicy Paneer Plus",
        "price": 249,
        "description": "Delicious Classic Spicy Paneer from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-11",
        "name": "Special Crispy Chicken Plus",
        "price": 263,
        "description": "Delicious Special Crispy Chicken from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-12",
        "name": "Royal Veg Whopper Plus",
        "price": 277,
        "description": "Delicious Royal Veg Whopper from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-13",
        "name": "Spicy Chicken Zinger Plus",
        "price": 291,
        "description": "Delicious Spicy Chicken Zinger from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-14",
        "name": "Crispy Double Cheese Plus",
        "price": 305,
        "description": "Delicious Crispy Double Cheese from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-15",
        "name": "Premium Aloo Tikki Plus",
        "price": 324,
        "description": "Delicious Premium Aloo Tikki from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-16",
        "name": "Loaded Spicy Paneer Plus",
        "price": 338,
        "description": "Delicious Loaded Spicy Paneer from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-17",
        "name": "Gourmet Crispy Chicken Plus",
        "price": 352,
        "description": "Delicious Gourmet Crispy Chicken from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-18",
        "name": "Rustic Veg Whopper Plus",
        "price": 366,
        "description": "Delicious Rustic Veg Whopper from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-19",
        "name": "Signature Chicken Zinger Plus",
        "price": 380,
        "description": "Delicious Signature Chicken Zinger from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-20",
        "name": "Classic Double Cheese Plus",
        "price": 399,
        "description": "Delicious Classic Double Cheese from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-21",
        "name": "Special Aloo Tikki Plus",
        "price": 413,
        "description": "Delicious Special Aloo Tikki from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-22",
        "name": "Royal Spicy Paneer Plus",
        "price": 427,
        "description": "Delicious Royal Spicy Paneer from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-23",
        "name": "Spicy Crispy Chicken Plus",
        "price": 441,
        "description": "Delicious Spicy Crispy Chicken from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-24",
        "name": "Crispy Veg Whopper Plus",
        "price": 455,
        "description": "Delicious Crispy Veg Whopper from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-25",
        "name": "Premium Chicken Zinger Plus",
        "price": 474,
        "description": "Delicious Premium Chicken Zinger from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-26",
        "name": "Loaded Double Cheese Plus",
        "price": 488,
        "description": "Delicious Loaded Double Cheese from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-27",
        "name": "Gourmet Aloo Tikki Plus",
        "price": 502,
        "description": "Delicious Gourmet Aloo Tikki from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-28",
        "name": "Rustic Spicy Paneer Plus",
        "price": 516,
        "description": "Delicious Rustic Spicy Paneer from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-29",
        "name": "Signature Crispy Chicken Plus",
        "price": 530,
        "description": "Delicious Signature Crispy Chicken from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-30",
        "name": "Classic Veg Whopper Plus",
        "price": 549,
        "description": "Delicious Classic Veg Whopper from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-31",
        "name": "Special Chicken Zinger Plus",
        "price": 563,
        "description": "Delicious Special Chicken Zinger from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "the-32",
        "name": "Royal Double Cheese Plus",
        "price": 577,
        "description": "Delicious Royal Double Cheese from THE, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      }
    ]
  },
  {
    "id": "pizza-paradise",
    "name": "Pizza Paradise",
    "rating": "4.7",
    "time": "18m",
    "description": "Authentic Pizza Paradise serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Pizza",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "piz-01",
        "name": "Special Mutton Fry",
        "price": 113,
        "description": "Delicious Special Mutton Fry from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-02",
        "name": "Royal Egg Biryani",
        "price": 127,
        "description": "Delicious Royal Egg Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-03",
        "name": "Spicy Veg Pulao",
        "price": 141,
        "description": "Delicious Spicy Veg Pulao from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-04",
        "name": "Crispy Hyderabadi Special",
        "price": 155,
        "description": "Delicious Crispy Hyderabadi Special from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-05",
        "name": "Premium Zafarani Biryani",
        "price": 174,
        "description": "Delicious Premium Zafarani Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-06",
        "name": "Loaded Chicken Dum",
        "price": 188,
        "description": "Delicious Loaded Chicken Dum from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-07",
        "name": "Gourmet Mutton Fry Plus",
        "price": 202,
        "description": "Delicious Gourmet Mutton Fry from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-08",
        "name": "Rustic Egg Biryani Plus",
        "price": 216,
        "description": "Delicious Rustic Egg Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-09",
        "name": "Signature Veg Pulao Plus",
        "price": 230,
        "description": "Delicious Signature Veg Pulao from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-10",
        "name": "Classic Hyderabadi Special Plus",
        "price": 249,
        "description": "Delicious Classic Hyderabadi Special from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-11",
        "name": "Special Zafarani Biryani Plus",
        "price": 263,
        "description": "Delicious Special Zafarani Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-12",
        "name": "Royal Chicken Dum Plus",
        "price": 277,
        "description": "Delicious Royal Chicken Dum from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-13",
        "name": "Spicy Mutton Fry Plus",
        "price": 291,
        "description": "Delicious Spicy Mutton Fry from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-14",
        "name": "Crispy Egg Biryani Plus",
        "price": 305,
        "description": "Delicious Crispy Egg Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-15",
        "name": "Premium Veg Pulao Plus",
        "price": 324,
        "description": "Delicious Premium Veg Pulao from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-16",
        "name": "Loaded Hyderabadi Special Plus",
        "price": 338,
        "description": "Delicious Loaded Hyderabadi Special from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-17",
        "name": "Gourmet Zafarani Biryani Plus",
        "price": 352,
        "description": "Delicious Gourmet Zafarani Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-18",
        "name": "Rustic Chicken Dum Plus",
        "price": 366,
        "description": "Delicious Rustic Chicken Dum from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-19",
        "name": "Signature Mutton Fry Plus",
        "price": 380,
        "description": "Delicious Signature Mutton Fry from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-20",
        "name": "Classic Egg Biryani Plus",
        "price": 399,
        "description": "Delicious Classic Egg Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-21",
        "name": "Special Veg Pulao Plus",
        "price": 413,
        "description": "Delicious Special Veg Pulao from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-22",
        "name": "Royal Hyderabadi Special Plus",
        "price": 427,
        "description": "Delicious Royal Hyderabadi Special from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-23",
        "name": "Spicy Zafarani Biryani Plus",
        "price": 441,
        "description": "Delicious Spicy Zafarani Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-24",
        "name": "Crispy Chicken Dum Plus",
        "price": 455,
        "description": "Delicious Crispy Chicken Dum from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-25",
        "name": "Premium Mutton Fry Plus",
        "price": 474,
        "description": "Delicious Premium Mutton Fry from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-26",
        "name": "Loaded Egg Biryani Plus",
        "price": 488,
        "description": "Delicious Loaded Egg Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-27",
        "name": "Gourmet Veg Pulao Plus",
        "price": 502,
        "description": "Delicious Gourmet Veg Pulao from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-28",
        "name": "Rustic Hyderabadi Special Plus",
        "price": 516,
        "description": "Delicious Rustic Hyderabadi Special from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-29",
        "name": "Signature Zafarani Biryani Plus",
        "price": 530,
        "description": "Delicious Signature Zafarani Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-30",
        "name": "Classic Chicken Dum Plus",
        "price": 549,
        "description": "Delicious Classic Chicken Dum from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-31",
        "name": "Special Mutton Fry Plus",
        "price": 563,
        "description": "Delicious Special Mutton Fry from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "piz-32",
        "name": "Royal Egg Biryani Plus",
        "price": 577,
        "description": "Delicious Royal Egg Biryani from PIZ, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      }
    ]
  },
  {
    "id": "dragon-express",
    "name": "Dragon Express",
    "rating": "4.5",
    "time": "18m",
    "description": "Authentic Dragon Express serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Chinese",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "dra-01",
        "name": "Special Manchurian",
        "price": 113,
        "description": "Delicious Special Manchurian from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-02",
        "name": "Royal Fried Rice",
        "price": 127,
        "description": "Delicious Royal Fried Rice from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-03",
        "name": "Spicy Spring Rolls",
        "price": 141,
        "description": "Delicious Spicy Spring Rolls from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-04",
        "name": "Crispy Chilli Chicken",
        "price": 155,
        "description": "Delicious Crispy Chilli Chicken from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-05",
        "name": "Premium Momos",
        "price": 174,
        "description": "Delicious Premium Momos from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-06",
        "name": "Loaded Noodles",
        "price": 188,
        "description": "Delicious Loaded Noodles from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-07",
        "name": "Gourmet Manchurian Plus",
        "price": 202,
        "description": "Delicious Gourmet Manchurian from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-08",
        "name": "Rustic Fried Rice Plus",
        "price": 216,
        "description": "Delicious Rustic Fried Rice from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-09",
        "name": "Signature Spring Rolls Plus",
        "price": 230,
        "description": "Delicious Signature Spring Rolls from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-10",
        "name": "Classic Chilli Chicken Plus",
        "price": 249,
        "description": "Delicious Classic Chilli Chicken from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-11",
        "name": "Special Momos Plus",
        "price": 263,
        "description": "Delicious Special Momos from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-12",
        "name": "Royal Noodles Plus",
        "price": 277,
        "description": "Delicious Royal Noodles from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-13",
        "name": "Spicy Manchurian Plus",
        "price": 291,
        "description": "Delicious Spicy Manchurian from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-14",
        "name": "Crispy Fried Rice Plus",
        "price": 305,
        "description": "Delicious Crispy Fried Rice from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-15",
        "name": "Premium Spring Rolls Plus",
        "price": 324,
        "description": "Delicious Premium Spring Rolls from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-16",
        "name": "Loaded Chilli Chicken Plus",
        "price": 338,
        "description": "Delicious Loaded Chilli Chicken from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-17",
        "name": "Gourmet Momos Plus",
        "price": 352,
        "description": "Delicious Gourmet Momos from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-18",
        "name": "Rustic Noodles Plus",
        "price": 366,
        "description": "Delicious Rustic Noodles from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-19",
        "name": "Signature Manchurian Plus",
        "price": 380,
        "description": "Delicious Signature Manchurian from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-20",
        "name": "Classic Fried Rice Plus",
        "price": 399,
        "description": "Delicious Classic Fried Rice from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-21",
        "name": "Special Spring Rolls Plus",
        "price": 413,
        "description": "Delicious Special Spring Rolls from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-22",
        "name": "Royal Chilli Chicken Plus",
        "price": 427,
        "description": "Delicious Royal Chilli Chicken from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-23",
        "name": "Spicy Momos Plus",
        "price": 441,
        "description": "Delicious Spicy Momos from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-24",
        "name": "Crispy Noodles Plus",
        "price": 455,
        "description": "Delicious Crispy Noodles from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-25",
        "name": "Premium Manchurian Plus",
        "price": 474,
        "description": "Delicious Premium Manchurian from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-26",
        "name": "Loaded Fried Rice Plus",
        "price": 488,
        "description": "Delicious Loaded Fried Rice from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-27",
        "name": "Gourmet Spring Rolls Plus",
        "price": 502,
        "description": "Delicious Gourmet Spring Rolls from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-28",
        "name": "Rustic Chilli Chicken Plus",
        "price": 516,
        "description": "Delicious Rustic Chilli Chicken from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-29",
        "name": "Signature Momos Plus",
        "price": 530,
        "description": "Delicious Signature Momos from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-30",
        "name": "Classic Noodles Plus",
        "price": 549,
        "description": "Delicious Classic Noodles from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-31",
        "name": "Special Manchurian Plus",
        "price": 563,
        "description": "Delicious Special Manchurian from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "dra-32",
        "name": "Royal Fried Rice Plus",
        "price": 577,
        "description": "Delicious Royal Fried Rice from DRA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      }
    ]
  },
  {
    "id": "dosa-delight",
    "name": "Dosa Delight",
    "rating": "4.4",
    "time": "25m",
    "description": "Authentic Dosa Delight serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "South Indian",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "dos-01",
        "name": "Special Idli Sambhar",
        "price": 113,
        "description": "Delicious Special Idli Sambhar from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-02",
        "name": "Royal Vada",
        "price": 127,
        "description": "Delicious Royal Vada from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-03",
        "name": "Spicy Uttapam",
        "price": 141,
        "description": "Delicious Spicy Uttapam from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-04",
        "name": "Crispy Pongal",
        "price": 155,
        "description": "Delicious Crispy Pongal from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-05",
        "name": "Premium Upma",
        "price": 174,
        "description": "Delicious Premium Upma from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-06",
        "name": "Loaded Masala Dosa",
        "price": 188,
        "description": "Delicious Loaded Masala Dosa from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-07",
        "name": "Gourmet Idli Sambhar Plus",
        "price": 202,
        "description": "Delicious Gourmet Idli Sambhar from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-08",
        "name": "Rustic Vada Plus",
        "price": 216,
        "description": "Delicious Rustic Vada from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-09",
        "name": "Signature Uttapam Plus",
        "price": 230,
        "description": "Delicious Signature Uttapam from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-10",
        "name": "Classic Pongal Plus",
        "price": 249,
        "description": "Delicious Classic Pongal from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-11",
        "name": "Special Upma Plus",
        "price": 263,
        "description": "Delicious Special Upma from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-12",
        "name": "Royal Masala Dosa Plus",
        "price": 277,
        "description": "Delicious Royal Masala Dosa from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-13",
        "name": "Spicy Idli Sambhar Plus",
        "price": 291,
        "description": "Delicious Spicy Idli Sambhar from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-14",
        "name": "Crispy Vada Plus",
        "price": 305,
        "description": "Delicious Crispy Vada from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-15",
        "name": "Premium Uttapam Plus",
        "price": 324,
        "description": "Delicious Premium Uttapam from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-16",
        "name": "Loaded Pongal Plus",
        "price": 338,
        "description": "Delicious Loaded Pongal from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-17",
        "name": "Gourmet Upma Plus",
        "price": 352,
        "description": "Delicious Gourmet Upma from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-18",
        "name": "Rustic Masala Dosa Plus",
        "price": 366,
        "description": "Delicious Rustic Masala Dosa from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-19",
        "name": "Signature Idli Sambhar Plus",
        "price": 380,
        "description": "Delicious Signature Idli Sambhar from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-20",
        "name": "Classic Vada Plus",
        "price": 399,
        "description": "Delicious Classic Vada from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-21",
        "name": "Special Uttapam Plus",
        "price": 413,
        "description": "Delicious Special Uttapam from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-22",
        "name": "Royal Pongal Plus",
        "price": 427,
        "description": "Delicious Royal Pongal from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-23",
        "name": "Spicy Upma Plus",
        "price": 441,
        "description": "Delicious Spicy Upma from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-24",
        "name": "Crispy Masala Dosa Plus",
        "price": 455,
        "description": "Delicious Crispy Masala Dosa from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-25",
        "name": "Premium Idli Sambhar Plus",
        "price": 474,
        "description": "Delicious Premium Idli Sambhar from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-26",
        "name": "Loaded Vada Plus",
        "price": 488,
        "description": "Delicious Loaded Vada from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-27",
        "name": "Gourmet Uttapam Plus",
        "price": 502,
        "description": "Delicious Gourmet Uttapam from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-28",
        "name": "Rustic Pongal Plus",
        "price": 516,
        "description": "Delicious Rustic Pongal from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-29",
        "name": "Signature Upma Plus",
        "price": 530,
        "description": "Delicious Signature Upma from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-30",
        "name": "Classic Masala Dosa Plus",
        "price": 549,
        "description": "Delicious Classic Masala Dosa from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-31",
        "name": "Special Idli Sambhar Plus",
        "price": 563,
        "description": "Delicious Special Idli Sambhar from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "dos-32",
        "name": "Royal Vada Plus",
        "price": 577,
        "description": "Delicious Royal Vada from DOS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      }
    ]
  },
  {
    "id": "subway-fresh",
    "name": "Subway Fresh",
    "rating": "4.6",
    "time": "22m",
    "description": "Authentic Subway Fresh serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Beverages",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "sub-01",
        "name": "Special Mocktail",
        "price": 113,
        "description": "Delicious Special Mocktail from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-02",
        "name": "Royal Fruit Juice",
        "price": 127,
        "description": "Delicious Royal Fruit Juice from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-03",
        "name": "Spicy Tea",
        "price": 141,
        "description": "Delicious Spicy Tea from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-04",
        "name": "Crispy Lemonade",
        "price": 155,
        "description": "Delicious Crispy Lemonade from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-05",
        "name": "Premium Shake",
        "price": 174,
        "description": "Delicious Premium Shake from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-06",
        "name": "Loaded Cold Coffee",
        "price": 188,
        "description": "Delicious Loaded Cold Coffee from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-07",
        "name": "Gourmet Mocktail Plus",
        "price": 202,
        "description": "Delicious Gourmet Mocktail from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-08",
        "name": "Rustic Fruit Juice Plus",
        "price": 216,
        "description": "Delicious Rustic Fruit Juice from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-09",
        "name": "Signature Tea Plus",
        "price": 230,
        "description": "Delicious Signature Tea from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-10",
        "name": "Classic Lemonade Plus",
        "price": 249,
        "description": "Delicious Classic Lemonade from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-11",
        "name": "Special Shake Plus",
        "price": 263,
        "description": "Delicious Special Shake from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-12",
        "name": "Royal Cold Coffee Plus",
        "price": 277,
        "description": "Delicious Royal Cold Coffee from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-13",
        "name": "Spicy Mocktail Plus",
        "price": 291,
        "description": "Delicious Spicy Mocktail from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-14",
        "name": "Crispy Fruit Juice Plus",
        "price": 305,
        "description": "Delicious Crispy Fruit Juice from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-15",
        "name": "Premium Tea Plus",
        "price": 324,
        "description": "Delicious Premium Tea from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-16",
        "name": "Loaded Lemonade Plus",
        "price": 338,
        "description": "Delicious Loaded Lemonade from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-17",
        "name": "Gourmet Shake Plus",
        "price": 352,
        "description": "Delicious Gourmet Shake from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-18",
        "name": "Rustic Cold Coffee Plus",
        "price": 366,
        "description": "Delicious Rustic Cold Coffee from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-19",
        "name": "Signature Mocktail Plus",
        "price": 380,
        "description": "Delicious Signature Mocktail from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-20",
        "name": "Classic Fruit Juice Plus",
        "price": 399,
        "description": "Delicious Classic Fruit Juice from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-21",
        "name": "Special Tea Plus",
        "price": 413,
        "description": "Delicious Special Tea from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-22",
        "name": "Royal Lemonade Plus",
        "price": 427,
        "description": "Delicious Royal Lemonade from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-23",
        "name": "Spicy Shake Plus",
        "price": 441,
        "description": "Delicious Spicy Shake from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-24",
        "name": "Crispy Cold Coffee Plus",
        "price": 455,
        "description": "Delicious Crispy Cold Coffee from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-25",
        "name": "Premium Mocktail Plus",
        "price": 474,
        "description": "Delicious Premium Mocktail from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-26",
        "name": "Loaded Fruit Juice Plus",
        "price": 488,
        "description": "Delicious Loaded Fruit Juice from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-27",
        "name": "Gourmet Tea Plus",
        "price": 502,
        "description": "Delicious Gourmet Tea from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-28",
        "name": "Rustic Lemonade Plus",
        "price": 516,
        "description": "Delicious Rustic Lemonade from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-29",
        "name": "Signature Shake Plus",
        "price": 530,
        "description": "Delicious Signature Shake from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-30",
        "name": "Classic Cold Coffee Plus",
        "price": 549,
        "description": "Delicious Classic Cold Coffee from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-31",
        "name": "Special Mocktail Plus",
        "price": 563,
        "description": "Delicious Special Mocktail from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "sub-32",
        "name": "Royal Fruit Juice Plus",
        "price": 577,
        "description": "Delicious Royal Fruit Juice from SUB, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      }
    ]
  },
  {
    "id": "taco-town",
    "name": "Taco Town",
    "rating": "4.5",
    "time": "31m",
    "description": "Authentic Taco Town serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Desserts",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "tac-01",
        "name": "Special Ice Cream",
        "price": 113,
        "description": "Delicious Special Ice Cream from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-02",
        "name": "Royal Brownie",
        "price": 127,
        "description": "Delicious Royal Brownie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-03",
        "name": "Spicy Gulab Jamun",
        "price": 141,
        "description": "Delicious Spicy Gulab Jamun from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-04",
        "name": "Crispy Pastry",
        "price": 155,
        "description": "Delicious Crispy Pastry from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-05",
        "name": "Premium Cookie",
        "price": 174,
        "description": "Delicious Premium Cookie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-06",
        "name": "Loaded Waffle",
        "price": 188,
        "description": "Delicious Loaded Waffle from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-07",
        "name": "Gourmet Ice Cream Plus",
        "price": 202,
        "description": "Delicious Gourmet Ice Cream from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-08",
        "name": "Rustic Brownie Plus",
        "price": 216,
        "description": "Delicious Rustic Brownie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-09",
        "name": "Signature Gulab Jamun Plus",
        "price": 230,
        "description": "Delicious Signature Gulab Jamun from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-10",
        "name": "Classic Pastry Plus",
        "price": 249,
        "description": "Delicious Classic Pastry from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-11",
        "name": "Special Cookie Plus",
        "price": 263,
        "description": "Delicious Special Cookie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-12",
        "name": "Royal Waffle Plus",
        "price": 277,
        "description": "Delicious Royal Waffle from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-13",
        "name": "Spicy Ice Cream Plus",
        "price": 291,
        "description": "Delicious Spicy Ice Cream from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-14",
        "name": "Crispy Brownie Plus",
        "price": 305,
        "description": "Delicious Crispy Brownie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-15",
        "name": "Premium Gulab Jamun Plus",
        "price": 324,
        "description": "Delicious Premium Gulab Jamun from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-16",
        "name": "Loaded Pastry Plus",
        "price": 338,
        "description": "Delicious Loaded Pastry from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-17",
        "name": "Gourmet Cookie Plus",
        "price": 352,
        "description": "Delicious Gourmet Cookie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-18",
        "name": "Rustic Waffle Plus",
        "price": 366,
        "description": "Delicious Rustic Waffle from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-19",
        "name": "Signature Ice Cream Plus",
        "price": 380,
        "description": "Delicious Signature Ice Cream from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-20",
        "name": "Classic Brownie Plus",
        "price": 399,
        "description": "Delicious Classic Brownie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-21",
        "name": "Special Gulab Jamun Plus",
        "price": 413,
        "description": "Delicious Special Gulab Jamun from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-22",
        "name": "Royal Pastry Plus",
        "price": 427,
        "description": "Delicious Royal Pastry from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-23",
        "name": "Spicy Cookie Plus",
        "price": 441,
        "description": "Delicious Spicy Cookie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-24",
        "name": "Crispy Waffle Plus",
        "price": 455,
        "description": "Delicious Crispy Waffle from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-25",
        "name": "Premium Ice Cream Plus",
        "price": 474,
        "description": "Delicious Premium Ice Cream from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-26",
        "name": "Loaded Brownie Plus",
        "price": 488,
        "description": "Delicious Loaded Brownie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-27",
        "name": "Gourmet Gulab Jamun Plus",
        "price": 502,
        "description": "Delicious Gourmet Gulab Jamun from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-28",
        "name": "Rustic Pastry Plus",
        "price": 516,
        "description": "Delicious Rustic Pastry from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-29",
        "name": "Signature Cookie Plus",
        "price": 530,
        "description": "Delicious Signature Cookie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-30",
        "name": "Classic Waffle Plus",
        "price": 549,
        "description": "Delicious Classic Waffle from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-31",
        "name": "Special Ice Cream Plus",
        "price": 563,
        "description": "Delicious Special Ice Cream from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "tac-32",
        "name": "Royal Brownie Plus",
        "price": 577,
        "description": "Delicious Royal Brownie from TAC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      }
    ]
  },
  {
    "id": "kfc-srm",
    "name": "KFC SRM",
    "rating": "4.3",
    "time": "25m",
    "description": "Authentic KFC SRM serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Pizza",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "kfc-01",
        "name": "Special Pepperoni",
        "price": 113,
        "description": "Delicious Special Pepperoni from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-02",
        "name": "Royal Farmhouse",
        "price": 127,
        "description": "Delicious Royal Farmhouse from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-03",
        "name": "Spicy Cheese Burst",
        "price": 141,
        "description": "Delicious Spicy Cheese Burst from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-04",
        "name": "Crispy Paneer Tikka",
        "price": 155,
        "description": "Delicious Crispy Paneer Tikka from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-05",
        "name": "Premium Chicken Festive",
        "price": 174,
        "description": "Delicious Premium Chicken Festive from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-06",
        "name": "Loaded Margherita",
        "price": 188,
        "description": "Delicious Loaded Margherita from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-07",
        "name": "Gourmet Pepperoni Plus",
        "price": 202,
        "description": "Delicious Gourmet Pepperoni from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-08",
        "name": "Rustic Farmhouse Plus",
        "price": 216,
        "description": "Delicious Rustic Farmhouse from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-09",
        "name": "Signature Cheese Burst Plus",
        "price": 230,
        "description": "Delicious Signature Cheese Burst from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-10",
        "name": "Classic Paneer Tikka Plus",
        "price": 249,
        "description": "Delicious Classic Paneer Tikka from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-11",
        "name": "Special Chicken Festive Plus",
        "price": 263,
        "description": "Delicious Special Chicken Festive from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-12",
        "name": "Royal Margherita Plus",
        "price": 277,
        "description": "Delicious Royal Margherita from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-13",
        "name": "Spicy Pepperoni Plus",
        "price": 291,
        "description": "Delicious Spicy Pepperoni from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-14",
        "name": "Crispy Farmhouse Plus",
        "price": 305,
        "description": "Delicious Crispy Farmhouse from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-15",
        "name": "Premium Cheese Burst Plus",
        "price": 324,
        "description": "Delicious Premium Cheese Burst from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-16",
        "name": "Loaded Paneer Tikka Plus",
        "price": 338,
        "description": "Delicious Loaded Paneer Tikka from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-17",
        "name": "Gourmet Chicken Festive Plus",
        "price": 352,
        "description": "Delicious Gourmet Chicken Festive from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-18",
        "name": "Rustic Margherita Plus",
        "price": 366,
        "description": "Delicious Rustic Margherita from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-19",
        "name": "Signature Pepperoni Plus",
        "price": 380,
        "description": "Delicious Signature Pepperoni from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-20",
        "name": "Classic Farmhouse Plus",
        "price": 399,
        "description": "Delicious Classic Farmhouse from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-21",
        "name": "Special Cheese Burst Plus",
        "price": 413,
        "description": "Delicious Special Cheese Burst from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-22",
        "name": "Royal Paneer Tikka Plus",
        "price": 427,
        "description": "Delicious Royal Paneer Tikka from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-23",
        "name": "Spicy Chicken Festive Plus",
        "price": 441,
        "description": "Delicious Spicy Chicken Festive from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-24",
        "name": "Crispy Margherita Plus",
        "price": 455,
        "description": "Delicious Crispy Margherita from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-25",
        "name": "Premium Pepperoni Plus",
        "price": 474,
        "description": "Delicious Premium Pepperoni from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-26",
        "name": "Loaded Farmhouse Plus",
        "price": 488,
        "description": "Delicious Loaded Farmhouse from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-27",
        "name": "Gourmet Cheese Burst Plus",
        "price": 502,
        "description": "Delicious Gourmet Cheese Burst from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-28",
        "name": "Rustic Paneer Tikka Plus",
        "price": 516,
        "description": "Delicious Rustic Paneer Tikka from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-29",
        "name": "Signature Chicken Festive Plus",
        "price": 530,
        "description": "Delicious Signature Chicken Festive from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-30",
        "name": "Classic Margherita Plus",
        "price": 549,
        "description": "Delicious Classic Margherita from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-31",
        "name": "Special Pepperoni Plus",
        "price": 563,
        "description": "Delicious Special Pepperoni from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "kfc-32",
        "name": "Royal Farmhouse Plus",
        "price": 577,
        "description": "Delicious Royal Farmhouse from KFC, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      }
    ]
  },
  {
    "id": "starbucks",
    "name": "Starbucks",
    "rating": "5.0",
    "time": "33m",
    "description": "Authentic Starbucks serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Burgers",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "sta-01",
        "name": "Special Chicken Zinger",
        "price": 113,
        "description": "Delicious Special Chicken Zinger from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-02",
        "name": "Royal Double Cheese",
        "price": 127,
        "description": "Delicious Royal Double Cheese from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-03",
        "name": "Spicy Aloo Tikki",
        "price": 141,
        "description": "Delicious Spicy Aloo Tikki from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-04",
        "name": "Crispy Spicy Paneer",
        "price": 155,
        "description": "Delicious Crispy Spicy Paneer from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-05",
        "name": "Premium Crispy Chicken",
        "price": 174,
        "description": "Delicious Premium Crispy Chicken from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-06",
        "name": "Loaded Veg Whopper",
        "price": 188,
        "description": "Delicious Loaded Veg Whopper from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-07",
        "name": "Gourmet Chicken Zinger Plus",
        "price": 202,
        "description": "Delicious Gourmet Chicken Zinger from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-08",
        "name": "Rustic Double Cheese Plus",
        "price": 216,
        "description": "Delicious Rustic Double Cheese from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-09",
        "name": "Signature Aloo Tikki Plus",
        "price": 230,
        "description": "Delicious Signature Aloo Tikki from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-10",
        "name": "Classic Spicy Paneer Plus",
        "price": 249,
        "description": "Delicious Classic Spicy Paneer from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-11",
        "name": "Special Crispy Chicken Plus",
        "price": 263,
        "description": "Delicious Special Crispy Chicken from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-12",
        "name": "Royal Veg Whopper Plus",
        "price": 277,
        "description": "Delicious Royal Veg Whopper from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-13",
        "name": "Spicy Chicken Zinger Plus",
        "price": 291,
        "description": "Delicious Spicy Chicken Zinger from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-14",
        "name": "Crispy Double Cheese Plus",
        "price": 305,
        "description": "Delicious Crispy Double Cheese from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-15",
        "name": "Premium Aloo Tikki Plus",
        "price": 324,
        "description": "Delicious Premium Aloo Tikki from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-16",
        "name": "Loaded Spicy Paneer Plus",
        "price": 338,
        "description": "Delicious Loaded Spicy Paneer from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-17",
        "name": "Gourmet Crispy Chicken Plus",
        "price": 352,
        "description": "Delicious Gourmet Crispy Chicken from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-18",
        "name": "Rustic Veg Whopper Plus",
        "price": 366,
        "description": "Delicious Rustic Veg Whopper from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-19",
        "name": "Signature Chicken Zinger Plus",
        "price": 380,
        "description": "Delicious Signature Chicken Zinger from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-20",
        "name": "Classic Double Cheese Plus",
        "price": 399,
        "description": "Delicious Classic Double Cheese from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-21",
        "name": "Special Aloo Tikki Plus",
        "price": 413,
        "description": "Delicious Special Aloo Tikki from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-22",
        "name": "Royal Spicy Paneer Plus",
        "price": 427,
        "description": "Delicious Royal Spicy Paneer from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-23",
        "name": "Spicy Crispy Chicken Plus",
        "price": 441,
        "description": "Delicious Spicy Crispy Chicken from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-24",
        "name": "Crispy Veg Whopper Plus",
        "price": 455,
        "description": "Delicious Crispy Veg Whopper from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-25",
        "name": "Premium Chicken Zinger Plus",
        "price": 474,
        "description": "Delicious Premium Chicken Zinger from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-26",
        "name": "Loaded Double Cheese Plus",
        "price": 488,
        "description": "Delicious Loaded Double Cheese from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-27",
        "name": "Gourmet Aloo Tikki Plus",
        "price": 502,
        "description": "Delicious Gourmet Aloo Tikki from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-28",
        "name": "Rustic Spicy Paneer Plus",
        "price": 516,
        "description": "Delicious Rustic Spicy Paneer from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-29",
        "name": "Signature Crispy Chicken Plus",
        "price": 530,
        "description": "Delicious Signature Crispy Chicken from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-30",
        "name": "Classic Veg Whopper Plus",
        "price": 549,
        "description": "Delicious Classic Veg Whopper from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-31",
        "name": "Special Chicken Zinger Plus",
        "price": 563,
        "description": "Delicious Special Chicken Zinger from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "sta-32",
        "name": "Royal Double Cheese Plus",
        "price": 577,
        "description": "Delicious Royal Double Cheese from STA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      }
    ]
  },
  {
    "id": "dessert-heaven",
    "name": "Dessert Heaven",
    "rating": "4.7",
    "time": "28m",
    "description": "Authentic Dessert Heaven serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Biryani",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "des-01",
        "name": "Special Mutton Fry",
        "price": 113,
        "description": "Delicious Special Mutton Fry from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-02",
        "name": "Royal Egg Biryani",
        "price": 127,
        "description": "Delicious Royal Egg Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-03",
        "name": "Spicy Veg Pulao",
        "price": 141,
        "description": "Delicious Spicy Veg Pulao from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-04",
        "name": "Crispy Hyderabadi Special",
        "price": 155,
        "description": "Delicious Crispy Hyderabadi Special from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-05",
        "name": "Premium Zafarani Biryani",
        "price": 174,
        "description": "Delicious Premium Zafarani Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-06",
        "name": "Loaded Chicken Dum",
        "price": 188,
        "description": "Delicious Loaded Chicken Dum from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-07",
        "name": "Gourmet Mutton Fry Plus",
        "price": 202,
        "description": "Delicious Gourmet Mutton Fry from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-08",
        "name": "Rustic Egg Biryani Plus",
        "price": 216,
        "description": "Delicious Rustic Egg Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-09",
        "name": "Signature Veg Pulao Plus",
        "price": 230,
        "description": "Delicious Signature Veg Pulao from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-10",
        "name": "Classic Hyderabadi Special Plus",
        "price": 249,
        "description": "Delicious Classic Hyderabadi Special from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-11",
        "name": "Special Zafarani Biryani Plus",
        "price": 263,
        "description": "Delicious Special Zafarani Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-12",
        "name": "Royal Chicken Dum Plus",
        "price": 277,
        "description": "Delicious Royal Chicken Dum from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-13",
        "name": "Spicy Mutton Fry Plus",
        "price": 291,
        "description": "Delicious Spicy Mutton Fry from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-14",
        "name": "Crispy Egg Biryani Plus",
        "price": 305,
        "description": "Delicious Crispy Egg Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-15",
        "name": "Premium Veg Pulao Plus",
        "price": 324,
        "description": "Delicious Premium Veg Pulao from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-16",
        "name": "Loaded Hyderabadi Special Plus",
        "price": 338,
        "description": "Delicious Loaded Hyderabadi Special from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-17",
        "name": "Gourmet Zafarani Biryani Plus",
        "price": 352,
        "description": "Delicious Gourmet Zafarani Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-18",
        "name": "Rustic Chicken Dum Plus",
        "price": 366,
        "description": "Delicious Rustic Chicken Dum from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-19",
        "name": "Signature Mutton Fry Plus",
        "price": 380,
        "description": "Delicious Signature Mutton Fry from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-20",
        "name": "Classic Egg Biryani Plus",
        "price": 399,
        "description": "Delicious Classic Egg Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-21",
        "name": "Special Veg Pulao Plus",
        "price": 413,
        "description": "Delicious Special Veg Pulao from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-22",
        "name": "Royal Hyderabadi Special Plus",
        "price": 427,
        "description": "Delicious Royal Hyderabadi Special from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-23",
        "name": "Spicy Zafarani Biryani Plus",
        "price": 441,
        "description": "Delicious Spicy Zafarani Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-24",
        "name": "Crispy Chicken Dum Plus",
        "price": 455,
        "description": "Delicious Crispy Chicken Dum from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-25",
        "name": "Premium Mutton Fry Plus",
        "price": 474,
        "description": "Delicious Premium Mutton Fry from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-26",
        "name": "Loaded Egg Biryani Plus",
        "price": 488,
        "description": "Delicious Loaded Egg Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-27",
        "name": "Gourmet Veg Pulao Plus",
        "price": 502,
        "description": "Delicious Gourmet Veg Pulao from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-28",
        "name": "Rustic Hyderabadi Special Plus",
        "price": 516,
        "description": "Delicious Rustic Hyderabadi Special from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-29",
        "name": "Signature Zafarani Biryani Plus",
        "price": 530,
        "description": "Delicious Signature Zafarani Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-30",
        "name": "Classic Chicken Dum Plus",
        "price": 549,
        "description": "Delicious Classic Chicken Dum from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-31",
        "name": "Special Mutton Fry Plus",
        "price": 563,
        "description": "Delicious Special Mutton Fry from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "des-32",
        "name": "Royal Egg Biryani Plus",
        "price": 577,
        "description": "Delicious Royal Egg Biryani from DES, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      }
    ]
  },
  {
    "id": "rolls-joint",
    "name": "Rolls Joint",
    "rating": "4.2",
    "time": "34m",
    "description": "Authentic Rolls Joint serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Chinese",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "rol-01",
        "name": "Special Manchurian",
        "price": 113,
        "description": "Delicious Special Manchurian from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-02",
        "name": "Royal Fried Rice",
        "price": 127,
        "description": "Delicious Royal Fried Rice from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-03",
        "name": "Spicy Spring Rolls",
        "price": 141,
        "description": "Delicious Spicy Spring Rolls from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-04",
        "name": "Crispy Chilli Chicken",
        "price": 155,
        "description": "Delicious Crispy Chilli Chicken from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-05",
        "name": "Premium Momos",
        "price": 174,
        "description": "Delicious Premium Momos from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-06",
        "name": "Loaded Noodles",
        "price": 188,
        "description": "Delicious Loaded Noodles from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-07",
        "name": "Gourmet Manchurian Plus",
        "price": 202,
        "description": "Delicious Gourmet Manchurian from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-08",
        "name": "Rustic Fried Rice Plus",
        "price": 216,
        "description": "Delicious Rustic Fried Rice from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-09",
        "name": "Signature Spring Rolls Plus",
        "price": 230,
        "description": "Delicious Signature Spring Rolls from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-10",
        "name": "Classic Chilli Chicken Plus",
        "price": 249,
        "description": "Delicious Classic Chilli Chicken from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-11",
        "name": "Special Momos Plus",
        "price": 263,
        "description": "Delicious Special Momos from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-12",
        "name": "Royal Noodles Plus",
        "price": 277,
        "description": "Delicious Royal Noodles from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-13",
        "name": "Spicy Manchurian Plus",
        "price": 291,
        "description": "Delicious Spicy Manchurian from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-14",
        "name": "Crispy Fried Rice Plus",
        "price": 305,
        "description": "Delicious Crispy Fried Rice from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-15",
        "name": "Premium Spring Rolls Plus",
        "price": 324,
        "description": "Delicious Premium Spring Rolls from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-16",
        "name": "Loaded Chilli Chicken Plus",
        "price": 338,
        "description": "Delicious Loaded Chilli Chicken from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-17",
        "name": "Gourmet Momos Plus",
        "price": 352,
        "description": "Delicious Gourmet Momos from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-18",
        "name": "Rustic Noodles Plus",
        "price": 366,
        "description": "Delicious Rustic Noodles from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-19",
        "name": "Signature Manchurian Plus",
        "price": 380,
        "description": "Delicious Signature Manchurian from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-20",
        "name": "Classic Fried Rice Plus",
        "price": 399,
        "description": "Delicious Classic Fried Rice from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-21",
        "name": "Special Spring Rolls Plus",
        "price": 413,
        "description": "Delicious Special Spring Rolls from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-22",
        "name": "Royal Chilli Chicken Plus",
        "price": 427,
        "description": "Delicious Royal Chilli Chicken from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-23",
        "name": "Spicy Momos Plus",
        "price": 441,
        "description": "Delicious Spicy Momos from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-24",
        "name": "Crispy Noodles Plus",
        "price": 455,
        "description": "Delicious Crispy Noodles from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-25",
        "name": "Premium Manchurian Plus",
        "price": 474,
        "description": "Delicious Premium Manchurian from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-26",
        "name": "Loaded Fried Rice Plus",
        "price": 488,
        "description": "Delicious Loaded Fried Rice from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-27",
        "name": "Gourmet Spring Rolls Plus",
        "price": 502,
        "description": "Delicious Gourmet Spring Rolls from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-28",
        "name": "Rustic Chilli Chicken Plus",
        "price": 516,
        "description": "Delicious Rustic Chilli Chicken from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-29",
        "name": "Signature Momos Plus",
        "price": 530,
        "description": "Delicious Signature Momos from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-30",
        "name": "Classic Noodles Plus",
        "price": 549,
        "description": "Delicious Classic Noodles from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-31",
        "name": "Special Manchurian Plus",
        "price": 563,
        "description": "Delicious Special Manchurian from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "rol-32",
        "name": "Royal Fried Rice Plus",
        "price": 577,
        "description": "Delicious Royal Fried Rice from ROL, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      }
    ]
  },
  {
    "id": "pasta-palace",
    "name": "Pasta Palace",
    "rating": "4.8",
    "time": "34m",
    "description": "Authentic Pasta Palace serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "South Indian",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "pas-01",
        "name": "Special Idli Sambhar",
        "price": 113,
        "description": "Delicious Special Idli Sambhar from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-02",
        "name": "Royal Vada",
        "price": 127,
        "description": "Delicious Royal Vada from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-03",
        "name": "Spicy Uttapam",
        "price": 141,
        "description": "Delicious Spicy Uttapam from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-04",
        "name": "Crispy Pongal",
        "price": 155,
        "description": "Delicious Crispy Pongal from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-05",
        "name": "Premium Upma",
        "price": 174,
        "description": "Delicious Premium Upma from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-06",
        "name": "Loaded Masala Dosa",
        "price": 188,
        "description": "Delicious Loaded Masala Dosa from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-07",
        "name": "Gourmet Idli Sambhar Plus",
        "price": 202,
        "description": "Delicious Gourmet Idli Sambhar from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-08",
        "name": "Rustic Vada Plus",
        "price": 216,
        "description": "Delicious Rustic Vada from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-09",
        "name": "Signature Uttapam Plus",
        "price": 230,
        "description": "Delicious Signature Uttapam from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-10",
        "name": "Classic Pongal Plus",
        "price": 249,
        "description": "Delicious Classic Pongal from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-11",
        "name": "Special Upma Plus",
        "price": 263,
        "description": "Delicious Special Upma from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-12",
        "name": "Royal Masala Dosa Plus",
        "price": 277,
        "description": "Delicious Royal Masala Dosa from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-13",
        "name": "Spicy Idli Sambhar Plus",
        "price": 291,
        "description": "Delicious Spicy Idli Sambhar from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-14",
        "name": "Crispy Vada Plus",
        "price": 305,
        "description": "Delicious Crispy Vada from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-15",
        "name": "Premium Uttapam Plus",
        "price": 324,
        "description": "Delicious Premium Uttapam from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-16",
        "name": "Loaded Pongal Plus",
        "price": 338,
        "description": "Delicious Loaded Pongal from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-17",
        "name": "Gourmet Upma Plus",
        "price": 352,
        "description": "Delicious Gourmet Upma from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-18",
        "name": "Rustic Masala Dosa Plus",
        "price": 366,
        "description": "Delicious Rustic Masala Dosa from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-19",
        "name": "Signature Idli Sambhar Plus",
        "price": 380,
        "description": "Delicious Signature Idli Sambhar from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-20",
        "name": "Classic Vada Plus",
        "price": 399,
        "description": "Delicious Classic Vada from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-21",
        "name": "Special Uttapam Plus",
        "price": 413,
        "description": "Delicious Special Uttapam from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-22",
        "name": "Royal Pongal Plus",
        "price": 427,
        "description": "Delicious Royal Pongal from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-23",
        "name": "Spicy Upma Plus",
        "price": 441,
        "description": "Delicious Spicy Upma from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-24",
        "name": "Crispy Masala Dosa Plus",
        "price": 455,
        "description": "Delicious Crispy Masala Dosa from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-25",
        "name": "Premium Idli Sambhar Plus",
        "price": 474,
        "description": "Delicious Premium Idli Sambhar from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-26",
        "name": "Loaded Vada Plus",
        "price": 488,
        "description": "Delicious Loaded Vada from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-27",
        "name": "Gourmet Uttapam Plus",
        "price": 502,
        "description": "Delicious Gourmet Uttapam from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-28",
        "name": "Rustic Pongal Plus",
        "price": 516,
        "description": "Delicious Rustic Pongal from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-29",
        "name": "Signature Upma Plus",
        "price": 530,
        "description": "Delicious Signature Upma from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-30",
        "name": "Classic Masala Dosa Plus",
        "price": 549,
        "description": "Delicious Classic Masala Dosa from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-31",
        "name": "Special Idli Sambhar Plus",
        "price": 563,
        "description": "Delicious Special Idli Sambhar from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "pas-32",
        "name": "Royal Vada Plus",
        "price": 577,
        "description": "Delicious Royal Vada from PAS, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      }
    ]
  },
  {
    "id": "juice-bar",
    "name": "Juice Bar",
    "rating": "4.6",
    "time": "15m",
    "description": "Authentic Juice Bar serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Beverages",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "jui-01",
        "name": "Special Mocktail",
        "price": 113,
        "description": "Delicious Special Mocktail from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-02",
        "name": "Royal Fruit Juice",
        "price": 127,
        "description": "Delicious Royal Fruit Juice from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-03",
        "name": "Spicy Tea",
        "price": 141,
        "description": "Delicious Spicy Tea from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-04",
        "name": "Crispy Lemonade",
        "price": 155,
        "description": "Delicious Crispy Lemonade from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-05",
        "name": "Premium Shake",
        "price": 174,
        "description": "Delicious Premium Shake from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-06",
        "name": "Loaded Cold Coffee",
        "price": 188,
        "description": "Delicious Loaded Cold Coffee from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-07",
        "name": "Gourmet Mocktail Plus",
        "price": 202,
        "description": "Delicious Gourmet Mocktail from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-08",
        "name": "Rustic Fruit Juice Plus",
        "price": 216,
        "description": "Delicious Rustic Fruit Juice from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-09",
        "name": "Signature Tea Plus",
        "price": 230,
        "description": "Delicious Signature Tea from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-10",
        "name": "Classic Lemonade Plus",
        "price": 249,
        "description": "Delicious Classic Lemonade from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-11",
        "name": "Special Shake Plus",
        "price": 263,
        "description": "Delicious Special Shake from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-12",
        "name": "Royal Cold Coffee Plus",
        "price": 277,
        "description": "Delicious Royal Cold Coffee from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-13",
        "name": "Spicy Mocktail Plus",
        "price": 291,
        "description": "Delicious Spicy Mocktail from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-14",
        "name": "Crispy Fruit Juice Plus",
        "price": 305,
        "description": "Delicious Crispy Fruit Juice from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-15",
        "name": "Premium Tea Plus",
        "price": 324,
        "description": "Delicious Premium Tea from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-16",
        "name": "Loaded Lemonade Plus",
        "price": 338,
        "description": "Delicious Loaded Lemonade from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-17",
        "name": "Gourmet Shake Plus",
        "price": 352,
        "description": "Delicious Gourmet Shake from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-18",
        "name": "Rustic Cold Coffee Plus",
        "price": 366,
        "description": "Delicious Rustic Cold Coffee from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-19",
        "name": "Signature Mocktail Plus",
        "price": 380,
        "description": "Delicious Signature Mocktail from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-20",
        "name": "Classic Fruit Juice Plus",
        "price": 399,
        "description": "Delicious Classic Fruit Juice from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-21",
        "name": "Special Tea Plus",
        "price": 413,
        "description": "Delicious Special Tea from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-22",
        "name": "Royal Lemonade Plus",
        "price": 427,
        "description": "Delicious Royal Lemonade from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-23",
        "name": "Spicy Shake Plus",
        "price": 441,
        "description": "Delicious Spicy Shake from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-24",
        "name": "Crispy Cold Coffee Plus",
        "price": 455,
        "description": "Delicious Crispy Cold Coffee from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-25",
        "name": "Premium Mocktail Plus",
        "price": 474,
        "description": "Delicious Premium Mocktail from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-26",
        "name": "Loaded Fruit Juice Plus",
        "price": 488,
        "description": "Delicious Loaded Fruit Juice from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-27",
        "name": "Gourmet Tea Plus",
        "price": 502,
        "description": "Delicious Gourmet Tea from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-28",
        "name": "Rustic Lemonade Plus",
        "price": 516,
        "description": "Delicious Rustic Lemonade from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-29",
        "name": "Signature Shake Plus",
        "price": 530,
        "description": "Delicious Signature Shake from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-30",
        "name": "Classic Cold Coffee Plus",
        "price": 549,
        "description": "Delicious Classic Cold Coffee from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-31",
        "name": "Special Mocktail Plus",
        "price": 563,
        "description": "Delicious Special Mocktail from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "jui-32",
        "name": "Royal Fruit Juice Plus",
        "price": 577,
        "description": "Delicious Royal Fruit Juice from JUI, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      }
    ]
  },
  {
    "id": "north-indian-kitchen",
    "name": "North Indian Kitchen",
    "rating": "4.6",
    "time": "32m",
    "description": "Authentic North Indian Kitchen serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Desserts",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "nor-01",
        "name": "Special Ice Cream",
        "price": 113,
        "description": "Delicious Special Ice Cream from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-02",
        "name": "Royal Brownie",
        "price": 127,
        "description": "Delicious Royal Brownie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-03",
        "name": "Spicy Gulab Jamun",
        "price": 141,
        "description": "Delicious Spicy Gulab Jamun from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-04",
        "name": "Crispy Pastry",
        "price": 155,
        "description": "Delicious Crispy Pastry from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-05",
        "name": "Premium Cookie",
        "price": 174,
        "description": "Delicious Premium Cookie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-06",
        "name": "Loaded Waffle",
        "price": 188,
        "description": "Delicious Loaded Waffle from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-07",
        "name": "Gourmet Ice Cream Plus",
        "price": 202,
        "description": "Delicious Gourmet Ice Cream from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-08",
        "name": "Rustic Brownie Plus",
        "price": 216,
        "description": "Delicious Rustic Brownie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-09",
        "name": "Signature Gulab Jamun Plus",
        "price": 230,
        "description": "Delicious Signature Gulab Jamun from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-10",
        "name": "Classic Pastry Plus",
        "price": 249,
        "description": "Delicious Classic Pastry from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-11",
        "name": "Special Cookie Plus",
        "price": 263,
        "description": "Delicious Special Cookie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-12",
        "name": "Royal Waffle Plus",
        "price": 277,
        "description": "Delicious Royal Waffle from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-13",
        "name": "Spicy Ice Cream Plus",
        "price": 291,
        "description": "Delicious Spicy Ice Cream from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-14",
        "name": "Crispy Brownie Plus",
        "price": 305,
        "description": "Delicious Crispy Brownie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-15",
        "name": "Premium Gulab Jamun Plus",
        "price": 324,
        "description": "Delicious Premium Gulab Jamun from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-16",
        "name": "Loaded Pastry Plus",
        "price": 338,
        "description": "Delicious Loaded Pastry from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-17",
        "name": "Gourmet Cookie Plus",
        "price": 352,
        "description": "Delicious Gourmet Cookie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-18",
        "name": "Rustic Waffle Plus",
        "price": 366,
        "description": "Delicious Rustic Waffle from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-19",
        "name": "Signature Ice Cream Plus",
        "price": 380,
        "description": "Delicious Signature Ice Cream from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-20",
        "name": "Classic Brownie Plus",
        "price": 399,
        "description": "Delicious Classic Brownie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-21",
        "name": "Special Gulab Jamun Plus",
        "price": 413,
        "description": "Delicious Special Gulab Jamun from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-22",
        "name": "Royal Pastry Plus",
        "price": 427,
        "description": "Delicious Royal Pastry from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-23",
        "name": "Spicy Cookie Plus",
        "price": 441,
        "description": "Delicious Spicy Cookie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-24",
        "name": "Crispy Waffle Plus",
        "price": 455,
        "description": "Delicious Crispy Waffle from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-25",
        "name": "Premium Ice Cream Plus",
        "price": 474,
        "description": "Delicious Premium Ice Cream from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-26",
        "name": "Loaded Brownie Plus",
        "price": 488,
        "description": "Delicious Loaded Brownie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-27",
        "name": "Gourmet Gulab Jamun Plus",
        "price": 502,
        "description": "Delicious Gourmet Gulab Jamun from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-28",
        "name": "Rustic Pastry Plus",
        "price": 516,
        "description": "Delicious Rustic Pastry from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-29",
        "name": "Signature Cookie Plus",
        "price": 530,
        "description": "Delicious Signature Cookie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-30",
        "name": "Classic Waffle Plus",
        "price": 549,
        "description": "Delicious Classic Waffle from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-31",
        "name": "Special Ice Cream Plus",
        "price": 563,
        "description": "Delicious Special Ice Cream from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      },
      {
        "id": "nor-32",
        "name": "Royal Brownie Plus",
        "price": 577,
        "description": "Delicious Royal Brownie from NOR, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1551024601-5f00ed05c6d3?q=80&w=400&auto=format&fit=crop",
        "category": "Desserts"
      }
    ]
  },
  {
    "id": "hyderabadi-spice",
    "name": "Hyderabadi Spice",
    "rating": "4.7",
    "time": "16m",
    "description": "Authentic Hyderabadi Spice serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Pizza",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "hyd-01",
        "name": "Special Pepperoni",
        "price": 113,
        "description": "Delicious Special Pepperoni from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-02",
        "name": "Royal Farmhouse",
        "price": 127,
        "description": "Delicious Royal Farmhouse from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-03",
        "name": "Spicy Cheese Burst",
        "price": 141,
        "description": "Delicious Spicy Cheese Burst from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-04",
        "name": "Crispy Paneer Tikka",
        "price": 155,
        "description": "Delicious Crispy Paneer Tikka from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-05",
        "name": "Premium Chicken Festive",
        "price": 174,
        "description": "Delicious Premium Chicken Festive from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-06",
        "name": "Loaded Margherita",
        "price": 188,
        "description": "Delicious Loaded Margherita from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-07",
        "name": "Gourmet Pepperoni Plus",
        "price": 202,
        "description": "Delicious Gourmet Pepperoni from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-08",
        "name": "Rustic Farmhouse Plus",
        "price": 216,
        "description": "Delicious Rustic Farmhouse from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-09",
        "name": "Signature Cheese Burst Plus",
        "price": 230,
        "description": "Delicious Signature Cheese Burst from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-10",
        "name": "Classic Paneer Tikka Plus",
        "price": 249,
        "description": "Delicious Classic Paneer Tikka from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-11",
        "name": "Special Chicken Festive Plus",
        "price": 263,
        "description": "Delicious Special Chicken Festive from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-12",
        "name": "Royal Margherita Plus",
        "price": 277,
        "description": "Delicious Royal Margherita from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-13",
        "name": "Spicy Pepperoni Plus",
        "price": 291,
        "description": "Delicious Spicy Pepperoni from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-14",
        "name": "Crispy Farmhouse Plus",
        "price": 305,
        "description": "Delicious Crispy Farmhouse from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-15",
        "name": "Premium Cheese Burst Plus",
        "price": 324,
        "description": "Delicious Premium Cheese Burst from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-16",
        "name": "Loaded Paneer Tikka Plus",
        "price": 338,
        "description": "Delicious Loaded Paneer Tikka from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-17",
        "name": "Gourmet Chicken Festive Plus",
        "price": 352,
        "description": "Delicious Gourmet Chicken Festive from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-18",
        "name": "Rustic Margherita Plus",
        "price": 366,
        "description": "Delicious Rustic Margherita from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-19",
        "name": "Signature Pepperoni Plus",
        "price": 380,
        "description": "Delicious Signature Pepperoni from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-20",
        "name": "Classic Farmhouse Plus",
        "price": 399,
        "description": "Delicious Classic Farmhouse from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-21",
        "name": "Special Cheese Burst Plus",
        "price": 413,
        "description": "Delicious Special Cheese Burst from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-22",
        "name": "Royal Paneer Tikka Plus",
        "price": 427,
        "description": "Delicious Royal Paneer Tikka from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-23",
        "name": "Spicy Chicken Festive Plus",
        "price": 441,
        "description": "Delicious Spicy Chicken Festive from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-24",
        "name": "Crispy Margherita Plus",
        "price": 455,
        "description": "Delicious Crispy Margherita from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-25",
        "name": "Premium Pepperoni Plus",
        "price": 474,
        "description": "Delicious Premium Pepperoni from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-26",
        "name": "Loaded Farmhouse Plus",
        "price": 488,
        "description": "Delicious Loaded Farmhouse from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-27",
        "name": "Gourmet Cheese Burst Plus",
        "price": 502,
        "description": "Delicious Gourmet Cheese Burst from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-28",
        "name": "Rustic Paneer Tikka Plus",
        "price": 516,
        "description": "Delicious Rustic Paneer Tikka from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-29",
        "name": "Signature Chicken Festive Plus",
        "price": 530,
        "description": "Delicious Signature Chicken Festive from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-30",
        "name": "Classic Margherita Plus",
        "price": 549,
        "description": "Delicious Classic Margherita from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-31",
        "name": "Special Pepperoni Plus",
        "price": 563,
        "description": "Delicious Special Pepperoni from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      },
      {
        "id": "hyd-32",
        "name": "Royal Farmhouse Plus",
        "price": 577,
        "description": "Delicious Royal Farmhouse from HYD, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      }
    ]
  },
  {
    "id": "waffle-wallah",
    "name": "Waffle Wallah",
    "rating": "4.5",
    "time": "22m",
    "description": "Authentic Waffle Wallah serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Burgers",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "waf-01",
        "name": "Special Chicken Zinger",
        "price": 113,
        "description": "Delicious Special Chicken Zinger from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-02",
        "name": "Royal Double Cheese",
        "price": 127,
        "description": "Delicious Royal Double Cheese from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-03",
        "name": "Spicy Aloo Tikki",
        "price": 141,
        "description": "Delicious Spicy Aloo Tikki from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-04",
        "name": "Crispy Spicy Paneer",
        "price": 155,
        "description": "Delicious Crispy Spicy Paneer from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-05",
        "name": "Premium Crispy Chicken",
        "price": 174,
        "description": "Delicious Premium Crispy Chicken from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-06",
        "name": "Loaded Veg Whopper",
        "price": 188,
        "description": "Delicious Loaded Veg Whopper from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-07",
        "name": "Gourmet Chicken Zinger Plus",
        "price": 202,
        "description": "Delicious Gourmet Chicken Zinger from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-08",
        "name": "Rustic Double Cheese Plus",
        "price": 216,
        "description": "Delicious Rustic Double Cheese from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-09",
        "name": "Signature Aloo Tikki Plus",
        "price": 230,
        "description": "Delicious Signature Aloo Tikki from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-10",
        "name": "Classic Spicy Paneer Plus",
        "price": 249,
        "description": "Delicious Classic Spicy Paneer from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-11",
        "name": "Special Crispy Chicken Plus",
        "price": 263,
        "description": "Delicious Special Crispy Chicken from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-12",
        "name": "Royal Veg Whopper Plus",
        "price": 277,
        "description": "Delicious Royal Veg Whopper from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-13",
        "name": "Spicy Chicken Zinger Plus",
        "price": 291,
        "description": "Delicious Spicy Chicken Zinger from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-14",
        "name": "Crispy Double Cheese Plus",
        "price": 305,
        "description": "Delicious Crispy Double Cheese from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-15",
        "name": "Premium Aloo Tikki Plus",
        "price": 324,
        "description": "Delicious Premium Aloo Tikki from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-16",
        "name": "Loaded Spicy Paneer Plus",
        "price": 338,
        "description": "Delicious Loaded Spicy Paneer from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-17",
        "name": "Gourmet Crispy Chicken Plus",
        "price": 352,
        "description": "Delicious Gourmet Crispy Chicken from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-18",
        "name": "Rustic Veg Whopper Plus",
        "price": 366,
        "description": "Delicious Rustic Veg Whopper from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-19",
        "name": "Signature Chicken Zinger Plus",
        "price": 380,
        "description": "Delicious Signature Chicken Zinger from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-20",
        "name": "Classic Double Cheese Plus",
        "price": 399,
        "description": "Delicious Classic Double Cheese from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-21",
        "name": "Special Aloo Tikki Plus",
        "price": 413,
        "description": "Delicious Special Aloo Tikki from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-22",
        "name": "Royal Spicy Paneer Plus",
        "price": 427,
        "description": "Delicious Royal Spicy Paneer from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-23",
        "name": "Spicy Crispy Chicken Plus",
        "price": 441,
        "description": "Delicious Spicy Crispy Chicken from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-24",
        "name": "Crispy Veg Whopper Plus",
        "price": 455,
        "description": "Delicious Crispy Veg Whopper from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-25",
        "name": "Premium Chicken Zinger Plus",
        "price": 474,
        "description": "Delicious Premium Chicken Zinger from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-26",
        "name": "Loaded Double Cheese Plus",
        "price": 488,
        "description": "Delicious Loaded Double Cheese from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-27",
        "name": "Gourmet Aloo Tikki Plus",
        "price": 502,
        "description": "Delicious Gourmet Aloo Tikki from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-28",
        "name": "Rustic Spicy Paneer Plus",
        "price": 516,
        "description": "Delicious Rustic Spicy Paneer from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-29",
        "name": "Signature Crispy Chicken Plus",
        "price": 530,
        "description": "Delicious Signature Crispy Chicken from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-30",
        "name": "Classic Veg Whopper Plus",
        "price": 549,
        "description": "Delicious Classic Veg Whopper from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-31",
        "name": "Special Chicken Zinger Plus",
        "price": 563,
        "description": "Delicious Special Chicken Zinger from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      },
      {
        "id": "waf-32",
        "name": "Royal Double Cheese Plus",
        "price": 577,
        "description": "Delicious Royal Double Cheese from WAF, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400&auto=format&fit=crop",
        "category": "Burgers"
      }
    ]
  },
  {
    "id": "momos-point",
    "name": "Momos Point",
    "rating": "4.5",
    "time": "24m",
    "description": "Authentic Momos Point serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Biryani",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "mom-01",
        "name": "Special Mutton Fry",
        "price": 113,
        "description": "Delicious Special Mutton Fry from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-02",
        "name": "Royal Egg Biryani",
        "price": 127,
        "description": "Delicious Royal Egg Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-03",
        "name": "Spicy Veg Pulao",
        "price": 141,
        "description": "Delicious Spicy Veg Pulao from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-04",
        "name": "Crispy Hyderabadi Special",
        "price": 155,
        "description": "Delicious Crispy Hyderabadi Special from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-05",
        "name": "Premium Zafarani Biryani",
        "price": 174,
        "description": "Delicious Premium Zafarani Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-06",
        "name": "Loaded Chicken Dum",
        "price": 188,
        "description": "Delicious Loaded Chicken Dum from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-07",
        "name": "Gourmet Mutton Fry Plus",
        "price": 202,
        "description": "Delicious Gourmet Mutton Fry from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-08",
        "name": "Rustic Egg Biryani Plus",
        "price": 216,
        "description": "Delicious Rustic Egg Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-09",
        "name": "Signature Veg Pulao Plus",
        "price": 230,
        "description": "Delicious Signature Veg Pulao from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-10",
        "name": "Classic Hyderabadi Special Plus",
        "price": 249,
        "description": "Delicious Classic Hyderabadi Special from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-11",
        "name": "Special Zafarani Biryani Plus",
        "price": 263,
        "description": "Delicious Special Zafarani Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-12",
        "name": "Royal Chicken Dum Plus",
        "price": 277,
        "description": "Delicious Royal Chicken Dum from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-13",
        "name": "Spicy Mutton Fry Plus",
        "price": 291,
        "description": "Delicious Spicy Mutton Fry from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-14",
        "name": "Crispy Egg Biryani Plus",
        "price": 305,
        "description": "Delicious Crispy Egg Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-15",
        "name": "Premium Veg Pulao Plus",
        "price": 324,
        "description": "Delicious Premium Veg Pulao from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-16",
        "name": "Loaded Hyderabadi Special Plus",
        "price": 338,
        "description": "Delicious Loaded Hyderabadi Special from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-17",
        "name": "Gourmet Zafarani Biryani Plus",
        "price": 352,
        "description": "Delicious Gourmet Zafarani Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-18",
        "name": "Rustic Chicken Dum Plus",
        "price": 366,
        "description": "Delicious Rustic Chicken Dum from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-19",
        "name": "Signature Mutton Fry Plus",
        "price": 380,
        "description": "Delicious Signature Mutton Fry from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-20",
        "name": "Classic Egg Biryani Plus",
        "price": 399,
        "description": "Delicious Classic Egg Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-21",
        "name": "Special Veg Pulao Plus",
        "price": 413,
        "description": "Delicious Special Veg Pulao from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-22",
        "name": "Royal Hyderabadi Special Plus",
        "price": 427,
        "description": "Delicious Royal Hyderabadi Special from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-23",
        "name": "Spicy Zafarani Biryani Plus",
        "price": 441,
        "description": "Delicious Spicy Zafarani Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-24",
        "name": "Crispy Chicken Dum Plus",
        "price": 455,
        "description": "Delicious Crispy Chicken Dum from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-25",
        "name": "Premium Mutton Fry Plus",
        "price": 474,
        "description": "Delicious Premium Mutton Fry from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-26",
        "name": "Loaded Egg Biryani Plus",
        "price": 488,
        "description": "Delicious Loaded Egg Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-27",
        "name": "Gourmet Veg Pulao Plus",
        "price": 502,
        "description": "Delicious Gourmet Veg Pulao from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-28",
        "name": "Rustic Hyderabadi Special Plus",
        "price": 516,
        "description": "Delicious Rustic Hyderabadi Special from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-29",
        "name": "Signature Zafarani Biryani Plus",
        "price": 530,
        "description": "Delicious Signature Zafarani Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-30",
        "name": "Classic Chicken Dum Plus",
        "price": 549,
        "description": "Delicious Classic Chicken Dum from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-31",
        "name": "Special Mutton Fry Plus",
        "price": 563,
        "description": "Delicious Special Mutton Fry from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop",
        "category": "Biryani"
      },
      {
        "id": "mom-32",
        "name": "Royal Egg Biryani Plus",
        "price": 577,
        "description": "Delicious Royal Egg Biryani from MOM, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop",
        "category": "Pizza"
      }
    ]
  },
  {
    "id": "sandwich-shop",
    "name": "Sandwich Shop",
    "rating": "5.0",
    "time": "25m",
    "description": "Authentic Sandwich Shop serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Chinese",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "san-01",
        "name": "Special Manchurian",
        "price": 113,
        "description": "Delicious Special Manchurian from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-02",
        "name": "Royal Fried Rice",
        "price": 127,
        "description": "Delicious Royal Fried Rice from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-03",
        "name": "Spicy Spring Rolls",
        "price": 141,
        "description": "Delicious Spicy Spring Rolls from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-04",
        "name": "Crispy Chilli Chicken",
        "price": 155,
        "description": "Delicious Crispy Chilli Chicken from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-05",
        "name": "Premium Momos",
        "price": 174,
        "description": "Delicious Premium Momos from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-06",
        "name": "Loaded Noodles",
        "price": 188,
        "description": "Delicious Loaded Noodles from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-07",
        "name": "Gourmet Manchurian Plus",
        "price": 202,
        "description": "Delicious Gourmet Manchurian from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-08",
        "name": "Rustic Fried Rice Plus",
        "price": 216,
        "description": "Delicious Rustic Fried Rice from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-09",
        "name": "Signature Spring Rolls Plus",
        "price": 230,
        "description": "Delicious Signature Spring Rolls from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-10",
        "name": "Classic Chilli Chicken Plus",
        "price": 249,
        "description": "Delicious Classic Chilli Chicken from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-11",
        "name": "Special Momos Plus",
        "price": 263,
        "description": "Delicious Special Momos from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-12",
        "name": "Royal Noodles Plus",
        "price": 277,
        "description": "Delicious Royal Noodles from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-13",
        "name": "Spicy Manchurian Plus",
        "price": 291,
        "description": "Delicious Spicy Manchurian from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-14",
        "name": "Crispy Fried Rice Plus",
        "price": 305,
        "description": "Delicious Crispy Fried Rice from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-15",
        "name": "Premium Spring Rolls Plus",
        "price": 324,
        "description": "Delicious Premium Spring Rolls from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-16",
        "name": "Loaded Chilli Chicken Plus",
        "price": 338,
        "description": "Delicious Loaded Chilli Chicken from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-17",
        "name": "Gourmet Momos Plus",
        "price": 352,
        "description": "Delicious Gourmet Momos from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-18",
        "name": "Rustic Noodles Plus",
        "price": 366,
        "description": "Delicious Rustic Noodles from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-19",
        "name": "Signature Manchurian Plus",
        "price": 380,
        "description": "Delicious Signature Manchurian from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-20",
        "name": "Classic Fried Rice Plus",
        "price": 399,
        "description": "Delicious Classic Fried Rice from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-21",
        "name": "Special Spring Rolls Plus",
        "price": 413,
        "description": "Delicious Special Spring Rolls from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-22",
        "name": "Royal Chilli Chicken Plus",
        "price": 427,
        "description": "Delicious Royal Chilli Chicken from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-23",
        "name": "Spicy Momos Plus",
        "price": 441,
        "description": "Delicious Spicy Momos from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-24",
        "name": "Crispy Noodles Plus",
        "price": 455,
        "description": "Delicious Crispy Noodles from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-25",
        "name": "Premium Manchurian Plus",
        "price": 474,
        "description": "Delicious Premium Manchurian from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-26",
        "name": "Loaded Fried Rice Plus",
        "price": 488,
        "description": "Delicious Loaded Fried Rice from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-27",
        "name": "Gourmet Spring Rolls Plus",
        "price": 502,
        "description": "Delicious Gourmet Spring Rolls from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-28",
        "name": "Rustic Chilli Chicken Plus",
        "price": 516,
        "description": "Delicious Rustic Chilli Chicken from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-29",
        "name": "Signature Momos Plus",
        "price": 530,
        "description": "Delicious Signature Momos from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-30",
        "name": "Classic Noodles Plus",
        "price": 549,
        "description": "Delicious Classic Noodles from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-31",
        "name": "Special Manchurian Plus",
        "price": 563,
        "description": "Delicious Special Manchurian from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      },
      {
        "id": "san-32",
        "name": "Royal Fried Rice Plus",
        "price": 577,
        "description": "Delicious Royal Fried Rice from SAN, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?q=80&w=400&auto=format&fit=crop",
        "category": "Chinese"
      }
    ]
  },
  {
    "id": "eggie-station",
    "name": "Eggie Station",
    "rating": "4.2",
    "time": "28m",
    "description": "Authentic Eggie Station serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "South Indian",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "egg-01",
        "name": "Special Idli Sambhar",
        "price": 113,
        "description": "Delicious Special Idli Sambhar from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-02",
        "name": "Royal Vada",
        "price": 127,
        "description": "Delicious Royal Vada from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-03",
        "name": "Spicy Uttapam",
        "price": 141,
        "description": "Delicious Spicy Uttapam from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-04",
        "name": "Crispy Pongal",
        "price": 155,
        "description": "Delicious Crispy Pongal from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-05",
        "name": "Premium Upma",
        "price": 174,
        "description": "Delicious Premium Upma from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-06",
        "name": "Loaded Masala Dosa",
        "price": 188,
        "description": "Delicious Loaded Masala Dosa from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-07",
        "name": "Gourmet Idli Sambhar Plus",
        "price": 202,
        "description": "Delicious Gourmet Idli Sambhar from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-08",
        "name": "Rustic Vada Plus",
        "price": 216,
        "description": "Delicious Rustic Vada from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-09",
        "name": "Signature Uttapam Plus",
        "price": 230,
        "description": "Delicious Signature Uttapam from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-10",
        "name": "Classic Pongal Plus",
        "price": 249,
        "description": "Delicious Classic Pongal from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-11",
        "name": "Special Upma Plus",
        "price": 263,
        "description": "Delicious Special Upma from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-12",
        "name": "Royal Masala Dosa Plus",
        "price": 277,
        "description": "Delicious Royal Masala Dosa from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-13",
        "name": "Spicy Idli Sambhar Plus",
        "price": 291,
        "description": "Delicious Spicy Idli Sambhar from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-14",
        "name": "Crispy Vada Plus",
        "price": 305,
        "description": "Delicious Crispy Vada from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-15",
        "name": "Premium Uttapam Plus",
        "price": 324,
        "description": "Delicious Premium Uttapam from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-16",
        "name": "Loaded Pongal Plus",
        "price": 338,
        "description": "Delicious Loaded Pongal from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-17",
        "name": "Gourmet Upma Plus",
        "price": 352,
        "description": "Delicious Gourmet Upma from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-18",
        "name": "Rustic Masala Dosa Plus",
        "price": 366,
        "description": "Delicious Rustic Masala Dosa from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-19",
        "name": "Signature Idli Sambhar Plus",
        "price": 380,
        "description": "Delicious Signature Idli Sambhar from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-20",
        "name": "Classic Vada Plus",
        "price": 399,
        "description": "Delicious Classic Vada from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-21",
        "name": "Special Uttapam Plus",
        "price": 413,
        "description": "Delicious Special Uttapam from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-22",
        "name": "Royal Pongal Plus",
        "price": 427,
        "description": "Delicious Royal Pongal from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-23",
        "name": "Spicy Upma Plus",
        "price": 441,
        "description": "Delicious Spicy Upma from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-24",
        "name": "Crispy Masala Dosa Plus",
        "price": 455,
        "description": "Delicious Crispy Masala Dosa from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-25",
        "name": "Premium Idli Sambhar Plus",
        "price": 474,
        "description": "Delicious Premium Idli Sambhar from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-26",
        "name": "Loaded Vada Plus",
        "price": 488,
        "description": "Delicious Loaded Vada from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-27",
        "name": "Gourmet Uttapam Plus",
        "price": 502,
        "description": "Delicious Gourmet Uttapam from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-28",
        "name": "Rustic Pongal Plus",
        "price": 516,
        "description": "Delicious Rustic Pongal from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-29",
        "name": "Signature Upma Plus",
        "price": 530,
        "description": "Delicious Signature Upma from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-30",
        "name": "Classic Masala Dosa Plus",
        "price": 549,
        "description": "Delicious Classic Masala Dosa from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-31",
        "name": "Special Idli Sambhar Plus",
        "price": 563,
        "description": "Delicious Special Idli Sambhar from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      },
      {
        "id": "egg-32",
        "name": "Royal Vada Plus",
        "price": 577,
        "description": "Delicious Royal Vada from EGG, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=400&auto=format&fit=crop",
        "category": "South Indian"
      }
    ]
  },
  {
    "id": "healthy-bites",
    "name": "Healthy Bites",
    "rating": "4.4",
    "time": "20m",
    "description": "Authentic Healthy Bites serving the SRM University AP community with premium quality.",
    "imageUrl": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
    "categories": [
      "Beverages",
      "Sides",
      "Drinks"
    ],
    "menu": [
      {
        "id": "hea-01",
        "name": "Special Mocktail",
        "price": 113,
        "description": "Delicious Special Mocktail from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-02",
        "name": "Royal Fruit Juice",
        "price": 127,
        "description": "Delicious Royal Fruit Juice from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-03",
        "name": "Spicy Tea",
        "price": 141,
        "description": "Delicious Spicy Tea from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-04",
        "name": "Crispy Lemonade",
        "price": 155,
        "description": "Delicious Crispy Lemonade from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-05",
        "name": "Premium Shake",
        "price": 174,
        "description": "Delicious Premium Shake from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-06",
        "name": "Loaded Cold Coffee",
        "price": 188,
        "description": "Delicious Loaded Cold Coffee from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-07",
        "name": "Gourmet Mocktail Plus",
        "price": 202,
        "description": "Delicious Gourmet Mocktail from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-08",
        "name": "Rustic Fruit Juice Plus",
        "price": 216,
        "description": "Delicious Rustic Fruit Juice from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-09",
        "name": "Signature Tea Plus",
        "price": 230,
        "description": "Delicious Signature Tea from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-10",
        "name": "Classic Lemonade Plus",
        "price": 249,
        "description": "Delicious Classic Lemonade from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-11",
        "name": "Special Shake Plus",
        "price": 263,
        "description": "Delicious Special Shake from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-12",
        "name": "Royal Cold Coffee Plus",
        "price": 277,
        "description": "Delicious Royal Cold Coffee from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-13",
        "name": "Spicy Mocktail Plus",
        "price": 291,
        "description": "Delicious Spicy Mocktail from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-14",
        "name": "Crispy Fruit Juice Plus",
        "price": 305,
        "description": "Delicious Crispy Fruit Juice from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-15",
        "name": "Premium Tea Plus",
        "price": 324,
        "description": "Delicious Premium Tea from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-16",
        "name": "Loaded Lemonade Plus",
        "price": 338,
        "description": "Delicious Loaded Lemonade from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-17",
        "name": "Gourmet Shake Plus",
        "price": 352,
        "description": "Delicious Gourmet Shake from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-18",
        "name": "Rustic Cold Coffee Plus",
        "price": 366,
        "description": "Delicious Rustic Cold Coffee from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-19",
        "name": "Signature Mocktail Plus",
        "price": 380,
        "description": "Delicious Signature Mocktail from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-20",
        "name": "Classic Fruit Juice Plus",
        "price": 399,
        "description": "Delicious Classic Fruit Juice from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-21",
        "name": "Special Tea Plus",
        "price": 413,
        "description": "Delicious Special Tea from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-22",
        "name": "Royal Lemonade Plus",
        "price": 427,
        "description": "Delicious Royal Lemonade from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-23",
        "name": "Spicy Shake Plus",
        "price": 441,
        "description": "Delicious Spicy Shake from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-24",
        "name": "Crispy Cold Coffee Plus",
        "price": 455,
        "description": "Delicious Crispy Cold Coffee from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-25",
        "name": "Premium Mocktail Plus",
        "price": 474,
        "description": "Delicious Premium Mocktail from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-26",
        "name": "Loaded Fruit Juice Plus",
        "price": 488,
        "description": "Delicious Loaded Fruit Juice from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-27",
        "name": "Gourmet Tea Plus",
        "price": 502,
        "description": "Delicious Gourmet Tea from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-28",
        "name": "Rustic Lemonade Plus",
        "price": 516,
        "description": "Delicious Rustic Lemonade from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-29",
        "name": "Signature Shake Plus",
        "price": 530,
        "description": "Delicious Signature Shake from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-30",
        "name": "Classic Cold Coffee Plus",
        "price": 549,
        "description": "Delicious Classic Cold Coffee from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-31",
        "name": "Special Mocktail Plus",
        "price": 563,
        "description": "Delicious Special Mocktail from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      },
      {
        "id": "hea-32",
        "name": "Royal Fruit Juice Plus",
        "price": 577,
        "description": "Delicious Royal Fruit Juice from HEA, made fresh for SRM students.",
        "image": "https://images.unsplash.com/photo-1544145945-f9042bd3a03b?q=80&w=400&auto=format&fit=crop",
        "category": "Beverages"
      }
    ]
  }
];

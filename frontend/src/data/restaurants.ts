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
    id: 'saffron-hub',
    name: 'Saffron Hub',
    rating: '5.0',
    time: '25m',
    description: 'The ultimate destination for authentic Biryani at SRM AP.',
    imageUrl: '/images/biryani.png',
    categories: ['Biryani', 'Starters', 'Drinks'],
    menu: [
      {
        id: 'sh-01',
        name: 'Special Chicken Dum Biryani',
        price: 249,
        description: 'Traditional slow-cooked dum biryani with succulent chicken and aromatic basmati rice.',
        image: '/images/biryani.png',
        category: 'Biryani'
      },
      {
        id: 'sh-02',
        name: 'Chicken 65',
        price: 180,
        description: 'Spicy, deep-fried chicken pieces with curry leaves and green chillies.',
        image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?q=80&w=400&auto=format&fit=crop',
        category: 'Starters'
      }
    ]
  },
  {
    id: 'rolls-king',
    name: 'Rolls King',
    rating: '4.7',
    time: '15m',
    description: 'Kathi rolls that rule the campus hunger.',
    imageUrl: '/images/roll.png',
    categories: ['Veg Rolls', 'Non-Veg Rolls', 'Sides'],
    menu: [
      {
        id: 'rk-01',
        name: 'Paneer Tikka Roll',
        price: 120,
        description: 'Grilled paneer cubes with mint chutney and onions wrapped in a crispy paratha.',
        image: '/images/roll.png',
        category: 'Veg Rolls'
      },
      {
        id: 'rk-02',
        name: 'Double Egg Chicken Roll',
        price: 150,
        description: 'Double egg layered roll with spicy chicken chunks.',
        image: 'https://images.unsplash.com/photo-1626776878853-91899147573f?q=80&w=400&auto=format&fit=crop',
        category: 'Non-Veg Rolls'
      }
    ]
  },
  {
    id: 'cafe-coffee-day',
    name: 'Cafe Coffee Day',
    rating: '4.9',
    time: '10m',
    description: 'Perfect spot for a late-night caffeine fix.',
    imageUrl: '/images/frappe.png',
    categories: ['Hot Coffee', 'Cold Coffee', 'Snacks'],
    menu: [
      {
        id: 'ccd-01',
        name: 'Chocolate Frappe',
        price: 190,
        description: 'Rich chocolate blended with coffee and ice, topped with whipped cream.',
        image: '/images/frappe.png',
        category: 'Cold Coffee'
      }
    ]
  }
];

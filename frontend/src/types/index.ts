export interface MenuItem {
  _id?: string;
  id?: string;
  name: string;
  price: number;
  image?: string;
  imageUrl?: string;
  description?: string;
  category?: string;
  restaurantId?: string;
  restaurantName?: string;
  tags?: string[];
  isVegetarian?: boolean;
}

export interface Restaurant {
  _id: string;
  id?: string;
  name: string;
  menu: MenuItem[];
  rating?: string;
  image?: string;
  imageUrl?: string;
  description?: string;
  time?: string;
  tags?: string[];
  vendorType?: string;
  categories?: string[];
}

export interface User {
  _id?: string;
  name?: string;
  phone?: string;
  isElite?: boolean;
  zenPoints?: number;
  hostelBlock?: string;
}

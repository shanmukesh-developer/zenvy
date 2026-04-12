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
   isAvailable?: boolean;
   isEliteOnly?: boolean;
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
  lat?: number;
  lon?: number;
  time?: string;
  calculatedTime?: string;
  tags?: string[];
  vendorType?: string;
  categories?: string[];
}

export interface User {
  _id?: string;
  id?: string;
  name?: string;
  phone?: string;
  isElite?: boolean;
  defaultAddress?: string;
  zenPoints?: number;
  hostelBlock?: string;
  profileImage?: string | null;
}

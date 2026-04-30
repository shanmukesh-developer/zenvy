"use client";
import React, { createContext, useContext, useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  restaurantId: string;
  restaurantName?: string;
  isCake?: boolean;
  customName?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateCustomName: (id: string, name: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('zenvy_cart');
    if (saved) {
      try { setCart(JSON.parse(saved)); } catch {}
    }
    setIsLoaded(true);
  }, []);

  React.useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('zenvy_cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const addToCart = (item: Omit<CartItem, 'quantity'> & { quantity?: number, imageUrl?: string }) => {
    const itemWithQty = { ...item, quantity: item.quantity || 1, image: item.image || item.imageUrl };
    
    // Multi-Restaurant Validation
    if (cart.length > 0) {
      const currentRestaurantId = cart[0].restaurantId;
      if (currentRestaurantId !== itemWithQty.restaurantId) {
         throw new Error('MULTIPLE_RESTAURANTS');
      }
    }

    setCart((prev) => {
      const normalizedId = String(itemWithQty.id).trim();
      const existing = prev.find((i) => String(i.id).trim() === normalizedId);
      if (existing) {
        return prev.map((i) => 
          String(i.id).trim() === normalizedId 
            ? { ...i, quantity: i.quantity + itemWithQty.quantity } 
            : i
        );
      }
      return [...prev, { ...itemWithQty, id: normalizedId } as CartItem];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const updateCustomName = (id: string, name: string) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, customName: name } : i));
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, updateCustomName, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

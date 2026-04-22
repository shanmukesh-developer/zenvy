"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAdminAuth } from '@/utils/useAdminAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';

const LEGACY_DATA = [
  {
    "id": "biryani-hub",
    "name": "Biryani Hub",
    "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs", "Main Course"],
    "vendorType": "RESTAURANT",
    "menu": [
      { "id": "bir-01", "name": "Special Mutton Fry", "price": 280, "description": "Tender goat cooked in traditional spices.", "image": "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400", "category": "Biryani" },
      { "id": "bir-02", "name": "Royal Egg Biryani", "price": 220, "description": "Fragrant rice with double eggs.", "image": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400", "category": "Biryani" }
    ]
  },
  {
    "id": "burger-club",
    "name": "The Burger Club",
    "imageUrl": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=400",
    "categories": ["Burgers", "Sides", "Shakes"],
    "vendorType": "RESTAURANT",
    "menu": [
      { "id": "brg-01", "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "Burgers" }
    ]
  },
  {
    "id": "pizza-paradise",
    "name": "Pizza Paradise",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    "categories": ["Pizza", "Pasta", "Sides"],
    "vendorType": "RESTAURANT",
    "menu": [
      { "id": "piz-01", "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400", "category": "Pizza" }
    ]
  },
  {
    "id": "campus-pharmacy",
    "name": "Campus MedPoint",
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400",
    "categories": ["First Aid", "Vitamins", "Hygiene"],
    "vendorType": "PHARMACY",
    "menu": [
      { "id": "ph-01", "name": "First Aid Compact Kit", "price": 199, "description": "Essential campus first aid essentials.", "image": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400", "category": "First Aid" },
      { "id": "ph-02", "name": "Vitamin C Booster", "price": 150, "description": "Immune support tablets.", "image": "https://images.unsplash.com/photo-1547489432-cf93fa6c71ee?w=400", "category": "Vitamins" },
      { "id": "ph-03", "name": "Hand Sanitizer Pack", "price": 80, "description": "Alcohol-based sanitizer 3-pack.", "image": "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=400", "category": "Hygiene" }
    ]
  },
  {
    "id": "campus-stationary",
    "name": "Nexus BookHouse",
    "imageUrl": "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400",
    "categories": ["Notebooks", "Pens", "Drafting"],
    "vendorType": "STATIONARY",
    "menu": [
      { "id": "st-01", "name": "Executive Leather Journal", "price": 599, "description": "Premium leather-bound A5 journal.", "image": "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400", "category": "Notebooks" },
      { "id": "st-02", "name": "Precision Pen Set", "price": 850, "description": "Professional drafting pen collection.", "image": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400", "category": "Pens" },
      { "id": "st-03", "name": "Graph Pad A4 (Pack of 5)", "price": 120, "description": "Engineering graph paper pads.", "image": "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=400", "category": "Drafting" }
    ]
  },
  {
    "id": "campus-laundry",
    "name": "FreshPress Laundry",
    "imageUrl": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400",
    "categories": ["Dry Wash", "Ironing", "Sneaker Care"],
    "vendorType": "LAUNDRY",
    "menu": [
      { "id": "lnd-01", "name": "Express Dry Cleaning (Suit)", "price": 499, "description": "Premium dry wash for formal wear.", "image": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400", "category": "Dry Wash" },
      { "id": "lnd-02", "name": "Sneaker Deep Restore", "price": 250, "description": "Full sneaker cleaning & whitening.", "image": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400", "category": "Sneaker Care" },
      { "id": "lnd-03", "name": "Weekly Ironing Pack (10 pcs)", "price": 150, "description": "Iron & fold service for 10 items.", "image": "https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?w=400", "category": "Ironing" }
    ]
  },
  {
    "id": "gym-nutrition-hq",
    "name": "Iron Kitchen: Pro Meals",
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
    "categories": ["Protein Bowls", "Shakes", "Supplements"],
    "vendorType": "GYM",
    "menu": [
      { "id": "gm-01", "name": "High-Protein Salmon Bowl", "price": 350, "description": "30g protein with quinoa & avocado.", "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400", "category": "Protein Bowls" },
      { "id": "gm-02", "name": "Whey Isolate Shake", "price": 199, "description": "Vanilla whey isolate, 25g protein.", "image": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400", "category": "Shakes" },
      { "id": "gm-03", "name": "Vegan Protein Crisp Bar", "price": 120, "description": "Plant-based protein bar.", "image": "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400", "category": "Supplements" }
    ]
  },
  {
    "id": "campus-cafe",
    "name": "Zenvy Brew Bar",
    "imageUrl": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400",
    "categories": ["Coffee", "Tea", "Mocktails"],
    "vendorType": "DRINKS",
    "menu": [
      { "id": "dr-01", "name": "Iced Caramel Macchiato", "price": 160, "description": "Double-shot espresso with caramel drizzle.", "image": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400", "category": "Coffee" },
      { "id": "dr-02", "name": "Matcha Green Tea Latte", "price": 140, "description": "Premium matcha with steamed milk.", "image": "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400", "category": "Tea" },
      { "id": "dr-03", "name": "Nitro Cold Brew", "price": 220, "description": "Nitrogen-infused cold brew coffee.", "image": "https://images.unsplash.com/photo-1517701550927-30cf4bb1dba5?w=400", "category": "Coffee" }
    ]
  },
  {
    "id": "seasonal-gifting",
    "name": "Nexus Gift Lounge",
    "imageUrl": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400",
    "categories": ["Hampers", "Merch", "Limited Edition"],
    "vendorType": "SEASONAL",
    "menu": [
      { "id": "se-01", "name": "Nexus Holiday Hamper", "price": 999, "description": "Curated premium gift box.", "image": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400", "category": "Hampers" },
      { "id": "se-02", "name": "Limited Edition Campus Mug", "price": 299, "description": "Collector's edition SRMAP mug.", "image": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400", "category": "Merch" }
    ]
  },
  {
    "id": "campus-rentals",
    "name": "Nexus Campus Fleet",
    "imageUrl": "https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400",
    "categories": ["E-Bikes", "Scooters", "Boards"],
    "vendorType": "RENTAL",
    "menu": [
      { "id": "rn-01", "name": "Nexus E-Bike Pro (Hourly)", "price": 50, "description": "Electric bike rental per hour.", "image": "https://images.unsplash.com/photo-1571068316344-75bc76f77891?w=400", "category": "E-Bikes" },
      { "id": "rn-02", "name": "Electric Longboard X", "price": 75, "description": "Premium electric longboard rental.", "image": "https://images.unsplash.com/photo-1531565637446-32307b194362?w=400", "category": "Boards" },
      { "id": "rn-03", "name": "Classic Campus Cruiser", "price": 30, "description": "Standard bicycle rental per hour.", "image": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400", "category": "E-Bikes" }
    ]
  },
  {
    "id": "fruit-market",
    "name": "Fresh Harvest Hub",
    "imageUrl": "https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=400",
    "categories": ["Exotic", "Seasonal", "Bundles"],
    "vendorType": "GROCERY",
    "menu": [
      { "id": "fr-01", "name": "Organic Dragon Fruit", "price": 120, "description": "Premium imported dragon fruit.", "image": "https://images.unsplash.com/photo-1527325541517-4506b7d44c8c?w=400", "category": "Exotic" },
      { "id": "fr-02", "name": "Exotic Berries Symphony", "price": 599, "description": "Mixed premium berry box.", "image": "https://images.unsplash.com/photo-1464965211904-c72145311ad7?w=400", "category": "Exotic" },
      { "id": "fr-03", "name": "Avocado Toast Kit", "price": 350, "description": "Everything for the perfect avocado toast.", "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400", "category": "Bundles" }
    ]
  },
  {
    "id": "sweets-boutique",
    "name": "Le Macaron Boutique",
    "imageUrl": "https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=400",
    "categories": ["Chocolates", "Pastries", "Pralines"],
    "vendorType": "SWEETS",
    "menu": [
      { "id": "sw-01", "name": "Gold Leaf Belgian Pralines", "price": 699, "description": "Handcrafted gold leaf chocolates.", "image": "https://images.unsplash.com/photo-1581798459219-3385269f0653?w=400", "category": "Pralines" },
      { "id": "sw-02", "name": "Macaron Collection (12 pcs)", "price": 450, "description": "Assorted French macarons.", "image": "https://images.unsplash.com/photo-1569864352342-fd43c330df47?w=400", "category": "Pastries" },
      { "id": "sw-03", "name": "Artisan Dark Chocolate Box", "price": 299, "description": "Single-origin 72% dark chocolate.", "image": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400", "category": "Chocolates" }
    ]
  }
];

interface Restaurant {
  _id: string;
  name: string;
  location: string;
  commissionRate: number;
  commissionType: 'percentage' | 'flat';
  operatingHours: { start: string, end: string };
  isActive: boolean;
  tags?: string[];
  imageUrl?: string;
  vendorType?: string;
}

interface MenuItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
  isEliteOnly: boolean;
  description?: string;
  image?: string;
  tags?: string[];
  isVegetarian?: boolean;
}

export default function GourmetManagement() {
  const isAuthed = useAdminAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'menu'>('list');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newRest, setNewRest] = useState({ name: '', location: 'Main Campus', imageUrl: '', commissionRate: 10, commissionType: 'percentage', vendorType: 'RESTAURANT', rating: 0, deliveryTime: 30, tags: '', operatingHoursStart: '09:00', operatingHoursEnd: '22:00', isActive: true, isOffline: false, password: '' });
  const [newItem, setNewItem] = useState({ name: '', price: 0, category: '', description: '', image: '', isEliteOnly: false, tags: '', isVegetarian: false });

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/restaurants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setRestaurants(data);
    } catch (_err) {
      console.error('[RESTAURANT_FETCH_ERROR]', _err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLegacy = async () => {
    if(!confirm('Import all current campus restaurants and items into the Nexus?')) return;
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ restaurants: LEGACY_DATA })
      });
      if (res.ok) fetchRestaurants();
    } catch (_err) { console.error('[SYNC_ERROR]', _err); } finally { setIsSyncing(false); }
  };

  const handleCreateRestaurant = async () => {
    try {
      if (!newRest.name.trim()) return alert('Restaurant Name is required!');
      if (!newRest.location.trim()) return alert('Location is required!');

      const token = localStorage.getItem('token');
      
      let finalImageUrl = newRest.imageUrl;
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        try {
          const uploadRes = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();
          if (uploadData.imageUrl) finalImageUrl = uploadData.imageUrl;
        } catch (_err) {
          console.error("Upload failed", _err);
        }
      }

      const payload = {
        ...newRest,
        imageUrl: finalImageUrl,
        tags: newRest.tags.split(',').map(t => t.trim()).filter(t => t),
        operatingHours: { start: newRest.operatingHoursStart, end: newRest.operatingHoursEnd }
      };
      
      const res = await fetch(`${API_URL}/api/admin/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) { 
        setIsAdding(false); 
        fetchRestaurants(); 
        setNewRest({ name: '', location: 'Main Campus', imageUrl: '', commissionRate: 10, commissionType: 'percentage', vendorType: 'RESTAURANT', rating: 0, deliveryTime: 30, tags: '', operatingHoursStart: '09:00', operatingHoursEnd: '22:00', isActive: true, isOffline: false, password: '' });
      } else {
        alert(`Failed to create restaurant: ${data.message || 'Unknown error'}`);
      }
    } catch (_err) { 
      console.error('[CREATE_ERROR]', _err); 
      alert('Network or server error creating restaurant');
    }
  };

  const handleCreateMenuItem = async () => {
    if(!selectedRestaurant) return;
    try {
      if (!newItem.name.trim()) return alert('Item Name is required!');
      if (isNaN(newItem.price) || newItem.price <= 0) return alert('Price must be a positive number!');

      const token = localStorage.getItem('token');
      
      let finalImageUrl = newItem.image;
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        try {
          const uploadRes = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();
          if (uploadData.imageUrl) finalImageUrl = uploadData.imageUrl;
        } catch (_err) {
          console.error("Upload failed", _err);
        }
      }

      const res = await fetch(`${API_URL}/api/admin/menu-items/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          ...newItem, 
          image: finalImageUrl,
          imageUrl: finalImageUrl,
          restaurantId: selectedRestaurant._id,
          tags: newItem.tags.split(',').map(t => t.trim()).filter(t => t),
          isVegetarian: newItem.isVegetarian
        })
      });
      
      const data = await res.json();
      if (res.ok) { 
        setIsAddingItem(false); 
        fetchMenu(selectedRestaurant._id); 
      } else {
        alert(`Failed to create item: ${data.message || 'Unknown error'}`);
      }
    } catch (_err) { 
      console.error('[ITEM_CREATE_ERROR]', _err); 
      alert('Network or server error creating menu item');
    }
  };

  const fetchMenu = async (restaurantId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/menu-items?restaurantId=${restaurantId}`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setMenuItems(data);
    } catch (_err) { console.error('[MENU_FETCH_ERROR]', _err); }
  };

  const toggleEliteItem = async (menuItem: MenuItem) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/menu-items/${menuItem._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...menuItem, isEliteOnly: !menuItem.isEliteOnly })
      });
      if (res.ok && selectedRestaurant) fetchMenu(selectedRestaurant._id);
    } catch (_err) { console.error('[ELITE_TOGGLE_ERROR]', _err); }
  };

  const deleteMenuItem = async (menuItemId: string) => {
    if (!confirm('Remove this menu item from the Nexus?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/admin/menu-items/${menuItemId}/delete`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Optimistically remove from state
      setMenuItems(prev => prev.filter(i => i._id !== menuItemId));
    } catch (_err) { console.error('[ITEM_DELETE_ERROR]', _err); }
  };

  const deleteRestaurant = async (restaurantId: string) => {
    if (!confirm('DANGER: This will permanently delete this restaurant node and ALL its menu items. Continue?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRestaurants(prev => prev.filter(r => r._id !== restaurantId));
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.message || 'Unknown error'}`);
      }
    } catch (_err) { console.error('[REST_DELETE_ERROR]', _err); }
  };

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
            {view === 'list' ? 'Gourmet ' : 'Tactical '}
            <span className="text-emerald-500">{view === 'list' ? 'Terminal' : 'Menu Control'}</span>
          </h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">
            {view === 'list' ? 'Absolute Partner Oversight & Revenue splits' : `Managing Assets for ${selectedRestaurant?.name}`}
          </p>
        </div>
        <div className="flex gap-4">
           {view === 'list' && (
             <div className="flex gap-4">
               <button onClick={() => setIsAdding(true)} className="px-8 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                 Deploy New Node
               </button>
               <button onClick={handleSyncLegacy} disabled={isSyncing} className="px-8 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all">
                 {isSyncing ? 'Syncing...' : 'Omni-Sync Assets'}
               </button>
             </div>
           )}
           {view === 'menu' && (
             <button onClick={() => setView('list')} className="px-6 py-3 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20">
                Return to Terminal
             </button>
           )}
        </div>
      </header>

      {isAdding && (
        <div className="glass-card p-10 border-emerald-500/30">
           <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Deploy New Restaurant Node</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Restaurant Name</label>
                <input placeholder="e.g. Nexus Cafe" className="admin-input w-full" value={newRest.name} onChange={(e) => setNewRest({...newRest, name: e.target.value})} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-1">Cover Image (Local File)</label>
                <input type="file" accept="image/*" className="admin-input cursor-pointer w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500 hover:file:text-black transition-all" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Location Campus</label>
                <input placeholder="e.g. Main Campus" className="admin-input w-full" value={newRest.location} onChange={(e) => setNewRest({...newRest, location: e.target.value})} />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Commission Split</label>
                <div className="flex gap-4">
                  <input placeholder="Amount" type="number" className="admin-input w-full" value={newRest.commissionRate} onChange={(e) => setNewRest({...newRest, commissionRate: parseFloat(e.target.value)})} />
                  <select className="admin-input w-24 p-0 px-2 text-center" value={newRest.commissionType} onChange={(e) => setNewRest({...newRest, commissionType: e.target.value})}>
                      <option value="percentage">%</option>
                      <option value="flat">₹</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Vendor Category</label>
                <select className="admin-input w-full" value={newRest.vendorType} onChange={(e) => setNewRest({...newRest, vendorType: e.target.value})}>
                    <option value="RESTAURANT">🍽️ Restaurant (Food)</option>
                    <option value="GROCERY">🍎 Grocery / Fresh Fruits</option>
                    <option value="SWEETS">🍩 Sweets & Bakery</option>
                    <option value="DRINKS">🥤 Drinks & Beverages</option>
                    <option value="RENTAL">🚗 Rental (Bikes/Scooters)</option>
                    <option value="GYM">💪 Gym & Nutrition</option>
                    <option value="LAUNDRY">👔 Laundry & Dry Wash</option>
                    <option value="PHARMACY">💊 Pharmacy & Wellness</option>
                    <option value="STATIONARY">📚 Stationary & Books</option>
                    <option value="SEASONAL">🎁 Seasonal & Gifts</option>
                    <option value="GLOBAL_MARKET">🌐 Global Marketplace</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Starting Rating</label>
                <input placeholder="e.g. 4.5" type="number" step="0.1" className="admin-input w-full" value={newRest.rating || ''} onChange={(e) => setNewRest({...newRest, rating: parseFloat(e.target.value)})} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Delivery Time (Mins)</label>
                <input placeholder="e.g. 30" type="number" className="admin-input w-full" value={newRest.deliveryTime || ''} onChange={(e) => setNewRest({...newRest, deliveryTime: parseInt(e.target.value)})} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Search Tags</label>
                <input placeholder="e.g. spicy, vegan, fast" autoComplete="off" className="admin-input w-full" value={newRest.tags} onChange={(e) => setNewRest({...newRest, tags: e.target.value})} />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Operating Hours</label>
                <div className="flex gap-4 admin-input items-center w-full">
                  <input type="time" className="bg-transparent text-white outline-none w-full text-center" value={newRest.operatingHoursStart} onChange={(e) => setNewRest({...newRest, operatingHoursStart: e.target.value})} />
                  <span className="text-gray-500">-</span>
                  <input type="time" className="bg-transparent text-white outline-none w-full text-center" value={newRest.operatingHoursEnd} onChange={(e) => setNewRest({...newRest, operatingHoursEnd: e.target.value})} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Operational Toggles</label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center justify-between admin-input cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="text-[10px] uppercase font-black text-gray-400">Active Node</span>
                    <input type="checkbox" className="w-5 h-5 rounded-lg accent-emerald-500" checked={newRest.isActive} onChange={(e) => setNewRest({...newRest, isActive: e.target.checked})} />
                  </label>
                  <label className="flex-1 flex items-center justify-between admin-input cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="text-[10px] uppercase font-black text-gray-400">Offline Shop</span>
                    <input type="checkbox" className="w-5 h-5 rounded-lg accent-emerald-500" checked={newRest.isOffline} onChange={(e) => setNewRest({...newRest, isOffline: e.target.checked})} />
                  </label>
                </div>
              </div>
              
              {!newRest.isOffline && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Portal Access Password</label>
                  <div className="relative w-full">
                    <input placeholder="Setup Restaurant Password" autoComplete="new-password" type={showPassword ? "text" : "password"} className="admin-input w-full pr-12" value={newRest.password} onChange={(e) => setNewRest({...newRest, password: e.target.value})} />
                    <button type="button" title={showPassword ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}
           </div>
           <div className="flex gap-4 mt-8">
              <button onClick={handleCreateRestaurant} className="flex-1 py-5 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-3xl">Execute Deployment</button>
              <button onClick={() => setIsAdding(false)} className="px-10 py-5 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-3xl">Cancel</button>
           </div>
        </div>
      )}

      {isAddingItem && (
        <div className="glass-card p-10 border-blue-500/30">
           <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Deploy New Menu Asset</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Asset Name</label>
                <input placeholder="e.g. Premium Burger" className="admin-input w-full" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Price (₹)</label>
                <input placeholder="e.g. 150" type="number" className="admin-input w-full" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Category</label>
                <input placeholder="e.g. Mains, Sides" className="admin-input w-full" value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Item Image (Local File)</label>
                <input type="file" accept="image/*" className="admin-input cursor-pointer w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500 hover:file:text-white transition-all" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Search Tags (Comma Separated)</label>
                <input placeholder="e.g. spicy, vegan, bestseller" autoComplete="off" className="admin-input w-full" value={newItem.tags} onChange={(e) => setNewItem({...newItem, tags: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Dietary Config</label>
                <label className="flex items-center justify-between admin-input cursor-pointer hover:bg-white/5 transition-colors w-full h-[58px]">
                  <span className="text-[10px] uppercase font-black text-emerald-400">Strictly Vegetarian?</span>
                  <input type="checkbox" className="w-5 h-5 rounded-lg accent-emerald-500" checked={newItem.isVegetarian} onChange={(e) => setNewItem({...newItem, isVegetarian: e.target.checked})} />
                </label>
              </div>
              <div className="space-y-3 col-span-full">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Description / Ingredients</label>
                <textarea placeholder="Describe the item perfectly..." className="admin-input w-full h-24 p-5" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} />
              </div>
           </div>
           <div className="flex gap-4 mt-8">
              <button onClick={handleCreateMenuItem} className="flex-1 py-5 bg-blue-600 text-white font-black uppercase tracking-widest rounded-3xl">Commit Asset</button>
              <button onClick={() => setIsAddingItem(false)} className="px-10 py-5 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-3xl">Cancel</button>
           </div>
        </div>
      )}

      {view === 'list' && !isAdding ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-white">
          {loading ? (
            <div className="col-span-full py-20 text-center font-black text-gray-600 animate-pulse tracking-widest uppercase">Initializing Gourmet Nodes...</div>
          ) : restaurants.map((rest) => (
            <div key={rest._id} className="glass-card p-8 group hover:border-emerald-500/50 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl overflow-hidden border border-white/10 relative">
                    <Image src={rest.imageUrl || "/assets/placeholder.png"} fill style={{ objectFit: 'cover' }} alt={rest.name} />
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Commission</span>
                  <p className="text-xl font-black text-white">{rest.commissionRate}%</p>
                </div>
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-tight mb-1">{rest.name}</h4>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  rest.vendorType === 'PHARMACY' ? 'bg-pink-500/20 text-pink-400' :
                  rest.vendorType === 'STATIONARY' ? 'bg-indigo-500/20 text-indigo-400' :
                  rest.vendorType === 'LAUNDRY' ? 'bg-cyan-500/20 text-cyan-400' :
                  rest.vendorType === 'GYM' ? 'bg-orange-500/20 text-orange-400' :
                  rest.vendorType === 'DRINKS' ? 'bg-purple-500/20 text-purple-400' :
                  rest.vendorType === 'SEASONAL' ? 'bg-rose-500/20 text-rose-400' :
                  rest.vendorType === 'RENTAL' ? 'bg-sky-500/20 text-sky-400' :
                  rest.vendorType === 'GROCERY' ? 'bg-lime-500/20 text-lime-400' :
                  rest.vendorType === 'SWEETS' ? 'bg-amber-500/20 text-amber-400' :
                  rest.vendorType === 'GLOBAL_MARKET' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-white/10 text-gray-400'
                }`}>{rest.vendorType || 'RESTAURANT'}</span>
              </div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">{rest.location}</p>
              <div className="flex gap-3">
                <button onClick={() => { setSelectedRestaurant(rest); fetchMenu(rest._id); setView('menu'); }} className="flex-1 py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-emerald-500 hover:text-white transition-all">Manage Assets</button>
                <button onClick={() => deleteRestaurant(rest._id)} className="px-5 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : view === 'menu' && !isAddingItem ? (
        <div className="glass-card p-8 bg-white/[0.01]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.map((item: MenuItem) => (
                <div key={item._id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 group hover:border-emerald-500/30 transition-all flex justify-between">
                   <div>
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">{item.category}</p>
                      <h5 className="text-sm font-black text-white line-clamp-1">{item.name}</h5>
                      <p className="text-xs font-black text-emerald-500 mt-1">₹{item.price}</p>
                   </div>
                   <div className="flex flex-col items-end justify-between">
                     <button onClick={() => toggleEliteItem(item)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${item.isEliteOnly ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-white/5 text-gray-500'}`}>{item.isEliteOnly ? 'Elite' : 'Std'}</button>
                     <button className="text-[9px] text-red-500/50 hover:text-red-500 font-black uppercase" onClick={() => deleteMenuItem(item._id)}>Remove</button>
                   </div>
                </div>
              ))}
              <div onClick={() => setIsAddingItem(true)} className="p-10 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 group transition-all">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">➕</div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Deploy New Asset</span>
              </div>
            </div>
        </div>
      ) : null}
      <style jsx>{`
        .admin-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 1.25rem;
          border-radius: 1.5rem;
          color: white;
          font-weight: 900;
          outline: none;
        }
        .admin-input:focus { border-color: rgba(16, 185, 129, 0.5); }
        select.admin-input option {
          background: #1a1a2e;
          color: #ffffff;
          padding: 12px 16px;
          font-weight: 700;
          font-size: 14px;
        }
        select.admin-input option:checked {
          background: #10b981;
          color: #000;
        }
      `}</style>
    </div>
  );
}


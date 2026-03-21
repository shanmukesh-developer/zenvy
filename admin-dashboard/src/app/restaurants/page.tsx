"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const LEGACY_DATA = [
  {
    "id": "biryani-hub",
    "name": "Biryani Hub",
    "imageUrl": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=400&auto=format&fit=crop",
    "categories": ["Biryani", "Kebabs", "Main Course"],
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
    "menu": [
      { "id": "brg-01", "name": "Classic Cheeseburger", "price": 150, "description": "Juicy patty with melted cheddar.", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400", "category": "Burgers" }
    ]
  },
  {
    "id": "pizza-paradise",
    "name": "Pizza Paradise",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400",
    "categories": ["Pizza", "Pasta", "Sides"],
    "menu": [
      { "id": "piz-01", "name": "Margherita Classica", "price": 280, "description": "San Marzano tomatoes & fresh mozzarella.", "image": "/assets/margherita_classica.png", "category": "Pizza" }
    ]
  },
  {
    "id": "la-pinoz",
    "name": "La Pino'z",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
    "categories": ["Pizza", "Sides", "Beverages"],
    "menu": [
      { "id": "lap-01", "name": "7 Layer Pizza", "price": 380, "description": "Loaded with unique layers of toppings.", "image": "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400", "category": "Pizza" }
    ]
  },
  {
    "id": "gym-1",
    "name": "Iron Kitchen: Pro Meals",
    "imageUrl": "/assets/zenvy_gym_rats_nutrition_1773839650320.png",
    "categories": ["Protein Bowls", "Lean Salads", "Keto"],
    "menu": [
      { "id": "gp-1", "name": "Whey Protein Bowl", "price": 250, "description": "30g protein, quinoa, avocado and chicken.", "image": "/assets/whey_protein_bowl.png", "category": "Protein Bowls" }
    ]
  },
  {
    "id": "boutique-summer-elite",
    "name": "Summer Oasis: Elite",
    "imageUrl": "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?auto=format&fit=crop&q=80&w=800&ts=elite_final",
    "categories": ["Coolants", "Traditional", "Ice Creams"],
    "menu": [
      { "id": "ss-01", "name": "Chilled Tender Coconut", "price": 60, "description": "Freshly cut natural coconut water with pulp.", "image": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400", "category": "Coolants" }
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
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'menu'>('list');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newRest, setNewRest] = useState({ name: '', location: 'Main Campus', imageUrl: '', commissionRate: 10, commissionType: 'percentage', vendorType: 'RESTAURANT', rating: 0, deliveryTime: 30, tags: '', operatingHoursStart: '09:00', operatingHoursEnd: '22:00', isActive: true });
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
      const token = localStorage.getItem('token');
      const payload = {
        ...newRest,
        tags: newRest.tags.split(',').map(t => t.trim()).filter(t => t),
        operatingHours: { start: newRest.operatingHoursStart, end: newRest.operatingHoursEnd }
      };
      const res = await fetch(`${API_URL}/api/admin/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) { setIsAdding(false); fetchRestaurants(); setNewRest({ name: '', location: 'Main Campus', imageUrl: '', commissionRate: 10, commissionType: 'percentage', vendorType: 'RESTAURANT', rating: 0, deliveryTime: 30, tags: '', operatingHoursStart: '09:00', operatingHoursEnd: '22:00', isActive: true }); }
    } catch (_err) { console.error('[CREATE_ERROR]', _err); }
  };

  const handleCreateMenuItem = async () => {
    if(!selectedRestaurant) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/menu-items/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
        ...newItem, 
        restaurantId: selectedRestaurant._id,
        tags: newItem.tags.split(',').map(t => t.trim()).filter(t => t),
        isVegetarian: newItem.isVegetarian
      })
      });
      if (res.ok) { setIsAddingItem(false); fetchMenu(selectedRestaurant._id); }
    } catch (_err) { console.error('[ITEM_CREATE_ERROR]', _err); }
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
              <input placeholder="Restaurant Name" className="admin-input" value={newRest.name} onChange={(e) => setNewRest({...newRest, name: e.target.value})} />
              <input placeholder="Image URL (Unsplash)" className="admin-input" value={newRest.imageUrl} onChange={(e) => setNewRest({...newRest, imageUrl: e.target.value})} />
              <input placeholder="Location" className="admin-input" value={newRest.location} onChange={(e) => setNewRest({...newRest, location: e.target.value})} />
              
              <div className="flex gap-4">
                <input placeholder="Commission" type="number" className="admin-input w-full" value={newRest.commissionRate} onChange={(e) => setNewRest({...newRest, commissionRate: parseFloat(e.target.value)})} />
                <select className="admin-input w-24 p-0 px-2 text-center" value={newRest.commissionType} onChange={(e) => setNewRest({...newRest, commissionType: e.target.value})}>
                    <option value="percentage">%</option>
                    <option value="flat">₹</option>
                </select>
              </div>
              
              <select className="admin-input" value={newRest.vendorType} onChange={(e) => setNewRest({...newRest, vendorType: e.target.value})}>
                  <option value="RESTAURANT">Restaurant (Food)</option>
                  <option value="GROCERY">Grocery/Fresh (Fruits/Sweets)</option>
                  <option value="RENTAL">Rental (Cars/Bikes)</option>
              </select>

              <input placeholder="Rating (0.0)" type="number" step="0.1" className="admin-input" value={newRest.rating || ''} onChange={(e) => setNewRest({...newRest, rating: parseFloat(e.target.value)})} />
              <input placeholder="Delivery Time (mins)" type="number" className="admin-input" value={newRest.deliveryTime || ''} onChange={(e) => setNewRest({...newRest, deliveryTime: parseInt(e.target.value)})} />
              <input placeholder="Tags (comma separated)" className="admin-input" value={newRest.tags} onChange={(e) => setNewRest({...newRest, tags: e.target.value})} />
              
              <div className="flex gap-4 admin-input items-center">
                <span className="text-[10px] text-gray-500 uppercase font-black">Hours</span>
                <input type="time" className="bg-transparent text-white outline-none w-full" value={newRest.operatingHoursStart} onChange={(e) => setNewRest({...newRest, operatingHoursStart: e.target.value})} />
                <span className="text-gray-500">-</span>
                <input type="time" className="bg-transparent text-white outline-none w-full" value={newRest.operatingHoursEnd} onChange={(e) => setNewRest({...newRest, operatingHoursEnd: e.target.value})} />
              </div>

              <label className="flex items-center gap-4 admin-input cursor-pointer">
                <span className="text-[10px] uppercase font-black text-gray-400">Is Active Node?</span>
                <input type="checkbox" className="w-6 h-6 rounded-lg accent-emerald-500" checked={newRest.isActive} onChange={(e) => setNewRest({...newRest, isActive: e.target.checked})} />
              </label>
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
              <input placeholder="Item Name" className="admin-input" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} />
              <input placeholder="Price (₹)" type="number" className="admin-input" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: parseInt(e.target.value)})} />
              <input placeholder="Category (e.g. Mains, Sides)" className="admin-input" value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} />
              <input placeholder="Image URL" className="admin-input" value={newItem.image} onChange={(e) => setNewItem({...newItem, image: e.target.value})} />
              <input placeholder="Tags (comma separated: fruit, gym, seasonal)" className="admin-input" value={newItem.tags} onChange={(e) => setNewItem({...newItem, tags: e.target.value})} />
               <div className="flex items-center gap-4 admin-input">
                  <span className="text-[10px] uppercase font-black text-gray-400">Vegetarian?</span>
                  <input type="checkbox" className="w-6 h-6 rounded-lg accent-emerald-500" checked={newItem.isVegetarian} onChange={(e) => setNewItem({...newItem, isVegetarian: e.target.checked})} />
               </div>
              <textarea placeholder="Description" className="admin-input col-span-full h-24" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} />
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
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">{rest.location}</p>
              <button onClick={() => { setSelectedRestaurant(rest); fetchMenu(rest._id); setView('menu'); }} className="w-full py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-all">Manage Active Assets</button>
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
      `}</style>
    </div>
  );
}


"use client";
import { useState } from 'react';

interface RestaurantFormProps {
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>, image: File | null) => void;
  isCreating: boolean;
}

export function AddRestaurantForm({ onCancel, onSubmit, isCreating }: RestaurantFormProps) {
  const [formData, setFormData] = useState({ 
    name: '', 
    location: 'Main Campus', 
    imageUrl: '', 
    commissionRate: 10, 
    commissionType: 'percentage', 
    vendorType: 'RESTAURANT', 
    rating: 4.0, 
    deliveryTime: 30, 
    tags: '', 
    operatingHoursStart: '09:00', 
    operatingHoursEnd: '22:00', 
    isActive: true, 
    isOffline: false, 
    password: '' 
  });
  const [imageFile, setImageFile] = useState<File | null>(null);


  return (
    <div className="glass-card p-10 border-emerald-500/30">
       <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Deploy New Restaurant Node</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Restaurant Name</label>
            <input placeholder="e.g. Nexus Cafe" className="admin-input w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-1">Cover Image (Local File)</label>
            <input type="file" accept="image/*" className="admin-input cursor-pointer w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500 hover:file:text-black transition-all" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Location Campus</label>
            <input placeholder="e.g. Main Campus" className="admin-input w-full" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Commission Split</label>
            <div className="flex gap-4">
              <input placeholder="Amount" type="number" className="admin-input w-full" value={formData.commissionRate} onChange={(e) => setFormData({...formData, commissionRate: parseFloat(e.target.value)})} />
              <select className="admin-input w-24 p-0 px-2 text-center" value={formData.commissionType} onChange={(e) => setFormData({...formData, commissionType: e.target.value})}>
                  <option value="percentage">%</option>
                  <option value="flat">₹</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Vendor Category</label>
            <select className="admin-input w-full" value={formData.vendorType} onChange={(e) => setFormData({...formData, vendorType: e.target.value})}>
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
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Operating Hours</label>
            <div className="flex gap-4 admin-input items-center w-full">
              <input type="time" className="bg-transparent text-white outline-none w-full text-center" value={formData.operatingHoursStart} onChange={(e) => setFormData({...formData, operatingHoursStart: e.target.value})} />
              <span className="text-gray-500">-</span>
              <input type="time" className="bg-transparent text-white outline-none w-full text-center" value={formData.operatingHoursEnd} onChange={(e) => setFormData({...formData, operatingHoursEnd: e.target.value})} />
            </div>
          </div>
       </div>
       <div className="flex gap-4 mt-8">
          <button 
            disabled={isCreating}
            onClick={() => onSubmit(formData, imageFile)} 
            className="flex-1 py-5 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-3xl disabled:opacity-50"
          >
            {isCreating ? 'Deploying...' : 'Execute Deployment'}
          </button>
          <button onClick={onCancel} className="px-10 py-5 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-3xl">Cancel</button>
       </div>
    </div>
  );
}

interface ItemFormProps {
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>, image: File | null) => void;
}

export function AddMenuItemForm({ onCancel, onSubmit }: ItemFormProps) {
  const [formData, setFormData] = useState({ name: '', price: 0, category: '', description: '', image: '', isEliteOnly: false, tags: '', isVegetarian: false });
  const [imageFile, setImageFile] = useState<File | null>(null);

  return (
    <div className="glass-card p-10 border-blue-500/30">
       <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Deploy New Menu Asset</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Asset Name</label>
            <input placeholder="e.g. Premium Burger" className="admin-input w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Price (₹)</label>
            <input placeholder="e.g. 150" type="number" className="admin-input w-full" value={formData.price} onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})} />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Category</label>
            <input placeholder="e.g. Mains, Sides" className="admin-input w-full" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Item Image (Local File)</label>
            <input type="file" accept="image/*" className="admin-input cursor-pointer w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500 hover:file:text-white transition-all" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-3 col-span-full">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Description / Ingredients</label>
            <textarea placeholder="Describe the item perfectly..." className="admin-input w-full h-24 p-5" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
       </div>
       <div className="flex gap-4 mt-8">
          <button onClick={() => onSubmit(formData, imageFile)} className="flex-1 py-5 bg-blue-600 text-white font-black uppercase tracking-widest rounded-3xl">Commit Asset</button>
          <button onClick={onCancel} className="px-10 py-5 bg-white/5 text-gray-500 font-black uppercase tracking-widest rounded-3xl">Cancel</button>
       </div>
    </div>
  );
}

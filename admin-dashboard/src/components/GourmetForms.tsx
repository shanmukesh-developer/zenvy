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
    password: '',
    ownerName: '',
    ownerPhone: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);


  return (
    <div className="p-8 border border-emerald-900/30 bg-[#111315] rounded-[32px]">
       <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Deploy New Restaurant Node</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Restaurant Name</label>
            <input placeholder="e.g. Nexus Cafe" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-1">Cover Image (Local File)</label>
            <input type="file" accept="image/*" className="w-full text-xs cursor-pointer file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-emerald-900 file:text-emerald-400 hover:file:bg-emerald-800 file:cursor-pointer outline-none text-gray-300" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Location Campus</label>
            <input placeholder="e.g. Main Campus" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Commission Split</label>
            <div className="flex gap-2">
              <input placeholder="Amount" type="number" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.commissionRate} onChange={(e) => setFormData({...formData, commissionRate: parseFloat(e.target.value)})} />
              <select className="bg-white text-black px-3 py-2 outline-none font-semibold text-sm w-20 text-center" value={formData.commissionType} onChange={(e) => setFormData({...formData, commissionType: e.target.value})}>
                  <option value="percentage">%</option>
                  <option value="flat">₹</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Vendor Category</label>
            <select className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.vendorType} onChange={(e) => setFormData({...formData, vendorType: e.target.value})}>
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

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Operating Hours</label>
            <div className="flex gap-4 items-center w-full pt-1">
              <input type="time" className="bg-transparent text-white outline-none font-semibold font-sans text-sm" value={formData.operatingHoursStart} onChange={(e) => setFormData({...formData, operatingHoursStart: e.target.value})} />
              <span className="text-gray-500 font-bold">-</span>
              <input type="time" className="bg-transparent text-white outline-none font-semibold font-sans text-sm" value={formData.operatingHoursEnd} onChange={(e) => setFormData({...formData, operatingHoursEnd: e.target.value})} />
            </div>
          </div>

          {formData.vendorType === 'RENTAL' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 ml-1">Owner Name</label>
                <input placeholder="e.g. Shanmukesh K." className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.ownerName} onChange={(e) => setFormData({...formData, ownerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 ml-1">Owner Contact</label>
                <input placeholder="e.g. 9391955674" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.ownerPhone} onChange={(e) => setFormData({...formData, ownerPhone: e.target.value})} />
              </div>
            </>
          )}
       </div>
       <div className="flex gap-4 mt-8">
          <button 
            disabled={isCreating}
            onClick={() => onSubmit(formData, imageFile)} 
            className="flex-1 py-4 bg-[#10b981] text-white font-black uppercase tracking-widest rounded-2xl disabled:opacity-50 hover:bg-[#059669] transition-colors"
          >
            {isCreating ? 'Deploying...' : 'Execute Deployment'}
          </button>
          <button onClick={onCancel} className="px-10 py-4 bg-[#1e2024] hover:bg-[#2a2d33] transition-colors text-gray-400 font-black uppercase tracking-widest rounded-2xl">Cancel</button>
       </div>
    </div>
  );
}

interface ItemFormProps {
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>, image: File | null) => void;
  vendorType?: string;
}

export function AddMenuItemForm({ onCancel, onSubmit, vendorType }: ItemFormProps) {
  const [formData, setFormData] = useState({ 
    name: '', 
    price: 0, 
    category: '', 
    description: '', 
    image: '', 
    isEliteOnly: false, 
    tags: '', 
    isVegetarian: false,
    ownerName: '',
    ownerPhone: '',
    engine: '',
    topSpeed: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  return (
    <div className="p-8 border border-blue-900/30 bg-[#111315] rounded-[32px]">
       <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Deploy New Menu Asset</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Asset Name</label>
            <input placeholder="e.g. Premium Burger" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Price (₹)</label>
            <input placeholder="e.g. 150" type="number" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.price} onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Category</label>
            <input placeholder="e.g. Mains, Sides" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Item Image (Local File)</label>
            <input type="file" accept="image/*" className="w-full text-xs cursor-pointer file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-900 file:text-blue-400 hover:file:bg-blue-800 file:cursor-pointer outline-none text-gray-300" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-2 col-span-full">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Description / Ingredients</label>
            <textarea placeholder="Describe the item perfectly..." className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm h-24" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>

          {vendorType === 'RENTAL' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 ml-1">Owner Name</label>
                <input placeholder="e.g. Shanmukesh K." className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.ownerName} onChange={(e) => setFormData({...formData, ownerName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 ml-1">Owner Contact</label>
                <input placeholder="e.g. 9391955674" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.ownerPhone} onChange={(e) => setFormData({...formData, ownerPhone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-1">Engine / Battery Specs</label>
                <input placeholder="e.g. 250W Brushless" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.engine} onChange={(e) => setFormData({...formData, engine: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-1">Top Speed (km/h)</label>
                <input placeholder="e.g. 25" className="w-full bg-white text-black px-3 py-2 outline-none font-semibold text-sm" value={formData.topSpeed} onChange={(e) => setFormData({...formData, topSpeed: e.target.value})} />
              </div>
            </>
          )}
       </div>
       <div className="flex gap-4 mt-8">
          <button onClick={() => onSubmit(formData, imageFile)} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-black uppercase tracking-widest rounded-2xl">Commit Asset</button>
          <button onClick={onCancel} className="px-10 py-4 bg-[#1e2024] hover:bg-[#2a2d33] transition-colors text-gray-400 font-black uppercase tracking-widest rounded-2xl">Cancel</button>
       </div>
    </div>
  );
}

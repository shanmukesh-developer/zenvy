"use client";
import { useState } from 'react';
import { X, Upload, CheckCircle } from 'lucide-react';

interface ItemFormProps {
  initialData?: any;
  onCancel: () => void;
  onSubmit: (data: any, image: File | null) => void;
  isSubmitting?: boolean;
}

export function MenuItemForm({ initialData, onCancel, onSubmit, isSubmitting }: ItemFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    price: initialData?.price || '',
    category: initialData?.category || '',
    description: initialData?.description || '',
    isVegetarian: initialData?.isVegetarian ?? true,
    tags: Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : (initialData?.tags || ''),
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, imageFile);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              {initialData ? 'Update Asset' : 'Deploy New Asset'}
            </h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Menu Management Terminal</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X size={24} className="text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Asset Name</label>
              <input 
                required
                placeholder="e.g. Premium Burger" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white outline-none focus:border-orange-500 transition-all font-bold" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Price (₹)</label>
              <input 
                required
                placeholder="e.g. 150" 
                type="number" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white outline-none focus:border-orange-500 transition-all font-bold" 
                value={formData.price} 
                onChange={(e) => setFormData({...formData, price: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Category</label>
              <input 
                required
                placeholder="e.g. Mains, Sides" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white outline-none focus:border-orange-500 transition-all font-bold" 
                value={formData.category} 
                onChange={(e) => setFormData({...formData, category: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 ml-1">Asset Image</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="asset-image"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)} 
                />
                <label 
                  htmlFor="asset-image"
                  className="w-full bg-zinc-950 border border-dashed border-zinc-800 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-zinc-900 transition-all group-hover:border-orange-500/50"
                >
                  <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500">
                    <Upload size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">
                    {imageFile ? imageFile.name : 'Upload Local File'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Description</label>
            <textarea 
              placeholder="Describe the item perfectly..." 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white outline-none focus:border-orange-500 transition-all font-medium h-24 resize-none" 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div 
                onClick={() => setFormData({...formData, isVegetarian: !formData.isVegetarian})}
                className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${formData.isVegetarian ? 'bg-emerald-500 border-emerald-500' : 'bg-zinc-950 border-zinc-800'}`}
              >
                {formData.isVegetarian && <CheckCircle size={14} className="text-white" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">Vegetarian</span>
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-5 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmitting ? 'Processing Uplink...' : initialData ? 'Commit Update' : 'Commit New Asset'}
            </button>
            <button 
              type="button"
              onClick={onCancel} 
              className="px-10 py-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black uppercase tracking-widest rounded-2xl transition-all"
            >
              Abort
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

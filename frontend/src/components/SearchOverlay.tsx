"use client";
// Force redeploy to verify lint fixes on Render
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { restaurants } from '@/data/restaurants';

interface SearchRestaurant {
  _id: string;
  name: string;
  location: string;
  imageUrl?: string;
  rating: number;
}

interface SearchMenuItem {
  _id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  restaurantId?: {
    _id: string;
    name: string;
  };
}

interface SearchResult {
  restaurants: SearchRestaurant[];
  items: SearchMenuItem[];
}

export default function SearchOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ restaurants: [], items: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 1) {
      setLoading(true);
      
      const searchTerm = query.toLowerCase();
      
      // Local Search Logic
      const matchedRestaurants = restaurants.filter(res => 
        res.name.toLowerCase().includes(searchTerm) || 
        res.categories.some(cat => cat.toLowerCase().includes(searchTerm))
      ).map(res => ({
        _id: res.id,
        name: res.name,
        location: 'SRM University AP',
        imageUrl: res.imageUrl,
        rating: parseFloat(res.rating)
      }));

      const matchedItems = restaurants.flatMap(res => 
        res.menu.filter(item => 
          item.name.toLowerCase().includes(searchTerm) || 
          item.category.toLowerCase().includes(searchTerm)
        ).map(item => ({
          _id: item.id,
          name: item.name,
          price: item.price,
          description: item.description,
          imageUrl: item.image,
          restaurantId: {
            _id: res.id,
            name: res.name
          }
        }))
      );

      setResults({
        restaurants: matchedRestaurants,
        items: matchedItems
      });
      setLoading(false);
    } else {
      setResults({ restaurants: [], items: [] });
    }
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 flex flex-col">
      {/* Header */}
      <div className="p-6 pt-12 flex items-center gap-4">
        <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search food or restaurants..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-3 px-6 text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-yellow/50"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-primary-yellow border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Results Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {results.restaurants.length === 0 && results.items.length === 0 && query.length > 1 && !loading && (
          <div className="text-center py-20">
            <p className="text-secondary-text text-xl">No results found for &quot;{query}&quot; 😕</p>
          </div>
        )}

        {/* Restaurants Section */}
        {results.restaurants.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-4">Restaurants</h3>
            <div className="grid grid-cols-1 gap-4">
              {results.restaurants.map((res) => (
                <Link key={res._id} href={`/restaurants/${res._id}`} onClick={onClose} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/10 transition-all">
                  <div className="w-16 h-16 relative flex-shrink-0">
                    <Image
                      src={res.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200'}
                      alt={res.name}
                      fill
                      className="rounded-2xl object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">{res.name}</h4>
                    <p className="text-secondary-text text-xs uppercase tracking-wider">⭐ {res.rating} • {res.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items Section */}
        {results.items.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text mb-4">Dishes</h3>
            <div className="grid grid-cols-1 gap-4">
              {results.items.map((item) => (
                <Link key={item._id} href={`/products/${item._id}`} onClick={onClose} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4 hover:bg-white/10 transition-all">
                  <div className="w-16 h-16 relative flex-shrink-0">
                    <Image
                      src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'}
                      alt={item.name}
                      fill
                      className="rounded-2xl object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h4 className="font-bold text-white">{item.name}</h4>
                      <span className="text-primary-yellow font-black">₹{item.price}</span>
                    </div>
                    <p className="text-secondary-text text-xs overflow-hidden text-ellipsis line-clamp-1">{item.description}</p>
                    <p className="text-[10px] font-black uppercase text-secondary-text mt-1">From {item.restaurantId?.name || 'Unknown'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Default Suggestions / Trending (Optional) */}
        {query.length <= 1 && (
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-text">Popular Searches</h3>
            <div className="flex flex-wrap gap-2">
              {['Biryani', 'Burger', 'Pizza', 'Milkshake', 'Domino', 'Chinese'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white hover:bg-primary-yellow hover:text-black transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

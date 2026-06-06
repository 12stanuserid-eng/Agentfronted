'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '../layout';

const sampleProducts = [
  { id: '1', name: 'Premium Wireless Headphones', price: 299.99, category: 'Electronics', image: '[https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60)' },
  { id: '2', name: 'Minimalist Leather Watch', price: 149.00, category: 'Fashion', image: '[https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60)' },
  { id: '3', name: 'Ergonomic Office Chair', price: 349.50, category: 'Home', image: '[https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop&q=60)' },
  { id: '4', name: 'Hydrating Botanical Serum', price: 45.00, category: 'Beauty', image: '[https://images.unsplash.com/photo-1608248597481-496100c80836?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1608248597481-496100c80836?w=500&auto=format&fit=crop&q=60)' },
  { id: '5', name: 'Water-Resistant Backpack', price: 85.00, category: 'Fashion', image: '[https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60)' },
  { id: '6', name: 'Aluminium Road Bicycle', price: 899.00, category: 'Sports', image: '[https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop&q=60)' }
];

const categories = ['All', 'Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books'];

export default function ProductsPage() {
  const { addToCart } = useStore();
  const [products, setProducts] = useState(sampleProducts);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    let items = [...sampleProducts];
    if (selectedCategory !== 'All') {
      items = items.filter(i => i.category === selectedCategory);
    }
    if (search) {
      items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (sort === 'price-low') {
      items.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
      items.sort((a, b) => b.price - a.price);
    }
    setProducts(items);
  }, [selectedCategory, search, sort]);

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row gap-8'>
      <aside className='w-full md:w-64 shrink-0'>
        <h2 className='text-sm font-bold uppercase tracking-wider text-gray-900 mb-4'>Categories</h2>
        <ul className='space-y-2'>
          {categories.map((cat) => (
            <li key={cat}>
              <button 
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-4 py-2 text-sm rounded-xl transition ${selectedCategory === cat ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                {cat}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className='flex-1'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8'>
          <input 
            type='text' 
            placeholder='Filter items...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs bg-white'
          />
          <select 
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className='border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'>
            <option value='featured'>Sort: Featured</option>
            <option value='price-low'>Price: Low to High</option>
            <option value='price-high'>Price: High to Low</option>
          </select>
        </div>

        {products.length === 0 ? (
          <div className='text-center py-20 text-gray-500'>No products found mapping your criteria.</div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8'>
            {products.map((product) => (
              <div key={product.id} className='group border border-gray-100 rounded-3xl p-4 bg-white hover:shadow-xl transition duration-300 flex flex-col'>
                <div className='aspect-square w-full overflow-hidden rounded-2xl bg-gray-50 mb-4'>
                  <img src={product.image} alt={product.name} className='h-full w-full object-cover object-center group-hover:scale-105 transition duration-300' />
                </div>
                <span className='text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1'>{product.category}</span>
                <h3 className='text-sm font-bold text-gray-900 mb-2 truncate'>{product.name}</h3>
                <div className='flex items-center justify-between mt-auto pt-4'>
                  <span className='text-lg font-extrabold text-gray-900'>${product.price.toFixed(2)}</span>
                  <button 
                    onClick={() => addToCart(product)}
                    className='bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-medium hover:bg-indigo-700 transition shadow-md shadow-indigo-600/10'>
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
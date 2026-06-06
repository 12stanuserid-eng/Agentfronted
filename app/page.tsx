'use client';

import React, { useState } from 'react';
import { useStore } from './layout';

const sampleProducts = [
  { id: '1', name: 'Premium Wireless Headphones', price: 299.99, category: 'Electronics', image: '[https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60)' },
  { id: '2', name: 'Minimalist Leather Watch', price: 149.00, category: 'Fashion', image: '[https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60)' },
  { id: '3', name: 'Ergonomic Office Chair', price: 349.50, category: 'Home', image: '[https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop&q=60)' },
  { id: '4', name: 'Hydrating Botanical Serum', price: 45.00, category: 'Beauty', image: '[https://images.unsplash.com/photo-1608248597481-496100c80836?w=500&auto=format&fit=crop&q=60](https://images.unsplash.com/photo-1608248597481-496100c80836?w=500&auto=format&fit=crop&q=60)' }
];

const categories = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books'];

export default function HomePage() {
  const { addToCart } = useStore();
  const [search, setSearch] = useState('');

  return (
    <div className='bg-white min-h-screen'>
      <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center'>
        <h1 className='text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6'>
          Discover Next-Gen <span className='bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent'>MarketPlace</span>
        </h1>
        <p className='text-lg text-gray-500 max-w-2xl mx-auto mb-10'>
          Explore curated premium collections from top creators and local sellers worldwide with blazing fast delivery.
        </p>
        <div className='max-w-md mx-auto flex items-center border border-gray-200 rounded-full p-2 shadow-sm bg-white'>
          <input 
            type='text' 
            placeholder='Search categories, items, brands...' 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='w-full px-4 py-2 text-sm text-gray-700 bg-transparent focus:outline-none'
          />
          <a href={`/products?search=${search}`} className='bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition'>Search</a>
        </div>
      </section>

      <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-50'>
        <h2 className='text-2xl font-bold text-gray-900 mb-8'>Shop by Category</h2>
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
          {categories.map((cat) => (
            <a href={`/products?category=${cat}`} key={cat} className='border border-gray-100 rounded-2xl p-6 text-center hover:shadow-md transition bg-gray-50/50 block'>
              <span className='block font-medium text-gray-800'>{cat}</span>
            </a>
          ))}
        </div>
      </section>

      <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
        <h2 className='text-2xl font-bold text-gray-900 mb-8'>Featured Products</h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8'>
          {sampleProducts.map((product) => (
            <div key={product.id} className='group relative border border-gray-100 rounded-3xl p-4 bg-white hover:shadow-xl transition duration-300'>
              <div className='aspect-square w-full overflow-hidden rounded-2xl bg-gray-50 mb-4'>
                <img src={product.image} alt={product.name} className='h-full w-full object-cover object-center group-hover:scale-105 transition duration-300' />
              </div>
              <span className='text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1'>{product.category}</span>
              <h3 className='text-sm font-bold text-gray-900 mb-2 truncate'>{product.name}</h3>
              <div className='flex items-center justify-between mt-auto'>
                <span className='text-lg font-extrabold text-gray-900'>${product.price.toFixed(2)}</span>
                <button 
                  onClick={() => addToCart(product)}
                  className='bg-gray-900 text-white px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-indigo-600 transition'>
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
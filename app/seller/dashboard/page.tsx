'use client';

import React, { useState } from 'react';

const standardSellerProducts = [
  { id: '1', name: 'Premium Wireless Headphones', price: 299.99, category: 'Electronics', stock: 45 },
  { id: '2', name: 'Minimalist Leather Watch', price: 149.00, category: 'Fashion', stock: 12 }
];

export default function SellerDashboard() {
  const [products, setProducts] = useState(standardSellerProducts);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [stock, setStock] = useState('');

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const newProd = {
      id: String(products.length + 1),
      name,
      price: parseFloat(price),
      category,
      stock: parseInt(stock)
    };
    setProducts([...products, newProd]);
    setModalOpen(false);
    setName('');
    setPrice('');
    setStock('');
  };

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight text-gray-900'>Seller Studio</h1>
          <p className='text-sm text-gray-500 mt-1'>Manage your catalogs, operational telemetry and storefront inventories.</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className='bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/10'>
          Add New Product
        </button>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12'>
        <div className='border border-gray-100 bg-white p-6 rounded-2xl shadow-sm'>
          <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider block'>Gross Revenue</span>
          <div className='text-2xl font-extrabold text-gray-900 mt-2'>$14,285.50</div>
        </div>
        <div className='border border-gray-100 bg-white p-6 rounded-2xl shadow-sm'>
          <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider block'>Orders Processed</span>
          <div className='text-2xl font-extrabold text-gray-900 mt-2'>94 units</div>
        </div>
        <div className='border border-gray-100 bg-white p-6 rounded-2xl shadow-sm'>
          <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider block'>Active Catalog Items</span>
          <div className='text-2xl font-extrabold text-gray-900 mt-2'>{products.length} listed</div>
        </div>
        <div className='border border-gray-100 bg-white p-6 rounded-2xl shadow-sm'>
          <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider block'>Reputation Rating</span>
          <div className='text-2xl font-extrabold text-gray-900 mt-2'>4.9 / 5.0</div>
        </div>
      </div>

      <div className='border border-gray-100 rounded-3xl bg-white shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='bg-gray-50/70 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500'>
                <th className='p-4 pl-6'>Product Spec</th>
                <th className='p-4'>Category</th>
                <th className='p-4'>Price</th>
                <th className='p-4'>In-Stock</th>
                <th className='p-4 text-right pr-6'>Actions</th>
              </tr>
            </thead>
            <tbody className='text-sm divide-y divide-gray-100'>
              {products.map((p) => (
                <tr key={p.id} className='hover:bg-gray-50/30 transition'>
                  <td className='p-4 pl-6 font-bold text-gray-900'>{p.name}</td>
                  <td className='p-4 text-gray-500'>{p.category}</td>
                  <td className='p-4 font-semibold text-gray-900'>${p.price.toFixed(2)}</td>
                  <td className='p-4 text-gray-600'>{p.stock}</td>
                  <td className='p-4 text-right pr-6'>
                    <button onClick={() => handleDelete(p.id)} className='text-xs font-bold text-red-600 hover:underline'>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className='fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-3xl border border-gray-100 shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-150'>
            <h3 className='text-lg font-bold text-gray-900 mb-4'>Create Catalog Listing</h3>
            <form onSubmit={handleAddProduct} className='space-y-4'>
              <div>
                <label className='block text-xs font-semibold text-gray-600 uppercase mb-1'>Title</label>
                <input type='text' required value={name} onChange={(e) => setName(e.target.value)} className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white' />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-xs font-semibold text-gray-600 uppercase mb-1'>Price ($)</label>
                  <input type='number' step='0.01' required value={price} onChange={(e) => setPrice(e.target.value)} className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white' />
                </div>
                <div>
                  <label className='block text-xs font-semibold text-gray-600 uppercase mb-1'>Stock Units</label>
                  <input type='number' required value={stock} onChange={(e) => setStock(e.target.value)} className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white' />
                </div>
              </div>
              <div>
                <label className='block text-xs font-semibold text-gray-600 uppercase mb-1'>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white'>
                  <option value='Electronics'>Electronics</option>
                  <option value='Fashion'>Fashion</option>
                  <option value='Home'>Home</option>
                  <option value='Beauty'>Beauty</option>
                  <option value='Sports'>Sports</option>
                  <option value='Books'>Books</option>
                </select>
              </div>
              <div className='flex justify-end gap-3 pt-2'>
                <button type='button' onClick={() => setModalOpen(false)} className='px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-xl'>Cancel</button>
                <button type='submit' className='px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition'>Publish Listing</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
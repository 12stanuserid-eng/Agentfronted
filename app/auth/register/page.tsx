'use client';

import React, { useState } from 'react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('[https://ecommerce-marketplace-9570-api.onrender.com/api/auth/register](https://ecommerce-marketplace-9570-api.onrender.com/api/auth/register)', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      
      setSuccess('Account created successfully! Please sign in.');
      window.location.href = '/auth/login';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  return (
    <div className='min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50/50 px-4'>
      <div className='max-w-md w-full bg-white border border-gray-100 rounded-3xl p-8 shadow-xl shadow-gray-100/50'>
        <div className='text-center mb-8'>
          <h2 className='text-3xl font-bold text-gray-900 mb-2'>Get started</h2>
          <p className='text-sm text-gray-500'>Create your digital marketplace account</p>
        </div>
        {error && <div className='mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100'>{error}</div>}
        {success && <div className='mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100'>{success}</div>}
        <form onSubmit={handleSubmit} className='space-y-5'>
          <div>
            <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2'>Full Name</label>
            <input 
              type='text' 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
              placeholder='John Doe'
            />
          </div>
          <div>
            <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2'>Email Address</label>
            <input 
              type='email' 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
              placeholder='you@example.com'
            />
          </div>
          <div>
            <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2'>Password</label>
            <input 
              type='password' 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
              placeholder='••••••••'
            />
          </div>
          <div>
            <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2'>I want to</label>
            <div className='flex gap-4 mt-2'>
              <label className='flex-1 flex items-center justify-center border border-gray-200 rounded-xl p-3 text-sm font-medium cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50/30'>
                <input type='radio' name='role' value='buyer' checked={role === 'buyer'} onChange={() => setRole('buyer')} className='sr-only' />
                <span>Buy Products</span>
              </label>
              <label className='flex-1 flex items-center justify-center border border-gray-200 rounded-xl p-3 text-sm font-medium cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50/30'>
                <input type='radio' name='role' value='seller' checked={role === 'seller'} onChange={() => setRole('seller')} className='sr-only' />
                <span>Sell Products</span>
              </label>
            </div>
          </div>
          <button type='submit' className='w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/10'>
            Create Account
          </button>
        </form>
        <p className='text-center text-sm text-gray-500 mt-6'>
          Already have an account? <a href='/auth/login' className='text-indigo-600 font-semibold hover:underline'>Sign In</a>
        </p>
      </div>
    </div>
  );
}
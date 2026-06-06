'use client';

import React, { useState } from 'react';
import { useStore } from '../../layout';

export default function LoginPage() {
  const { setUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('[https://ecommerce-marketplace-9570-api.onrender.com/api/auth/login](https://ecommerce-marketplace-9570-api.onrender.com/api/auth/login)', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess('Logged in successfully!');
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  return (
    <div className='min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50/50 px-4'>
      <div className='max-w-md w-full bg-white border border-gray-100 rounded-3xl p-8 shadow-xl shadow-gray-100/50'>
        <div className='text-center mb-8'>
          <h2 className='text-3xl font-bold text-gray-900 mb-2'>Welcome back</h2>
          <p className='text-sm text-gray-500'>Sign in to your marketplace account</p>
        </div>
        {error && <div className='mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100'>{error}</div>}
        {success && <div className='mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100'>{success}</div>}
        <form onSubmit={handleSubmit} className='space-y-5'>
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
          <button type='submit' className='w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/10'>
            Sign In
          </button>
        </form>
        <p className='text-center text-sm text-gray-500 mt-6'>
          Don&#39;t have an account? <a href='/auth/register' className='text-indigo-600 font-semibold hover:underline'>Create account</a>
        </p>
      </div>
    </div>
  );
}
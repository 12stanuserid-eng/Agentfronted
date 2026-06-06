'use client';
import React, { useState } from 'react';
import { useAuth, useCart } from '../lib/store';
import { ShoppingCart, User, Search, LogOut, LayoutDashboard, ShoppingBag } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const [isOpen, setIsOpen] = useState(false); 

  return (
    <nav className='bg-white border-b border-gray-200 sticky top-0 z-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-16 items-center'>
          <div className='flex-shrink-0 flex items-center'>
            <span className='text-2xl font-bold text-indigo-600 cursor-pointer'>MarketPlace</span>
          </div>

          <div className='flex-1 max-w-md mx-8 hidden sm:block'>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <Search className='h-5 w-5 text-gray-400' />
              </div>
              <input
                type='text'
                placeholder='Search products...'
                className='block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
              />
            </div>
          </div>

          <div className='flex items-center space-x-6'>
            <div className='relative cursor-pointer py-2'>
              <ShoppingCart className='h-6 w-6 text-gray-600 hover:text-indigo-600 transition-colors' />
              {cartCount > 0 && (
                <span className='absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full'>
                  {cartCount}
                </span>
              )}
            </div>

            <div className='relative'>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className='flex items-center space-x-1 text-gray-600 hover:text-indigo-600 focus:outline-none py-2'
              >
                <User className='h-6 w-6' />
              </button>

              {isOpen && (
                <div className='origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-50'>
                  {user ? (
                    <>
                      <div className='px-4 py-3'>
                        <p className='text-sm text-gray-500'>Signed in as</p>
                        <p className='text-sm font-medium text-gray-900 truncate'>{user.email}</p>
                      </div>
                      <div className='py-1'>
                        <a href='/dashboard' className='flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'>
                          <LayoutDashboard className='mr-3 h-4 w-4 text-gray-400' /> Dashboard
                        </a>
                        <a href='/orders' className='flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'>
                          <ShoppingBag className='mr-3 h-4 w-4 text-gray-400' /> Orders
                        </a>
                      </div>
                      <div className='py-1'>
                        <button
                          onClick={() => { logout(); setIsOpen(false); }}
                          className='flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-gray-100'
                        >
                          <LogOut className='mr-3 h-4 w-4 text-red-400' /> Sign out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className='py-1'>
                      <a href='/login' className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'>Sign in</a>
                      <a href='/register' className='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'>Register</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
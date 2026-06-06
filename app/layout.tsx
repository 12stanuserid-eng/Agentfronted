'use client';

import './globals.css';
import React, { createContext, useContext, useState, useEffect } from 'react';

const StoreContext = createContext<any>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const storedCart = localStorage.getItem('cart');
    const storedUser = localStorage.getItem('user');
    if (storedCart) setCart(JSON.parse(storedCart));
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const addToCart = (product: any) => {
    const newCart = [...cart];
    const existing = newCart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      newCart.push({ ...product, quantity: 1 });
    }
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const updateCartQty = (id: string, qty: number) => {
    const newCart = cart.map(item => item.id === id ? { ...item, quantity: qty } : item).filter(item => item.quantity > 0);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  return (
    <StoreContext.Provider value={{ cart, addToCart, updateCartQty, clearCart, user, setUser, orders, setOrders }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body className='bg-white text-gray-900 antialiased'>
        <StoreProvider>
          <header className='border-b border-gray-100 bg-white sticky top-0 z-50'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
              <a href='/' className='text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent'>MarketPlace</a>
              <nav className='flex items-center space-x-6 text-sm font-medium text-gray-600'>
                <a href='/products' className='hover:text-indigo-600'>Browse</a>
                <a href='/cart' className='hover:text-indigo-600 relative'>Cart</a>
                <a href='/orders' className='hover:text-indigo-600'>Orders</a>
                <a href='/seller/dashboard' className='hover:text-indigo-600'>Seller Panel</a>
                <a href='/auth/login' className='bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition'>Account</a>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
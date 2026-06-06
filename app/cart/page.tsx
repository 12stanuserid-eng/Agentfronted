'use client';

import React from 'react';
import { useStore } from '../layout';

export default function CartPage() {
  const { cart, updateCartQty, clearCart, setOrders } = useStore();

  const subtotal = cart.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? 15.00 : 0;
  const total = subtotal + shipping;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const orderId = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);
    const newOrder = {
      id: orderId,
      date: new Date().toLocaleDateString(),
      items: [...cart],
      total: total,
      status: 'Processing'
    };
    
    const storedOrders = localStorage.getItem('orders');
    const currentOrders = storedOrders ? JSON.parse(storedOrders) : [];
    const updatedOrders = [newOrder, ...currentOrders];
    
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    setOrders(updatedOrders);
    clearCart();
    window.location.href = '/orders';
  };

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
      <h1 className='text-3xl font-bold tracking-tight text-gray-900 mb-8'>Shopping Cart</h1>
      
      {cart.length === 0 ? (
        <div className='text-center py-20 border border-dashed border-gray-200 rounded-3xl bg-gray-50/50'>
          <p className='text-gray-500 mb-4'>Your cart is currently empty.</p>
          <a href='/products' className='bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-indigo-700 transition'>Continue Shopping</a>
        </div>
      ) : (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 items-start'>
          <div className='lg:col-span-2 border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm'>
            <ul className='divide-y divide-gray-100'>
              {cart.map((item: any) => (
                <li key={item.id} className='flex p-6 gap-6 items-center'>
                  <img src={item.image} alt={item.name} className='w-20 h-20 object-cover rounded-xl bg-gray-50 shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <h4 className='text-sm font-bold text-gray-900 truncate'>{item.name}</h4>
                    <p className='text-xs text-gray-500 mt-0.5'>{item.category}</p>
                    <div className='text-sm font-extrabold text-gray-900 mt-2'>${item.price.toFixed(2)}</div>
                  </div>
                  <div className='flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden shrink-0'>
                    <button onClick={() => updateCartQty(item.id, item.quantity - 1)} className='px-3 py-1 hover:bg-gray-50 font-bold'>-</button>
                    <span className='px-3 text-sm font-semibold text-gray-700'>{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.id, item.quantity + 1)} className='px-3 py-1 hover:bg-gray-50 font-bold'>+</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className='border border-gray-100 rounded-3xl p-6 bg-white shadow-sm'>
            <h3 className='text-sm font-bold uppercase tracking-wider text-gray-900 mb-6'>Order Summary</h3>
            <div className='space-y-4 text-sm'>
              <div className='flex justify-between text-gray-600'>
                <span>Subtotal</span>
                <span className='font-semibold text-gray-900'>${subtotal.toFixed(2)}</span>
              </div>
              <div className='flex justify-between text-gray-600'>
                <span>Standard Shipping</span>
                <span className='font-semibold text-gray-900'>${shipping.toFixed(2)}</span>
              </div>
              <div className='border-t border-gray-100 pt-4 flex justify-between text-base font-bold text-gray-900'>
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
            <button 
              onClick={handleCheckout}
              className='w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold mt-6 hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/10'>
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) setOrders(JSON.parse(storedOrders));
  }, []);

  return (
    <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
      <h1 className='text-3xl font-bold tracking-tight text-gray-900 mb-8'>Your Orders</h1>

      {orders.length === 0 ? (
        <div className='text-center py-20 border border-dashed border-gray-200 rounded-3xl bg-gray-50/50'>
          <p className='text-gray-500 mb-4'>No historical logs or orders detected.</p>
          <a href='/products' className='bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-indigo-700 transition'>Explore Products</a>
        </div>
      ) : (
        <div className='space-y-4'>
          {orders.map((order) => (
            <div key={order.id} className='border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm'>
              <div 
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className='flex flex-wrap items-center justify-between p-6 gap-4 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition'>
                <div>
                  <span className='text-xs font-bold text-indigo-600'>{order.id}</span>
                  <div className='text-xs text-gray-500 mt-0.5'>Placed on {order.date}</div>
                </div>
                <div className='flex items-center gap-4'>
                  <span className='text-sm font-extrabold text-gray-900'>${order.total.toFixed(2)}</span>
                  <span className='px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100'>
                    {order.status}
                  </span>
                </div>
              </div>
              
              {expandedOrder === order.id && (
                <div className='border-t border-gray-100 p-6 bg-white'>
                  <ul className='divide-y divide-gray-100'>
                    {order.items.map((item: any) => (
                      <div key={item.id} className='flex items-center justify-between py-3 text-sm'>
                        <div className='flex items-center gap-4'>
                          <img src={item.image} alt={item.name} className='w-12 h-12 object-cover rounded-lg bg-gray-50' />
                          <div>
                            <div className='font-bold text-gray-900'>{item.name}</div>
                            <div className='text-xs text-gray-500'>Qty: {item.quantity}</div>
                          </div>
                        </div>
                        <span className='font-semibold text-gray-900'>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'use client';
import React from 'react';
import { Star, ShoppingCart } from 'lucide-react';
import { useCart } from '../lib/store';
import { addToCart } from '../lib/api';
import { toast } from 'react-hot-toast';

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    price: number;
    sellerName: string;
    rating?: number;
    imageUrl?: string;
  };
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { cartCount, updateCartCount } = useCart();

  const handleAddToCart = async () => {
    try {
      await addToCart({ productId: product.id, quantity: 1 });
      updateCartCount(cartCount + 1);
      toast.success('Added to cart successfully!');
    } catch (error) {
      toast.error('Failed to add product to cart.');
    }
  };

  return (
    <div className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300'>
      <div className='relative bg-gray-100 pt-[100%]'>
        <img
          src={product.imageUrl || '[https://via.placeholder.com/300](https://via.placeholder.com/300)'}
          alt={product.title}
          className='absolute inset-0 w-full h-full object-cover'
        />
      </div>
      <div className='p-4'>
        <p className='text-xs text-gray-400 font-medium uppercase tracking-wider'>{product.sellerName}</p>
        <h3 className='mt-1 text-sm font-semibold text-gray-900 line-clamp-2 h-10'>{product.title}</h3>
        
        <div className='mt-2 flex items-center'>
          <div className='flex items-center text-amber-400'>
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 fill-current ${i < (product.rating || 5) ? 'text-amber-400' : 'text-gray-200'}`}
              />
            ))}
          </div>
          <span className='ml-2 text-xs font-medium text-gray-500'>({product.rating || 5}.0)</span>
        </div>

        <div className='mt-4 flex items-center justify-between'>
          <span className='text-lg font-bold text-gray-900'>${product.price.toFixed(2)}</span>
          <button
            onClick={handleAddToCart}
            className='inline-flex items-center justify-center p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200'
            aria-label='Add to cart'
          >
            <ShoppingCart className='h-4 w-4 mr-1' />
            <span className='text-xs font-medium px-1'>Add to Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
};
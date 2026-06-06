import axios from 'axios';

const API_BASE_URL = '[https://ecommerce-marketplace-9570-api.onrender.com](https://ecommerce-marketplace-9570-api.onrender.com)';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const login = async (data: any) => {
  const res = await api.post('/auth/login', data);
  return res.data;
};

export const register = async (data: any) => {
  const res = await api.post('/auth/register', data);
  return res.data;
};

export const getProducts = async (params?: any) => {
  const res = await api.get('/products', { params });
  return res.data;
};

export const getProduct = async (id: string) => {
  const res = await api.get(`/products/${id}`);
  return res.data;
};

export const addToCart = async (data: { productId: string; quantity: number }) => {
  const res = await api.post('/cart', data);
  return res.data;
};

export const getCart = async () => {
  const res = await api.get('/cart');
  return res.data;
};

export const placeOrder = async (data: any) => {
  const res = await api.post('/orders', data);
  return res.data;
};

export const getOrders = async () => {
  const res = await api.get('/orders');
  return res.data;
};

export const getSellerStats = async () => {
  const res = await api.get('/seller/stats');
  return res.data;
};
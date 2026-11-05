import type { CategoryFilter, Product, Store, StoreId } from './types';

export type Palette = {
  background: string; surface: string; text: string; muted: string; primary: string;
  primaryText: string; soft: string; tint: string; heroAccent: string; border: string;
  strong: string; glass: string; gold: string; terracotta: string; onPrimary: string; gradient: [string, string, string, string, string, string, string];
};

const palettes: { light: Palette; dark: Palette } = {
  dark: {
    background: '#211F2A', surface: '#2D2938', text: '#F9F4FF', muted: '#C2BBD0',
    primary: '#7042B8', primaryText: '#D4BEFF', soft: '#3B314F', tint: '#47395C',
    heroAccent: 'rgba(208,183,255,0.20)', border: '#68517F', strong: '#3B2A52',
    glass: '#2D2938', gold: '#CCAFF2', terracotta: '#FFADAB', onPrimary: '#FFFFFF', gradient: ['#EEE4FF', '#E5D4FA', '#DBC3F5', '#D3B7F0', '#C9A9EB', '#C29CE7', '#B990DF'],
  },
  light: {
    background: '#FAF8FF', surface: '#FFFFFF', text: '#30243F', muted: '#756980',
    primary: '#7042B8', primaryText: '#603396', soft: '#F0E9FA', tint: '#E8D9F8',
    heroAccent: 'rgba(208,183,255,0.20)', border: '#D8C6ED', strong: '#42305A',
    glass: 'rgba(253,250,255,0.97)', gold: '#7A479F', terracotta: '#B74658', onPrimary: '#FFFFFF', gradient: ['#EEE4FF', '#E5D4FA', '#DBC3F5', '#D3B7F0', '#C9A9EB', '#C29CE7', '#B990DF'],
  },
};

const categories: CategoryFilter[] = ['Electronics', 'Textiles', 'Home Appliances', 'Computer Items'];
const sortOptions = ['Featured', 'Price: low to high', 'Price: high to low'];
const stores: Store[] = [
  { id: 'all', name: 'All local shops', area: 'Browse all participating stores', icon: '⌂' },
  { id: 'catalogue', name: 'NearBy catalogue', area: 'Shop and delivery area not supplied by the server', icon: '▦' },
  { id: 'vv', name: 'VV Electricals', area: 'Thodupuzha · Electronics', icon: '✳', category: 'Electronics', location: 'Thodupuzha, Idukki' },
  { id: 'sr', name: 'SR Electrics', area: 'Muttom · Electronics', icon: 'ϟ', category: 'Electronics', location: 'Muttom, Idukki' },
  { id: 'textiles', name: 'Thodupuzha Textiles', area: 'Thodupuzha · Textiles & clothing', icon: '▤', category: 'Textiles', location: 'Thodupuzha, Idukki' },
];

const starterProducts: Product[] = [
  { id: 'vv-laptop', name: 'Everyday Laptop · 14 inch', category: 'Computer Items', price: 38999, emoji: '▣', color: '#FFF0CF', rating: '4.6', tag: 'DEMO ITEM', store: 'vv', description: 'Demo listing: 14-inch laptop with 8 GB RAM and 512 GB SSD for work and study.' },
  { id: 'vv-keyboard', name: 'Wireless Keyboard', category: 'Computer Items', price: 1299, emoji: '▤', color: '#FFF0CF', rating: '4.5', tag: 'DEMO ITEM', store: 'vv', description: 'Demo listing: compact wireless keyboard for compatible computers.' },
  { id: 'vv-mouse', name: 'Wireless Mouse', category: 'Computer Items', price: 599, emoji: '◉', color: '#FFF0CF', rating: '4.5', tag: 'DEMO ITEM', store: 'vv', description: 'Demo listing: comfortable wireless mouse with USB receiver.' },
  { id: 'sr-monitor', name: 'Full HD Monitor · 24 inch', category: 'Computer Items', price: 8999, emoji: '▣', color: '#FFEBCB', rating: '4.6', tag: 'DEMO ITEM', store: 'sr', description: 'Demo listing: 24-inch Full HD monitor with HDMI connectivity.' },
  { id: 'sr-keyboard', name: 'USB Keyboard', category: 'Computer Items', price: 799, emoji: '▤', color: '#FFEBCB', rating: '4.4', tag: 'DEMO ITEM', store: 'sr', description: 'Demo listing: full-size wired USB keyboard.' },
  { id: 'sr-mouse', name: 'USB Optical Mouse', category: 'Computer Items', price: 349, emoji: '◉', color: '#FFEBCB', rating: '4.4', tag: 'DEMO ITEM', store: 'sr', description: 'Demo listing: wired optical mouse for everyday computer use.' },
  { id: 'vv-switch', name: 'Modular Switch Board', category: 'Electronics', price: 549, emoji: '▦', color: '#FFF0CF', rating: '4.8', tag: 'LOCAL PICK', store: 'vv', description: '6A four-module white switch board for everyday home use.' },
  { id: 'vv-bulb', name: 'LED Bulb · 9W', stock: 0, category: 'Electronics', price: 129, emoji: '◉', color: '#FFF0CF', rating: '4.7', tag: 'ENERGY SAVE', store: 'vv', description: 'Warm white energy-saving LED bulb.' },
  { id: 'vv-powerstrip', name: 'Power Strip', category: 'Electronics', price: 449, emoji: '▤', color: '#FFF0CF', rating: '4.6', tag: 'HOME ESSENTIAL', store: 'vv', description: 'Four sockets with surge protection.' },
  { id: 'vv-fan', name: 'Ceiling Fan', category: 'Home Appliances', price: 2499, emoji: '✳', color: '#FFF0CF', rating: '4.8', tag: '5 STAR', store: 'vv', description: '1200 mm five-star ceiling fan.' },
  { id: 'vv-speaker', name: 'Bluetooth Speaker', category: 'Electronics', price: 1299, emoji: '◖', color: '#FFF0CF', rating: '4.5', tag: 'PORTABLE', store: 'vv', description: 'Portable speaker with twelve hours of playtime.' },
  { id: 'vv-light', name: 'Emergency Light', category: 'Home Appliances', price: 899, emoji: '◉', color: '#FFF0CF', rating: '4.6', tag: 'RECHARGEABLE', store: 'vv', description: 'Rechargeable light with eight-hour backup.' },
  { id: 'vv-earbuds', name: 'Wireless Earbuds', category: 'Electronics', price: 1499, emoji: '◖', color: '#FFF0CF', rating: '4.7', tag: 'BESTSELLER', store: 'vv', description: 'Bluetooth earbuds with charging case.' },
  { id: 'sr-switch', name: 'Modular Switch Board', category: 'Electronics', price: 499, emoji: '▦', color: '#FFEBCB', rating: '4.7', tag: 'VALUE PICK', store: 'sr', description: '6A four-module white switch board at a local price.' },
  { id: 'sr-charger', name: 'USB-C Fast Charger', category: 'Electronics', price: 699, emoji: 'ϟ', color: '#FFEBCB', rating: '4.6', tag: 'FAST CHARGE', store: 'sr', description: '20W charger with cable included.' },
  { id: 'sr-clock', name: 'Digital Wall Clock', category: 'Electronics', price: 799, emoji: '◷', color: '#FFEBCB', rating: '4.5', tag: 'LED DISPLAY', store: 'sr', description: 'LED wall clock with alarm feature.' },
  { id: 'sr-watch', name: 'Smart Watch', stock: 0, category: 'Electronics', price: 2299, emoji: '◷', color: '#FFEBCB', rating: '4.6', tag: 'FITNESS', store: 'sr', description: 'Fitness and sleep tracking smartwatch.' },
  { id: 'sr-stabilizer', name: 'Voltage Stabilizer', category: 'Electronics', price: 1899, emoji: 'ϟ', color: '#FFEBCB', rating: '4.7', tag: 'HOME SAFETY', store: 'sr', description: 'Television voltage stabilizer with four-amp capacity.' },
  { id: 'sr-extension', name: 'Extension Cord', category: 'Electronics', price: 349, emoji: '▤', color: '#FFEBCB', rating: '4.5', tag: '3 METRE', store: 'sr', description: 'Three-metre extension cord with three sockets.' },
  { id: 'sr-kettle', name: 'Electric Kettle', category: 'Home Appliances', price: 1199, emoji: '◒', color: '#FFEBCB', rating: '4.6', tag: 'QUICK BOIL', store: 'sr', description: '1.5 litre stainless steel electric kettle.' },
  { id: 'textile-kasavu', name: 'Cotton Kasavu Settu', category: 'Textiles', price: 1899, emoji: '▱', color: '#FFF3D9', rating: '4.9', tag: 'KERALA WEAR', store: 'textiles', description: 'Traditional Kerala cotton settu with kasavu border.' },
  { id: 'textile-bedsheet', name: 'Cotton Bedsheet', category: 'Textiles', price: 899, emoji: '▰', color: '#FFF3D9', rating: '4.7', tag: 'QUEEN SIZE', store: 'textiles', description: 'Cotton queen bedsheet with two pillow covers.' },
  { id: 'textile-saree', name: 'Handloom Cotton Saree', stock: 0, category: 'Textiles', price: 2499, emoji: '▱', color: '#FFF3D9', rating: '4.8', tag: 'HANDLOOM', store: 'textiles', description: 'Lightweight Kerala cotton handloom saree.' },
  { id: 'textile-bag', name: 'School Backpack', category: 'Textiles', price: 1199, emoji: '▣', color: '#FFF3D9', rating: '4.6', tag: '24 LITRE', store: 'textiles', description: 'Water-resistant twenty-four litre school backpack.' },
  { id: 'textile-nightwear', name: 'Kids Cotton Nightwear', category: 'Textiles', price: 599, emoji: '☾', color: '#FFF3D9', rating: '4.7', tag: 'SOFT COTTON', store: 'textiles', description: 'Soft cotton nightwear in sizes two to ten.' },
  { id: 'textile-towel', name: 'Bath Towel Set', category: 'Textiles', price: 699, emoji: '▰', color: '#FFF3D9', rating: '4.5', tag: 'SET OF 2', store: 'textiles', description: 'Cotton bath towel set of two.' },
];

const money = (amount: number): string => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const getStore = (id: StoreId): Store => stores.find((store) => store.id === id) ?? stores[1];

export { palettes, categories, sortOptions, stores, starterProducts, money, getStore };

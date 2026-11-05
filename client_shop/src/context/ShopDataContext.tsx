import { createContext, useContext, useMemo, useState } from 'react';
import type { Dispatch, PropsWithChildren, SetStateAction } from 'react';

export type Product = {
  id: string; name: string; category: string; sku: string; price: number;
  stock: number; reorderLevel: number; location: string;
};
export type OrderStatus = 'New' | 'Preparing' | 'Ready' | 'Completed';
export type Order = { id: string; customer: string; items: number; total: number; status: OrderStatus; time: string };
export type DeliveryStatus = 'Preparing' | 'Ready for pickup' | 'Picked up' | 'In transit' | 'Out for delivery' | 'Delivered';
export type Delivery = { id: string; orderId: string; customer: string; address: string; items: number; total: number; status: DeliveryStatus; driver: string; window: string };
export type TeamMember = { id: string; name: string; email: string; role: string; initials: string };
export type NewProduct = Pick<Product, 'name' | 'category' | 'price' | 'stock'>;
export type ProductUpdate = Partial<Omit<Product, 'id'>>;
export type NewTeamMember = Pick<TeamMember, 'name' | 'email' | 'role'>;

type ShopContextValue = {
  products: Product[]; orders: Order[]; deliveries: Delivery[]; team: TeamMember[];
  isOpen: boolean; setIsOpen: Dispatch<SetStateAction<boolean>>;
  addProduct: (product: NewProduct) => void;
  changeStock: (id: string, amount: number) => void;
  updateProduct: (id: string, details: ProductUpdate) => void;
  deleteProduct: (id: string) => void;
  advanceOrder: (id: string) => void;
  advanceDelivery: (id: string) => void;
  addMember: (member: NewTeamMember) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);
const initialProducts: Product[] = [
  { id: 'p1', name: 'Wireless Headphones', category: 'Electronics', sku: 'AUD-014', price: 2499, stock: 12, reorderLevel: 5, location: 'Audio shelf A1' },
  { id: 'p2', name: 'Mechanical Keyboard', category: 'Computer Items', sku: 'CMP-022', price: 3499, stock: 4, reorderLevel: 6, location: 'Computer shelf B2' },
  { id: 'p3', name: 'USB-C Hub 8-in-1', category: 'Computer Items', sku: 'ACC-008', price: 1799, stock: 2, reorderLevel: 5, location: 'Accessories shelf C1' },
  { id: 'p4', name: 'Portable SSD 1TB', category: 'Computer Items', sku: 'STR-031', price: 6999, stock: 18, reorderLevel: 5, location: 'Storage shelf A3' },
  { id: 'p5', name: 'Wireless Mouse', category: 'Computer Items', sku: 'CMP-006', price: 899, stock: 7, reorderLevel: 5, location: 'Computer shelf B2' },
  { id: 'p6', name: 'Webcam 4K', category: 'Electronics', sku: 'ACC-019', price: 4999, stock: 0, reorderLevel: 4, location: 'Accessories shelf C2' },
];
const initialOrders: Order[] = [
  { id: 'TDP-1048', customer: 'Anu Mathew', items: 2, total: 3298, status: 'New', time: '9:42 AM' },
  { id: 'TDP-1047', customer: 'Rahul Thomas', items: 1, total: 3499, status: 'Preparing', time: '9:18 AM' },
  { id: 'TDP-1046', customer: 'Meera Joseph', items: 3, total: 5797, status: 'Ready', time: '8:56 AM' },
  { id: 'TDP-1045', customer: 'Nikhil S', items: 1, total: 899, status: 'Completed', time: '8:32 AM' },
];
const initialDeliveries: Delivery[] = [
  { id: 'DL-7781', orderId: 'TDP-1046', customer: 'Meera Joseph', address: 'Rose Villa, near St. Mary’s Church, Muttom', items: 3, total: 5797, status: 'Out for delivery', driver: 'Arun R.', window: 'Today · 2:00–4:00 PM' },
  { id: 'DL-7780', orderId: 'TDP-1045', customer: 'Nikhil S', address: 'Market Road, Thodupuzha', items: 1, total: 899, status: 'Delivered', driver: 'Jomon P.', window: 'Delivered today · 10:14 AM' },
  { id: 'DL-7779', orderId: 'TDP-1043', customer: 'Akhil Thomas', address: 'Green Park Apartments, Thodupuzha', items: 2, total: 3298, status: 'In transit', driver: 'Anoop M.', window: 'Today · 3:00–5:00 PM' },
  { id: 'DL-7778', orderId: 'TDP-1042', customer: 'Diya Paul', address: 'College Road, Thodupuzha', items: 1, total: 2499, status: 'Preparing', driver: 'Assigning driver', window: 'Today · 4:00–6:00 PM' },
];
const initialTeam: TeamMember[] = [
  { id: 't1', name: 'Vijay Varghese', email: 'owner@tdpstore.example', role: 'Owner', initials: 'VV' },
  { id: 't2', name: 'Anjali Mathew', email: 'manager@tdpstore.example', role: 'Store manager', initials: 'AM' },
  { id: 't3', name: 'Arun Raj', email: 'staff@tdpstore.example', role: 'Order staff', initials: 'AR' },
];

export function ShopDataProvider({ children }: PropsWithChildren) {
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [team, setTeam] = useState(initialTeam);
  const [isOpen, setIsOpen] = useState(true);
  const addProduct = (product: NewProduct) => setProducts((all) => [{ ...product, id: `p${Date.now()}`, sku: `NEW-${Date.now().toString().slice(-6)}`, reorderLevel: 5, location: 'Main shelf' }, ...all]);
  const changeStock = (id: string, amount: number) => setProducts((all) => all.map((product) => product.id === id ? { ...product, stock: Math.max(0, product.stock + amount) } : product));
  const updateProduct = (id: string, details: ProductUpdate) => setProducts((all) => all.map((product) => product.id === id ? { ...product, ...details } : product));
  const deleteProduct = (id: string) => setProducts((all) => all.filter((product) => product.id !== id));
  const advanceOrder = (id: string) => {
    const next: Partial<Record<OrderStatus, OrderStatus>> = { New: 'Preparing', Preparing: 'Ready', Ready: 'Completed' };
    setOrders((all) => all.map((order) => order.id === id && next[order.status] ? { ...order, status: next[order.status]! } : order));
  };
  const advanceDelivery = (id: string) => {
    const next: Partial<Record<DeliveryStatus, DeliveryStatus>> = { Preparing: 'Ready for pickup', 'Ready for pickup': 'Picked up', 'Picked up': 'In transit', 'In transit': 'Out for delivery', 'Out for delivery': 'Delivered' };
    setDeliveries((all) => all.map((delivery) => delivery.id === id && next[delivery.status] ? { ...delivery, status: next[delivery.status]! } : delivery));
  };
  const addMember = (member: NewTeamMember) => setTeam((all) => [...all, { ...member, id: `t${Date.now()}`, initials: member.name.split(' ').map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() }]);
  const value = useMemo<ShopContextValue>(() => ({ products, orders, deliveries, team, isOpen, setIsOpen, addProduct, changeStock, updateProduct, deleteProduct, advanceOrder, advanceDelivery, addMember }), [products, orders, deliveries, team, isOpen]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be inside ShopDataProvider');
  return value;
}

import { createContext, useContext, useState, type PropsWithChildren } from 'react';

type Account = { id: string; shopName: string; email: string };
// Frontend preview only: represents an account provided by the admin.
const demoAccount: Account = { id: 'demo-vv', shopName: 'VV Electricals', email: 'owner@tdp.demo' };
const Context = createContext<{ account: Account | null; login: (email: string, password: string) => Promise<void>; logout: () => void } | null>(null);

export function ShopAuthProvider({ children }: PropsWithChildren) {
  const [account, setAccount] = useState<Account | null>(null);
  async function login(email: string, password: string) {
    if (email.trim().toLowerCase() !== demoAccount.email || password !== 'TdpDemo123!') {
      throw new Error('Use the demo account below. Shop access is provided by the admin.');
    }
    setAccount(demoAccount);
  }
  return <Context.Provider value={{ account, login, logout: () => setAccount(null) }}>{children}</Context.Provider>;
}

export function useShopAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('ShopAuthProvider is required');
  return value;
}

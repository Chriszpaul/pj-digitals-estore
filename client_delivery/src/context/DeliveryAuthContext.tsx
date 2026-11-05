import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const rememberedEmailKey = 'tdp.delivery.remembered-email';

type Partner = { name: string; email: string };
const Context = createContext<{ partner: Partner | null; login: (email: string, password: string, remember: boolean) => Promise<void>; logout: () => void } | null>(null);
export function DeliveryAuthProvider({ children }: PropsWithChildren) {
  const [partner, setPartner] = useState<Partner | null>(null);
  async function login(email: string, password: string, remember: boolean) {
    // Frontend preview of an admin-provided account. No authentication service.
    if (email.trim().toLowerCase() !== 'delivery@tdp.demo' || password !== 'TdpDemo123!') throw new Error('Use the demo account below. Delivery access is provided by the admin.');
    try {
      if (remember) await AsyncStorage.setItem(rememberedEmailKey, email.trim().toLowerCase());
      else await AsyncStorage.removeItem(rememberedEmailKey);
    } catch {
      if (remember) throw new Error('Could not remember your email. Turn off Remember email to continue.');
    }
    setPartner({ name: 'Arun Raj', email: 'delivery@tdp.demo' });
  }
  return <Context.Provider value={{ partner, login, logout: () => setPartner(null) }}>{children}</Context.Provider>;
}
export function useDeliveryAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('DeliveryAuthProvider is required');
  return value;
}

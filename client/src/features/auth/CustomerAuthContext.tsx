import { createContext, useCallback, useContext, type PropsWithChildren } from 'react';
import { useAuth, useClerk, useUser } from './clerkHooks';

type Customer = { id: string; name: string; email: string };
type Auth = { customer: Customer | null; ready: boolean; getToken: () => Promise<string | null>; signOut: () => Promise<void> };
const Context = createContext<Auth | null>(null);

export function CustomerAuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, getToken: clerkGetToken, userId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const getToken = useCallback(() => clerkGetToken(), [clerkGetToken]);
  const signOut = useCallback(async () => { await clerk.signOut(); }, [clerk]);
  const customer = isSignedIn && userId ? {
    id: userId, name: user?.fullName || user?.firstName || 'Customer',
    email: user?.primaryEmailAddress?.emailAddress || '',
  } : null;
  return <Context.Provider value={{ customer, ready: !!isLoaded, getToken, signOut }}>{children}</Context.Provider>;
}
export function useCustomerAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('CustomerAuthProvider is required');
  return value;
}

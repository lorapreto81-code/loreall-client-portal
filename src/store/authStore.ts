import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Customer {
  id: number;
  name: string;
  usuario: string;
  password: string;
  email?: string;
  data_de_vencimento: string;
  telas: number | string;
  status?: string;
  plan?: { id: number; name: string; value: number | string };
  product?: { id: number; name: string };
  [key: string]: unknown;
}

interface AuthState {
  customer: Customer | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (customer: Customer, token?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null,
      token: null,
      isAuthenticated: false,
      login: (customer, token) =>
        set((state) => ({
          customer,
          token: token ?? state.token,
          isAuthenticated: true,
        })),
      logout: () => set({ customer: null, token: null, isAuthenticated: false }),
    }),
    { name: "loreall-auth" }
  )
);

/** Session token issued by the customer-auth edge function. */
export const getCustomerToken = (): string | null => useAuthStore.getState().token;

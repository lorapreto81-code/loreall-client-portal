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
  isAuthenticated: boolean;
  login: (customer: Customer) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null,
      isAuthenticated: false,
      login: (customer) => set({ customer, isAuthenticated: true }),
      logout: () => set({ customer: null, isAuthenticated: false }),
    }),
    { name: "loreall-auth" }
  )
);

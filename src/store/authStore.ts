import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Customer {
  id: number;
  name: string;
  usuario: string;
  // password field removed to avoid persistence in localStorage
  email?: string;
  data_de_vencimento: string;
  telas: number | string;
  status?: string;
  whatsapp?: string;
  cpf?: string;
  iptv_provider?: string;
  data_vencimento_app?: string;
  pontos?: number;
  plan?: { id: number; name: string; value: number | string };
  product?: { id: number; name: string };
  meta?: { pontos?: number };
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
      login: (customer, token) => {
        // Remove password if present before storing in state/localStorage
        const { password, ...safeCustomer } = customer as any;
        set((state) => ({
          customer: safeCustomer as Customer,
          token: token ?? state.token,
          isAuthenticated: true,
        }));
      },
      logout: () => set({ customer: null, token: null, isAuthenticated: false }),
    }),
    { 
      name: "loreall-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.customer && (state.customer as any).password) {
          console.log("Cleaning legacy password from local storage session...");
          const { password, ...safeCustomer } = state.customer as any;
          state.customer = safeCustomer;
        }
      }
    }
  )
);

/** Session token issued by the customer-auth edge function. */
export const getCustomerToken = (): string | null => useAuthStore.getState().token;

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
  /** "checkout" = renewal-only session opened from a personal renewal link. */
  scope: "full" | "checkout";
  /** Full session saved while a renewal-link session is active, restored afterwards. */
  previousFull: { customer: Customer; token: string | null } | null;
  login: (customer: Customer, token?: string, scope?: "full" | "checkout") => void;
  logout: () => void;
  /** Leaves a checkout session, restoring the prior full session if any. Returns true if restored. */
  exitCheckout: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      customer: null,
      token: null,
      isAuthenticated: false,
      scope: "full",
      previousFull: null,
      login: (customer, token, scope = "full") => {
        // Remove password if present before storing in state/localStorage
        const { password, ...safeCustomer } = customer as any;
        set((state) => {
          let previousFull = scope === "full" ? null : state.previousFull;
          if (scope === "checkout" && state.scope === "full" && state.isAuthenticated && state.customer) {
            previousFull = { customer: state.customer, token: state.token };
          }
          return {
            customer: safeCustomer as Customer,
            token: token ?? state.token,
            isAuthenticated: true,
            scope,
            previousFull,
          };
        });
      },
      logout: () => set({ customer: null, token: null, isAuthenticated: false, scope: "full", previousFull: null }),
      exitCheckout: () => {
        const prev = get().previousFull;
        if (prev) {
          set({ customer: prev.customer, token: prev.token, isAuthenticated: true, scope: "full", previousFull: null });
          return true;
        }
        set({ customer: null, token: null, isAuthenticated: false, scope: "full", previousFull: null });
        return false;
      },
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";

export interface ActiveSubscription {
  subscription_id: string | null;
  status: string;
  mandate_status: string | null;
  next_charge_at: string | null;
  amount: number | null;
}

export function useActiveSubscription(customerId?: number) {
  return useQuery<ActiveSubscription | null>({
    queryKey: ["active-subscription", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase.functions.invoke("syncpay-subscription-status", {
        body: { customer_id: customerId },
        headers: {
          "x-customer-token": useAuthStore.getState().token || "",
        }
      });
      
      if (error) {
        if (error.status === 401) {
          window.dispatchEvent(new CustomEvent("auth:unauthorized"));
        } else {
          console.warn("[useActiveSubscription] Erro na função:", error);
        }
        return null;
      }

      if (!data || data.error || !data.status || data.status === "cancelled") {
        return null;
      }
      return {
        subscription_id: data.subscription_id || null,
        status: data.status,
        mandate_status: data.mandate_status || null,
        next_charge_at: data.next_charge_at || null,
        amount: typeof data.amount === "number" ? data.amount : null,
      };
    },
    enabled: !!customerId,
    staleTime: 30_000,
    retry: false,
  });
}

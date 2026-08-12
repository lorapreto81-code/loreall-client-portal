import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveSubscription {
  subscription_id: string | null;
  status: string;
  mandate_status: string | null;
  next_charge_at: string | null;
}

export function useActiveSubscription(customerId?: number) {
  return useQuery<ActiveSubscription | null>({
    queryKey: ["active-subscription", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase.functions.invoke("syncpay-subscription-status", {
        body: { customer_id: customerId },
      });
      if (error) return null; // sem assinatura, ou falha ao consultar — trata como "sem assinatura"
      if (!data || data.error || !data.status || data.status === "cancelled") return null;
      return {
        subscription_id: data.subscription_id || null,
        status: data.status,
        mandate_status: data.mandate_status || null,
        next_charge_at: data.next_charge_at || null,
      };
    },
    enabled: !!customerId,
    staleTime: 30_000,
    retry: false,
  });
}

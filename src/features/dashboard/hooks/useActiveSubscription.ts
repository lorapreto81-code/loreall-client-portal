import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveSubscription {
  id: string;
  syncpay_subscription_id: string;
  syncpay_plan_id: string;
  status: string;
  mandate_status: string | null;
  access_status: string | null;
  next_charge_at: string | null;
  billing_method: string;
  [key: string]: any;
}

export function useActiveSubscription(customerId?: number) {
  const queryClient = useQueryClient();

  const query = useQuery<ActiveSubscription | null>({
    queryKey: ["active-subscription", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from("syncpay_subscriptions")
        .select("*")
        .eq("customer_id", customerId)
        .in("status", ["pending_first_payment", "active", "overdue"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as ActiveSubscription | null;
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });

  // Refresh live status from SyncPay once por carregamento, para refletir a
  // realidade mesmo se o cliente nunca abriu o modal de renovação.
  useEffect(() => {
    const subId = query.data?.syncpay_subscription_id;
    if (!subId || !customerId) return;
    let cancelled = false;
    (async () => {
      try {
        await supabase.functions.invoke("syncpay-subscription-status", {
          body: { subscription_id: subId, customer_id: customerId },
        });
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ["active-subscription", customerId] });
        }
      } catch {
        // refresh em segundo plano, best-effort
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.syncpay_subscription_id, customerId]);

  return query;
}

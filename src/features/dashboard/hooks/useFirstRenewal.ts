import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";

/** One-time first-renewal discount. Server decides eligibility (and re-checks in create-pix). */
export function useFirstRenewal() {
  const customerId = useAuthStore((s) => s.customer?.id);
  const scope = useAuthStore((s) => s.scope);
  return useQuery<{ eligible: boolean; percent: number }>({
    queryKey: ["first-renewal", customerId],
    enabled: !!customerId && !!scope,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("discount-codes?action=first-renewal", {
        body: {},
        headers: { "x-customer-token": useAuthStore.getState().token || "" },
      });
      if (error || !data) return { eligible: false, percent: 0 };
      return { eligible: !!data.eligible, percent: Number(data.percent) || 0 };
    },
  });
}

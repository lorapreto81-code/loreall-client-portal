// First-renewal discount: one-time % off for PIX generated inside the client area (full session only).
// Consumed only when a payment flagged metadata.first_renewal=true is PAID.
// deno-lint-ignore-file no-explicit-any

export async function getFirstRenewalConfig(supabase: any): Promise<{ enabled: boolean; percent: number }> {
  const { data } = await supabase.from("system_config").select("config_key, config_value")
    .in("config_key", ["first_renewal_discount_enabled", "first_renewal_discount_percent"]);
  const map: Record<string, string> = {};
  for (const r of data || []) map[r.config_key] = r.config_value;
  const percent = Math.min(Math.max(Number(map.first_renewal_discount_percent ?? 15) || 15, 1), 90);
  return { enabled: (map.first_renewal_discount_enabled ?? "true") === "true", percent };
}

export async function isFirstRenewalEligible(supabase: any, customerId: number): Promise<{ eligible: boolean; percent: number }> {
  const cfg = await getFirstRenewalConfig(supabase);
  if (!cfg.enabled) return { eligible: false, percent: cfg.percent };
  const { data } = await supabase.from("payments").select("id")
    .eq("customer_id", customerId).eq("fastdepix_status", "paid")
    .contains("metadata", { first_renewal: true }).limit(1);
  return { eligible: !(data && data.length), percent: cfg.percent };
}

export function applyPercent(amount: number, percent: number) {
  const discount = Math.round(amount * percent) / 100;
  return { discount, final: Math.round((amount - discount) * 100) / 100 };
}

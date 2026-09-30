// Shared discount-code validation. Uses count only redemptions whose payment was PAID,
// so abandoned/cancelled PIX never consume a code.
// deno-lint-ignore-file no-explicit-any
export const CODE_RE = /^[A-Z0-9_-]{3,30}$/;

export function normalizeCode(raw: unknown): string {
  return String(raw || "").trim().toUpperCase();
}

export type DiscountResult =
  | { ok: true; code: any; discount: number; final: number }
  | { ok: false; error: string };

export async function evaluateDiscount(supabase: any, rawCode: unknown, customerId: number, amount: number): Promise<DiscountResult> {
  const code = normalizeCode(rawCode);
  if (!CODE_RE.test(code)) return { ok: false, error: "Cupom inválido." };
  const { data: dc } = await supabase.from("discount_codes").select("*").eq("code", code).maybeSingle();
  if (!dc || !dc.is_active) return { ok: false, error: "Cupom inválido ou desativado." };
  if (dc.valid_until && new Date(dc.valid_until).getTime() < Date.now()) return { ok: false, error: "Este cupom expirou." };

  const { data: reds } = await supabase
    .from("discount_redemptions")
    .select("customer_id, payments!inner(fastdepix_status)")
    .eq("discount_code_id", dc.id)
    .eq("payments.fastdepix_status", "paid");
  const paid = (reds || []) as { customer_id: number }[];
  if (dc.max_uses != null && paid.length >= Number(dc.max_uses)) return { ok: false, error: "Este cupom esgotou." };
  if (dc.one_per_customer && paid.some((r) => Number(r.customer_id) === Number(customerId))) {
    return { ok: false, error: "Você já usou este cupom." };
  }

  const value = Number(dc.discount_value) || 0;
  let discount = dc.discount_type === "fixed" ? value : (amount * value) / 100;
  discount = Math.round(Math.min(Math.max(discount, 0), amount) * 100) / 100;
  const final = Math.round((amount - discount) * 100) / 100;
  if (final < 5) return { ok: false, error: "Cupom não pode ser aplicado a este valor." };
  return { ok: true, code: dc, discount, final };
}

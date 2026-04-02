import { supabase } from "@/integrations/supabase/client";

async function invokeProxy(action: string, params: Record<string, string> = {}, body?: Record<string, unknown>) {
  const queryParams = new URLSearchParams({ action, ...params }).toString();
  
  const { data, error } = await supabase.functions.invoke("topgestor-proxy", {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    // Pass query params via the function URL
  });

  if (error) throw new Error(error.message || "Erro na requisição");
  return data;
}

// We need to use fetch directly to pass query params since supabase.functions.invoke doesn't support them well
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callProxy(action: string, params: Record<string, string> = {}, options?: { method?: string; body?: Record<string, unknown> }) {
  const qp = new URLSearchParams({ action, ...params }).toString();
  const url = `${SUPABASE_URL}/functions/v1/topgestor-proxy?${qp}`;
  
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (res.status === 429) {
    throw new Error("Muitas requisições. Aguarde alguns segundos.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || `Erro ${res.status}`);
  }
  return res.json();
}

export async function searchCustomer(query: string) {
  return callProxy("search-customer", { query });
}

export async function getCustomerInvoices(customerId: number, perPage = 10) {
  return callProxy("get-invoices", { id: String(customerId), per_page: String(perPage) });
}

export async function generatePaymentLink(customerId: number) {
  return callProxy("generate-payment-link", { id: String(customerId) }, { method: "POST" });
}

export async function getPlans() {
  return callProxy("get-plans");
}

export async function updateCustomer(customerId: number, body: Record<string, unknown>) {
  return callProxy("update-customer", { id: String(customerId) }, { method: "POST", body });
}

export async function getCustomer(customerId: number) {
  return callProxy("get-customer", { id: String(customerId) });
}

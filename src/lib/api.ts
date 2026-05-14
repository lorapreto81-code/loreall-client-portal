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

export async function renewCustomer(
  customerId: number,
  body: { plan_id?: number; dias?: number; data_de_vencimento?: string; invoice_status?: string } = {}
) {
  return callProxy("renew-customer", { id: String(customerId) }, { method: "POST", body });
}

// ----- Fast Depix (PIX) -----
export interface CreatePixResponse {
  payment_id: string;
  qr_code_url: string;
  qr_code_text: string;
  expires_at: string;
  amount: number;
}

export async function createPixPayment(body: {
  customer_id: number;
  customer_name: string;
  customer_whatsapp?: string;
  plan_id: number;
  plan_name: string;
  amount: number;
  referral_code?: string;
}): Promise<CreatePixResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fastdepix-create-pix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data as CreatePixResponse;
}

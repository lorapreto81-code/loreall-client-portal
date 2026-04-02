const API_BASE = "https://topgestor.me/api/v1";
const API_TOKEN = import.meta.env.VITE_TOPGESTOR_TOKEN || "103|LzEGmH0wGvj0IZpvnugN58cDqBXWHyhsU98jwkDJ533c098c";

const headers: Record<string, string> = {
  Authorization: `Bearer ${API_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function handleResponse(res: Response) {
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (res.status === 429) {
    throw new Error("Muitas requisições. Aguarde alguns segundos.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Erro ${res.status}`);
  }
  return res.json();
}

export async function searchCustomer(query: string) {
  const res = await fetch(`${API_BASE}/customers/search/${encodeURIComponent(query)}`, { headers });
  return handleResponse(res);
}

export async function getCustomerInvoices(customerId: number, perPage = 10) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/invoices?per_page=${perPage}`, { headers });
  return handleResponse(res);
}

export async function generatePaymentLink(customerId: number) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/payment-link`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

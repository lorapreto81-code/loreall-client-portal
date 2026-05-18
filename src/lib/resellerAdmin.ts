const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getAdminPassword(): string {
  return sessionStorage.getItem("admin_password") || "";
}

async function call(action: string, opts: { method?: string; body?: Record<string, unknown>; params?: Record<string, string> } = {}) {
  const params = new URLSearchParams({ action, ...(opts.params || {}) }).toString();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/reseller-admin?${params}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "x-admin-password": getAdminPassword(),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}

export const resellerAdmin = {
  listLinks: () => call("list-links"),
  createLink: (body: Record<string, unknown>) => call("create-link", { method: "POST", body }),
  updateLink: (body: Record<string, unknown>) => call("update-link", { method: "POST", body }),
  deleteLink: (id: string) => call("delete-link", { method: "POST", body: { id } }),
  listPurchases: (params?: Record<string, string>) => call("list-purchases", { params }),
  reprocess: (id: string) => call("reprocess-purchase", { method: "POST", body: { id } }),
  getConfig: () => call("get-config"),
  updateConfig: (entries: Record<string, string>) => call("update-config", { method: "POST", body: { entries } }),
  dashboard: () => call("dashboard"),
};

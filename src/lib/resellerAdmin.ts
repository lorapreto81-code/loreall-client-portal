const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getAdminPassword(): string {
  return sessionStorage.getItem("admin_password") || "";
}

function makeCaller(fnName: string) {
  return async (action: string, opts: { method?: string; body?: Record<string, unknown>; params?: Record<string, string> } = {}) => {
    const params = new URLSearchParams({ action, ...(opts.params || {}) }).toString();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}?${params}`, {
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
  };
}

const call = makeCaller("reseller-admin");
const callSub = makeCaller("syncpay-subscriptions");

export const resellerAdmin = {
  listLinks: () => call("list-links"),
  createLink: (body: Record<string, unknown>) => call("create-link", { method: "POST", body }),
  updateLink: (body: Record<string, unknown>) => call("update-link", { method: "POST", body }),
  deleteLink: (id: string) => call("delete-link", { method: "POST", body: { id } }),
  listPurchases: (params?: Record<string, string>) => call("list-purchases", { params }),
  reprocess: (id: string) => call("reprocess-purchase", { method: "POST", body: { id } }),
  markPaid: (id: string) => call("mark-paid", { method: "POST", body: { id } }),
  closePurchase: (id: string) => call("close-purchase", { method: "POST", body: { id } }),
  deletePurchase: (id: string) => call("delete-purchase", { method: "POST", body: { id } }),
  getConfig: () => call("get-config"),
  updateConfig: (entries: Record<string, string>) => call("update-config", { method: "POST", body: { entries } }),
  dashboard: () => call("dashboard"),
  listPayments: (params?: Record<string, string>) => call("list-payments", { params }),
  deletePayment: (id: string) => call("delete-payment", { method: "POST", body: { id } }),
  customersDashboard: () => call("customers-dashboard"),
  listOtpLogs: () => call("list-otp-logs"),
};

export interface SyncpayPlan {
  id: string;
  syncpay_plan_id: string;
  name: string;
  description?: string | null;
  amount: number;
  periodicity_days: number;
  billing_method: "qr_code" | "pix_automatico" | string;
  status: string;
  checkout_url?: string | null;
  topgestor_plan_id?: number | null;
}

export const syncpayAdmin = {
  listPlans: (): Promise<{ plans: SyncpayPlan[] }> => callSub("list-plans"),
  syncPlans: (): Promise<{ synced: number }> => callSub("sync-plans", { method: "POST" }),
  createPlan: (body: Record<string, unknown>) => callSub("create-plan", { method: "POST", body }),
  updatePlan: (body: Record<string, unknown>) => callSub("update-plan", { method: "POST", body }),
  archivePlan: (id: string) => callSub("archive-plan", { method: "POST", body: { id } }),
  listSubscribers: (plan_id: string) => callSub("list-subscribers", { params: { plan_id } }),
  listAllSubscribers: () => callSub("list-all-subscribers"),
  cancelSubscription: (subscription_id: string) => callSub("cancel-subscription", { method: "POST", body: { subscription_id } }),
};

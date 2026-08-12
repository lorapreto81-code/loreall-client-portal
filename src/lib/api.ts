import { getCustomerToken } from "@/store/authStore";
import { AuthService, OtpResponse, LoginAccount } from "@/services/auth/AuthService";
import { CustomerService } from "@/services/customer/CustomerService";
import { PaymentService, CreatePixResponse } from "@/services/customer/PaymentService";
import { ReferralService, ReferralRow } from "@/services/customer/ReferralService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type { LoginAccount, CreatePixResponse, ReferralRow };

/** Headers with the signed customer session token (required by protected functions). */
export function authHeaders(): Record<string, string> {
  const token = getCustomerToken();
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    ...(token ? { "x-customer-token": token } : {}),
  };
}

/** Verifies the customer's credentials server-side and returns signed sessions. */
export const customerLogin = (identifier: string, password: string) => AuthService.customerLogin(identifier, password);

/** Sends a 6-digit login code to the customer's WhatsApp. */
export const requestOtp = (phone: string, context?: "customer" | "reseller", slug?: string) => AuthService.requestOtp(phone, context, slug);

/** Validates the code and returns signed sessions for the matching accounts. */
export const verifyOtp = (phone: string, code: string, context?: "customer" | "reseller") => AuthService.verifyOtp(phone, code, context);

// Customer actions
export const getCustomer = (id: number) => CustomerService.getCustomer(id);
export const updateCustomer = (id: number, body: any) => CustomerService.updateCustomer(id, body);
export const getPlans = () => CustomerService.getPlans();

// Payment actions
export const createPixPayment = (body: any) => PaymentService.createPix(body);
export const renewCustomer = (id: number, body: any) => PaymentService.renewCustomer(id, body.plan_id);

// Referral actions
export const getOrCreateReferralCode = (id: number, name: string) => ReferralService.getOrCreateReferralCode(id, name);
export const listReferralsByReferrer = (id: number) => ReferralService.listReferralsByReferrer(id);
export const lookupReferralCode = (code: string) => ReferralService.lookupReferralCode(code);

// Remaining legacy functions
async function callProxy(action: string, params: Record<string, string> = {}, options?: { method?: string; body?: Record<string, unknown> }) {
  const qp = new URLSearchParams({ action, ...params }).toString();
  const url = `${SUPABASE_URL}/functions/v1/topgestor-proxy?${qp}`;
  
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: authHeaders(),
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || `Erro ${res.status}`);
  }
  return res.json();
}

export async function getCustomerInvoices(customerId: number, perPage = 10) {
  return callProxy("get-invoices", { id: String(customerId), per_page: String(perPage) });
}

export async function generatePaymentLink(customerId: number) {
  return callProxy("generate-payment-link", { id: String(customerId) }, { method: "POST" });
}

export async function listCustomers(params: any = {}) {
  const qp: Record<string, string> = {};
  if (params.per_page) qp.per_page = String(params.per_page);
  if (params.page) qp.page = String(params.page);
  if (params.status) qp.status = params.status;
  if (params.search) qp.search = params.search;
  if (params.archived) qp.archived = "true";
  return callProxy("list-customers", qp);
}

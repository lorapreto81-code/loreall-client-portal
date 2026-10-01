import { BaseApi } from "@/services/api/BaseApi";
import { Customer } from "@/store/authStore";

export interface LoginAccount {
  token: string;
  customer: Customer;
}

export interface OtpResponse {
  ok: boolean;
  expires_in: number;
  message: string;
  target_hint?: string;
  customer_name?: string;
  channel?: "whatsapp" | "email";
  choose?: boolean;
  options?: { whatsapp: string; email: string };
  preferred?: "whatsapp" | "email";
  password?: boolean;
}

export class AuthService extends BaseApi {
  static async requestOtp(identifier: string, context: "customer" | "reseller" = "customer", slug?: string, channel?: "whatsapp" | "email", preferCode?: boolean): Promise<OtpResponse> {
    const sanitized = identifier.trim().slice(0, 100);
    return this.request<OtpResponse>("otp-request", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ phone: sanitized, context, slug, channel, prefer_code: preferCode || undefined }),
    });
  }

  static async verifyOtp(phone: string, code: string, context: "customer" | "reseller" = "customer"): Promise<{ accounts: LoginAccount[] }> {
    return this.request<{ accounts: LoginAccount[] }>("otp-verify", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ phone, code, context }),
    });
  }

  static async passwordLogin(identifier: string, password: string): Promise<{ accounts: LoginAccount[] }> {
    return this.request<{ accounts: LoginAccount[] }>("customer-auth", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ action: "login", identifier: identifier.trim().slice(0, 100), password }),
    });
  }

  static async setPassword(password: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("customer-auth", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ action: "set", password }),
    });
  }

  static async passwordStatus(): Promise<{ has_password: boolean }> {
    return this.request<{ has_password: boolean }>("customer-auth", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ action: "status" }),
    });
  }
}

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
}

export class AuthService extends BaseApi {
  static async requestOtp(identifier: string): Promise<OtpResponse> {
    const sanitized = identifier.trim().slice(0, 100);
    return this.request<OtpResponse>("otp-request", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ phone: sanitized }),
    });
  }

  static async verifyOtp(phone: string, code: string): Promise<{ accounts: LoginAccount[] }> {
    return this.request<{ accounts: LoginAccount[] }>("otp-verify", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ phone, code }),
    });
  }

  static async customerLogin(identifier: string, password: string): Promise<{ accounts: LoginAccount[] }> {
    if (!identifier.trim() || !password) throw new Error("Informe usuário e senha.");
    return this.request<{ accounts: LoginAccount[] }>("customer-auth", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ identifier, password }),
    });
  }
}

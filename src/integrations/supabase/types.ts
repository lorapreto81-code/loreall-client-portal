export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      confirmed_customer_emails: {
        Row: {
          confirmed_at: string
          customer_id: number
          email: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string
          customer_id: number
          email: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string
          customer_id?: number
          email?: string
          updated_at?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          customer_id: number | null
          expires_at: string
          id: string
          ip_address: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          customer_id?: number | null
          expires_at: string
          id?: string
          ip_address?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          customer_id?: number | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          charge_id: string | null
          created_at: string
          customer_id: number
          customer_name: string
          customer_whatsapp: string | null
          fastdepix_status: string
          fastdepix_transaction_id: number | null
          id: string
          metadata: Json | null
          paid_at: string | null
          plan_id: number
          plan_name: string
          provider: string
          provider_transaction_id: string | null
          qr_code_expires_at: string | null
          qr_code_text: string | null
          qr_code_url: string | null
          renewal_response: Json | null
          renewed_at: string | null
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          charge_id?: string | null
          created_at?: string
          customer_id: number
          customer_name: string
          customer_whatsapp?: string | null
          fastdepix_status?: string
          fastdepix_transaction_id?: number | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          plan_id: number
          plan_name: string
          provider?: string
          provider_transaction_id?: string | null
          qr_code_expires_at?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          renewal_response?: Json | null
          renewed_at?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_id?: string | null
          created_at?: string
          customer_id?: number
          customer_name?: string
          customer_whatsapp?: string | null
          fastdepix_status?: string
          fastdepix_transaction_id?: number | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          plan_id?: number
          plan_name?: string
          provider?: string
          provider_transaction_id?: string | null
          qr_code_expires_at?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          renewal_response?: Json | null
          renewed_at?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          customer_id: number
          customer_name: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          customer_id: number
          customer_name?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: number
          customer_name?: string | null
          id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_days: number
          created_at: string
          credited_at: string | null
          id: string
          referral_code: string
          referred_customer_id: number
          referred_customer_name: string | null
          referred_payment_id: string | null
          referrer_customer_id: number
          rejection_reason: string | null
          renewal_response: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          bonus_days?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          referral_code: string
          referred_customer_id: number
          referred_customer_name?: string | null
          referred_payment_id?: string | null
          referrer_customer_id: number
          rejection_reason?: string | null
          renewal_response?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_days?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          referral_code?: string
          referred_customer_id?: number
          referred_customer_name?: string | null
          referred_payment_id?: string | null
          referrer_customer_id?: number
          rejection_reason?: string | null
          renewal_response?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_payment_id_fkey"
            columns: ["referred_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_adjustments: {
        Row: {
          applied_at: string | null
          applied_purchase_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          reseller_link_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_purchase_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          reseller_link_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_purchase_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          reseller_link_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_adjustments_applied_purchase_id_fkey"
            columns: ["applied_purchase_id"]
            isOneToOne: false
            referencedRelation: "reseller_credit_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_adjustments_reseller_link_id_fkey"
            columns: ["reseller_link_id"]
            isOneToOne: false
            referencedRelation: "reseller_links"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_purchases: {
        Row: {
          amount: number
          created_at: string
          email: string
          error_message: string | null
          fastdepix_transaction_id: number | null
          id: string
          ip_address: string | null
          package_credits: number
          paid_at: string | null
          provider: string
          provider_transaction_id: string | null
          qr_code_expires_at: string | null
          qr_code_text: string | null
          qr_code_url: string | null
          recharge_status: string
          recharged_at: string | null
          reseller_link_id: string | null
          status: string
          updated_at: string
          warez_response: Json | null
          warez_user_id: number
          warez_username: string
          whatsapp: string
        }
        Insert: {
          amount: number
          created_at?: string
          email?: string
          error_message?: string | null
          fastdepix_transaction_id?: number | null
          id?: string
          ip_address?: string | null
          package_credits: number
          paid_at?: string | null
          provider?: string
          provider_transaction_id?: string | null
          qr_code_expires_at?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          recharge_status?: string
          recharged_at?: string | null
          reseller_link_id?: string | null
          status?: string
          updated_at?: string
          warez_response?: Json | null
          warez_user_id: number
          warez_username: string
          whatsapp?: string
        }
        Update: {
          amount?: number
          created_at?: string
          email?: string
          error_message?: string | null
          fastdepix_transaction_id?: number | null
          id?: string
          ip_address?: string | null
          package_credits?: number
          paid_at?: string | null
          provider?: string
          provider_transaction_id?: string | null
          qr_code_expires_at?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          recharge_status?: string
          recharged_at?: string | null
          reseller_link_id?: string | null
          status?: string
          updated_at?: string
          warez_response?: Json | null
          warez_user_id?: number
          warez_username?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_purchases_reseller_link_id_fkey"
            columns: ["reseller_link_id"]
            isOneToOne: false
            referencedRelation: "reseller_links"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_links: {
        Row: {
          amount: number
          created_at: string
          credits: number
          display_name: string
          id: string
          is_active: boolean
          max_credits: number
          min_credits: number
          notes: string | null
          price_per_credit: number
          slug: string
          updated_at: string
          warez_user_id: number
          warez_username: string
          whatsapp: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          credits: number
          display_name: string
          id?: string
          is_active?: boolean
          max_credits?: number
          min_credits?: number
          notes?: string | null
          price_per_credit?: number
          slug: string
          updated_at?: string
          warez_user_id: number
          warez_username: string
          whatsapp?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          display_name?: string
          id?: string
          is_active?: boolean
          max_credits?: number
          min_credits?: number
          notes?: string | null
          price_per_credit?: number
          slug?: string
          updated_at?: string
          warez_user_id?: number
          warez_username?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      syncpay_plans: {
        Row: {
          amount: number
          billing_advance_days: number | null
          billing_method: string
          checkout_url: string | null
          created_at: string
          description: string | null
          grace_period_days: number | null
          id: string
          max_retry_attempts: number | null
          metadata: Json | null
          name: string
          periodicity_days: number
          status: string
          syncpay_plan_id: string
          topgestor_plan_id: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_advance_days?: number | null
          billing_method?: string
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          grace_period_days?: number | null
          id?: string
          max_retry_attempts?: number | null
          metadata?: Json | null
          name: string
          periodicity_days?: number
          status?: string
          syncpay_plan_id: string
          topgestor_plan_id?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_advance_days?: number | null
          billing_method?: string
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          grace_period_days?: number | null
          id?: string
          max_retry_attempts?: number | null
          metadata?: Json | null
          name?: string
          periodicity_days?: number
          status?: string
          syncpay_plan_id?: string
          topgestor_plan_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      syncpay_subscriptions: {
        Row: {
          access_status: string | null
          billing_method: string | null
          cancelled_at: string | null
          created_at: string
          customer_cpf: string | null
          customer_email: string | null
          customer_id: number | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_charge_at: string | null
          mandate_id: string | null
          mandate_status: string | null
          metadata: Json | null
          next_charge_at: string | null
          overdue_since: string | null
          retry_count: number
          started_at: string | null
          status: string
          suspended_at: string | null
          syncpay_plan_id: string
          syncpay_status: string | null
          syncpay_subscription_id: string
          updated_at: string
        }
        Insert: {
          access_status?: string | null
          billing_method?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_id?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_charge_at?: string | null
          mandate_id?: string | null
          mandate_status?: string | null
          metadata?: Json | null
          next_charge_at?: string | null
          overdue_since?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          suspended_at?: string | null
          syncpay_plan_id: string
          syncpay_status?: string | null
          syncpay_subscription_id: string
          updated_at?: string
        }
        Update: {
          access_status?: string | null
          billing_method?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_id?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_charge_at?: string | null
          mandate_id?: string | null
          mandate_status?: string | null
          metadata?: Json | null
          next_charge_at?: string | null
          overdue_since?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          suspended_at?: string | null
          syncpay_plan_id?: string
          syncpay_status?: string | null
          syncpay_subscription_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      syncpay_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          event: string
          id: string
          occurred_at: string | null
          payload: Json
          plan_token: string | null
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          subscription_token: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          event: string
          id?: string
          occurred_at?: string | null
          payload: Json
          plan_token?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          subscription_token?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          event?: string
          id?: string
          occurred_at?: string | null
          payload?: Json
          plan_token?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          subscription_token?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          config_key: string
          config_value: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      trial_signups: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          name: string
          password: string | null
          plan_id: number | null
          referral_code: string
          referrer_customer_id: number
          referrer_customer_name: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          topgestor_customer_id: number | null
          trial_days: number | null
          updated_at: string
          usuario: string | null
          whatsapp: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          name: string
          password?: string | null
          plan_id?: number | null
          referral_code: string
          referrer_customer_id: number
          referrer_customer_name?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          topgestor_customer_id?: number | null
          trial_days?: number | null
          updated_at?: string
          usuario?: string | null
          whatsapp: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          name?: string
          password?: string | null
          plan_id?: number | null
          referral_code?: string
          referrer_customer_id?: number
          referrer_customer_name?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          topgestor_customer_id?: number | null
          trial_days?: number | null
          updated_at?: string
          usuario?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      warez_api_logs: {
        Row: {
          created_at: string
          duration_ms: number
          endpoint: string
          error: string | null
          id: string
          method: string
          related_payment_id: string | null
          request_body: Json
          response_body: string
          response_status: number
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          endpoint: string
          error?: string | null
          id?: string
          method?: string
          related_payment_id?: string | null
          request_body?: Json
          response_body?: string
          response_status?: number
        }
        Update: {
          created_at?: string
          duration_ms?: number
          endpoint?: string
          error?: string | null
          id?: string
          method?: string
          related_payment_id?: string | null
          request_body?: Json
          response_body?: string
          response_status?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

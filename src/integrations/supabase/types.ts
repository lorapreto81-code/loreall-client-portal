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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      payments: {
        Row: {
          amount: number
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
          qr_code_expires_at: string | null
          qr_code_text: string | null
          qr_code_url: string | null
          renewal_response: Json | null
          renewed_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
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
          qr_code_expires_at?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          renewal_response?: Json | null
          renewed_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
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
          qr_code_expires_at?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          renewal_response?: Json | null
          renewed_at?: string | null
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

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
      email_settings: {
        Row: {
          auto_send_on_complete: boolean
          body_template: string | null
          created_at: string
          from_email: string | null
          from_name: string | null
          logo_url: string | null
          reply_to: string | null
          subject_template: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_send_on_complete?: boolean
          body_template?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          logo_url?: string | null
          reply_to?: string | null
          subject_template?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_send_on_complete?: boolean
          body_template?: string | null
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          logo_url?: string | null
          reply_to?: string | null
          subject_template?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          created_at: string
          currency: string
          elevenlabs_per_1k_chars: number
          gemini_input_per_1k: number
          gemini_output_per_1k: number
          id: boolean
          margin_platform_pays_pct: number
          margin_user_pays_pct: number
          openai_input_per_1k: number
          openai_output_per_1k: number
          replicate_image_per_unit: number
          replicate_lipsync_per_second: number
          replicate_video_per_second: number
          subscription_included_cents: number
          subscription_price_cents: number
          updated_at: string
          vat_pct: number
        }
        Insert: {
          created_at?: string
          currency?: string
          elevenlabs_per_1k_chars?: number
          gemini_input_per_1k?: number
          gemini_output_per_1k?: number
          id?: boolean
          margin_platform_pays_pct?: number
          margin_user_pays_pct?: number
          openai_input_per_1k?: number
          openai_output_per_1k?: number
          replicate_image_per_unit?: number
          replicate_lipsync_per_second?: number
          replicate_video_per_second?: number
          subscription_included_cents?: number
          subscription_price_cents?: number
          updated_at?: string
          vat_pct?: number
        }
        Update: {
          created_at?: string
          currency?: string
          elevenlabs_per_1k_chars?: number
          gemini_input_per_1k?: number
          gemini_output_per_1k?: number
          id?: boolean
          margin_platform_pays_pct?: number
          margin_user_pays_pct?: number
          openai_input_per_1k?: number
          openai_output_per_1k?: number
          replicate_image_per_unit?: number
          replicate_lipsync_per_second?: number
          replicate_video_per_second?: number
          subscription_included_cents?: number
          subscription_price_cents?: number
          updated_at?: string
          vat_pct?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          use_platform_ai: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
          use_platform_ai?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          use_platform_ai?: boolean
        }
        Relationships: []
      }
      redsys_payments: {
        Row: {
          amount_cents: number
          auth_code: string | null
          card_brand: string | null
          card_expiry: string | null
          card_token: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          order_code: string
          raw_response: Json | null
          response_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          auth_code?: string | null
          card_brand?: string | null
          card_expiry?: string | null
          card_token?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind: string
          order_code: string
          raw_response?: Json | null
          response_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          auth_code?: string | null
          card_brand?: string | null
          card_expiry?: string | null
          card_token?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          order_code?: string
          raw_response?: Json | null
          response_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_email_log: {
        Row: {
          attempts: number
          auto: boolean
          created_at: string
          error_message: string | null
          id: string
          owner_id: string
          recipient: string
          session_id: string
          simulation_id: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          auto?: boolean
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id: string
          recipient: string
          session_id: string
          simulation_id?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          auto?: boolean
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id?: string
          recipient?: string
          session_id?: string
          simulation_id?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_email_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_email_log_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          achievements: Json
          admin_feedback: string | null
          admin_feedback_at: string | null
          answers: Json
          candidate_email: string | null
          candidate_fields_data: Json
          candidate_name: string | null
          competency_scores: Json
          completed_at: string | null
          current_node_id: string | null
          id: string
          report: Json | null
          report_email_sent_at: string | null
          report_email_to: string | null
          score: number
          simulation_id: string
          stars: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: Json
          admin_feedback?: string | null
          admin_feedback_at?: string | null
          answers?: Json
          candidate_email?: string | null
          candidate_fields_data?: Json
          candidate_name?: string | null
          competency_scores?: Json
          completed_at?: string | null
          current_node_id?: string | null
          id?: string
          report?: Json | null
          report_email_sent_at?: string | null
          report_email_to?: string | null
          score?: number
          simulation_id: string
          stars?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: Json
          admin_feedback?: string | null
          admin_feedback_at?: string | null
          answers?: Json
          candidate_email?: string | null
          candidate_fields_data?: Json
          candidate_name?: string | null
          competency_scores?: Json
          completed_at?: string | null
          current_node_id?: string | null
          id?: string
          report?: Json | null
          report_email_sent_at?: string | null
          report_email_to?: string | null
          score?: number
          simulation_id?: string
          stars?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_characters: {
        Row: {
          consent_acknowledged: boolean
          created_at: string
          description: string | null
          id: string
          image_path: string
          name: string
          simulation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_acknowledged?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_path: string
          name: string
          simulation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_acknowledged?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string
          name?: string
          simulation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_characters_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_invitations: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          note: string | null
          revoked_at: string | null
          simulation_id: string
          token: string
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          note?: string | null
          revoked_at?: string | null
          simulation_id: string
          token: string
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          note?: string | null
          revoked_at?: string | null
          simulation_id?: string
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_invitations_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_revisions: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          simulation_id: string
          snapshot: Json
          summary: Json
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          simulation_id: string
          snapshot?: Json
          summary?: Json
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          simulation_id?: string
          snapshot?: Json
          summary?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_revisions_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          candidate_fields: Json
          cover_image_url: string | null
          created_at: string
          duration_min: number | null
          evaluation_criteria: Json
          id: string
          is_public: boolean
          objective: string
          owner_id: string
          prompt: string
          status: string
          story: Json
          title: string
          topic: string | null
          updated_at: string
          videos: Json
        }
        Insert: {
          candidate_fields?: Json
          cover_image_url?: string | null
          created_at?: string
          duration_min?: number | null
          evaluation_criteria?: Json
          id?: string
          is_public?: boolean
          objective: string
          owner_id: string
          prompt: string
          status?: string
          story?: Json
          title: string
          topic?: string | null
          updated_at?: string
          videos?: Json
        }
        Update: {
          candidate_fields?: Json
          cover_image_url?: string | null
          created_at?: string
          duration_min?: number | null
          evaluation_criteria?: Json
          id?: string
          is_public?: boolean
          objective?: string
          owner_id?: string
          prompt?: string
          status?: string
          story?: Json
          title?: string
          topic?: string | null
          updated_at?: string
          videos?: Json
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          action: string
          billed: boolean
          characters: number | null
          cost_raw_cents: number
          created_at: string
          id: string
          input_tokens: number | null
          margin_pct: number
          metadata: Json | null
          model: string | null
          output_tokens: number | null
          pays_platform: boolean
          provider: string
          seconds: number | null
          simulation_id: string | null
          total_cents: number
          units: number | null
          user_id: string
        }
        Insert: {
          action: string
          billed?: boolean
          characters?: number | null
          cost_raw_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number | null
          margin_pct?: number
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          pays_platform?: boolean
          provider: string
          seconds?: number | null
          simulation_id?: string | null
          total_cents?: number
          units?: number | null
          user_id: string
        }
        Update: {
          action?: string
          billed?: boolean
          characters?: number | null
          cost_raw_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number | null
          margin_pct?: number
          metadata?: Json | null
          model?: string | null
          output_tokens?: number | null
          pays_platform?: boolean
          provider?: string
          seconds?: number | null
          simulation_id?: string | null
          total_cents?: number
          units?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string
          elevenlabs_key: string | null
          gemini_key: string | null
          openai_key: string | null
          replicate_key: string | null
          text_provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elevenlabs_key?: string | null
          gemini_key?: string | null
          openai_key?: string | null
          replicate_key?: string | null
          text_provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          elevenlabs_key?: string | null
          gemini_key?: string | null
          openai_key?: string | null
          replicate_key?: string | null
          text_provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_billing: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          extra_pending_cents: number
          included_used_cents: number
          next_charge_at: string | null
          redsys_card_brand: string | null
          redsys_card_expiry: string | null
          redsys_card_token: string | null
          redsys_original_auth_code: string | null
          redsys_original_order: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          extra_pending_cents?: number
          included_used_cents?: number
          next_charge_at?: string | null
          redsys_card_brand?: string | null
          redsys_card_expiry?: string | null
          redsys_card_token?: string | null
          redsys_original_auth_code?: string | null
          redsys_original_order?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          extra_pending_cents?: number
          included_used_cents?: number
          next_charge_at?: string | null
          redsys_card_brand?: string | null
          redsys_card_expiry?: string | null
          redsys_card_token?: string | null
          redsys_original_auth_code?: string | null
          redsys_original_order?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

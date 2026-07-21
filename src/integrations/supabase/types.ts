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
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          organization_id: string
          reason: string
          ref_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          organization_id: string
          reason: string
          ref_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          organization_id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_batches: {
        Row: {
          created_at: string
          error: string | null
          failed: number
          filename: string
          id: string
          organization_id: string
          processed: number
          status: Database["public"]["Enums"]["batch_status"]
          total: number
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          failed?: number
          filename: string
          id?: string
          organization_id: string
          processed?: number
          status?: Database["public"]["Enums"]["batch_status"]
          total?: number
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          error?: string | null
          failed?: number
          filename?: string
          id?: string
          organization_id?: string
          processed?: number
          status?: Database["public"]["Enums"]["batch_status"]
          total?: number
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_pitch: string | null
          batch_id: string | null
          budget: number | null
          business_proposal: string | null
          company_name: string | null
          contact: string | null
          created_at: string
          description: string | null
          domain: string | null
          email_error: string | null
          email_sent: boolean
          id: string
          organization_id: string | null
          processing_status: string | null
          raw: Json | null
          raw_social_data: Json | null
          source: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          urgency: string
          user_id: string | null
          validation_status: string
        }
        Insert: {
          ai_pitch?: string | null
          batch_id?: string | null
          budget?: number | null
          business_proposal?: string | null
          company_name?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          email_error?: string | null
          email_sent?: boolean
          id?: string
          organization_id?: string | null
          processing_status?: string | null
          raw?: Json | null
          raw_social_data?: Json | null
          source?: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          urgency?: string
          user_id?: string | null
          validation_status?: string
        }
        Update: {
          ai_pitch?: string | null
          batch_id?: string | null
          budget?: number | null
          business_proposal?: string | null
          company_name?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          email_error?: string | null
          email_sent?: boolean
          id?: string
          organization_id?: string | null
          processing_status?: string | null
          raw?: Json | null
          raw_social_data?: Json | null
          source?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          urgency?: string
          user_id?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_plans: {
        Row: {
          created_at: string
          goals: string | null
          id: string
          plan: Json
          profile_links: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          goals?: string | null
          id?: string
          plan: Json
          profile_links?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          goals?: string | null
          id?: string
          plan?: Json
          profile_links?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      my_portfolio: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          credits_allocated: number
          credits_used: number
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_allocated?: number
          credits_used?: number
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          credits_allocated?: number
          credits_used?: number
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ai_key_mode: string
          byok_anthropic_key: string | null
          byok_openai_key: string | null
          created_at: string
          credits_pool: number
          credits_used: number
          hubspot_webhook_url: string | null
          id: string
          name: string
          owner_id: string
          plan: string
          salesforce_webhook_url: string | null
          updated_at: string
          zero_data_retention: boolean
        }
        Insert: {
          ai_key_mode?: string
          byok_anthropic_key?: string | null
          byok_openai_key?: string | null
          created_at?: string
          credits_pool?: number
          credits_used?: number
          hubspot_webhook_url?: string | null
          id?: string
          name: string
          owner_id: string
          plan?: string
          salesforce_webhook_url?: string | null
          updated_at?: string
          zero_data_retention?: boolean
        }
        Update: {
          ai_key_mode?: string
          byok_anthropic_key?: string | null
          byok_openai_key?: string | null
          created_at?: string
          credits_pool?: number
          credits_used?: number
          hubspot_webhook_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          salesforce_webhook_url?: string | null
          updated_at?: string
          zero_data_retention?: boolean
        }
        Relationships: []
      }
      scraper_config: {
        Row: {
          created_at: string
          geo_target: string
          id: string
          intents: string[]
          keywords: string[]
          max_results_per_query: number
          n8n_webhook_url: string | null
          singleton: boolean
          sources: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          geo_target?: string
          id?: string
          intents?: string[]
          keywords?: string[]
          max_results_per_query?: number
          n8n_webhook_url?: string | null
          singleton?: boolean
          sources?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          geo_target?: string
          id?: string
          intents?: string[]
          keywords?: string[]
          max_results_per_query?: number
          n8n_webhook_url?: string | null
          singleton?: boolean
          sources?: Json
          updated_at?: string
          user_id?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_org_admin: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      purge_stale_ignored_leads: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      batch_status:
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      org_role: "admin" | "member"
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
      app_role: ["admin", "user"],
      batch_status: [
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      org_role: ["admin", "member"],
    },
  },
} as const

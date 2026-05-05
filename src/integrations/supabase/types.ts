      debts: {
        Row: {
          id: string;
          member_id: string;
          name: string;
          type: string;
          custom_type: string | null;
          initial_value: number;
          current_value: number;
          start_date: string;
          end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          name: string;
          type: string;
          custom_type?: string | null;
          initial_value: number;
          current_value: number;
          start_date: string;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          name?: string;
          type?: string;
          custom_type?: string | null;
          initial_value?: number;
          current_value?: number;
          start_date?: string;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debts_member_id_fkey",
            columns: ["member_id"],
            isOneToOne: false,
            referencedRelation: "members",
            referencedColumns: ["id"]
          }
        ];
      }
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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      debts: {
        Row: {
          id: string;
          member_id: string;
          name: string;
          type: string;
          custom_type: string | null;
          initial_value: number;
          current_value: number;
          start_date: string;
          end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          name: string;
          type: string;
          custom_type?: string | null;
          initial_value: number;
          current_value: number;
          start_date: string;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          name?: string;
          type?: string;
          custom_type?: string | null;
          initial_value?: number;
          current_value?: number;
          start_date?: string;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debts_member_id_fkey",
            columns: ["member_id"],
            isOneToOne: false,
            referencedRelation: "members",
            referencedColumns: ["id"]
          }
        ];
      },
      banks: {
        Row: {
          account_type: string | null
          balance: number
          created_at: string
          id: string
          member_id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          balance?: number
          created_at?: string
          id?: string
          member_id: string
          name: string
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          balance?: number
          created_at?: string
          id?: string
          member_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          card_type: string
          closing_day: number | null
          created_at: string
          credit_limit: number | null
          due_day: number | null
          id: string
          member_id: string
          name: string
          updated_at: string
        }
        Insert: {
          card_type?: string
          closing_day?: number | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          member_id: string
          name: string
          updated_at?: string
        }
        Update: {
          card_type?: string
          closing_day?: number | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          member_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          card_id: string | null
          category_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          installment_number: number | null
          is_recurring: boolean
          member_id: string
          month: number
          recurring_id: string | null
          total_installments: number | null
          year: number
        }
        Insert: {
          amount: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          installment_number?: number | null
          is_recurring?: boolean
          member_id: string
          month: number
          recurring_id?: string | null
          total_installments?: number | null
          year: number
        }
        Update: {
          amount?: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          installment_number?: number | null
          is_recurring?: boolean
          member_id?: string
          month?: number
          recurring_id?: string | null
          total_installments?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      income_sources: {
        Row: {
          amount: number | null
          created_at: string
          entry_day: number | null
          id: string
          is_fixed: boolean
          member_id: string
          name: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          entry_day?: number | null
          id?: string
          is_fixed?: boolean
          member_id: string
          name: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          entry_day?: number | null
          id?: string
          is_fixed?: boolean
          member_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_sources_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          income_source_id: string | null
          member_id: string
          month: number
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description?: string | null
          id?: string
          income_source_id?: string | null
          member_id: string
          month: number
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          income_source_id?: string | null
          member_id?: string
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "incomes_income_source_id_fkey"
            columns: ["income_source_id"]
            isOneToOne: false
            referencedRelation: "income_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          consortium_contemplated_value: number | null
          consortium_credit_value: number | null
          consortium_is_contemplated: boolean | null
          consortium_monthly_value: number | null
          consortium_sale_value: number | null
          consortium_term_months: number | null
          consortium_will_sell: boolean | null
          cdb_bank_name: string | null
          cdb_indexer: string | null
          cdb_rate_percent: number | null
          created_at: string
          current_value: number
          id: string
          initial_value: number
          member_id: string
          name: string
          notes: string | null
          purchase_price: number | null
          quantity: number | null
          symbol: string | null
          start_date: string | null
          type: string
          updated_at: string
        }
        Insert: {
          consortium_contemplated_value?: number | null
          consortium_credit_value?: number | null
          consortium_is_contemplated?: boolean | null
          consortium_monthly_value?: number | null
          consortium_sale_value?: number | null
          consortium_term_months?: number | null
          consortium_will_sell?: boolean | null
          cdb_bank_name?: string | null
          cdb_indexer?: string | null
          cdb_rate_percent?: number | null
          created_at?: string
          current_value?: number
          id?: string
          initial_value?: number
          member_id: string
          name: string
          notes?: string | null
          purchase_price?: number | null
          quantity?: number | null
          symbol?: string | null
          start_date?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          consortium_contemplated_value?: number | null
          consortium_credit_value?: number | null
          consortium_is_contemplated?: boolean | null
          consortium_monthly_value?: number | null
          consortium_sale_value?: number | null
          consortium_term_months?: number | null
          consortium_will_sell?: boolean | null
          cdb_bank_name?: string | null
          cdb_indexer?: string | null
          cdb_rate_percent?: number | null
          created_at?: string
          current_value?: number
          id?: string
          initial_value?: number
          member_id?: string
          name?: string
          notes?: string | null
          purchase_price?: number | null
          quantity?: number | null
          symbol?: string | null
          start_date?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          family_id: string | null
          family_public_id: string | null
          id: string
          name: string
          password_hash: string | null
          phone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          family_id?: string | null
          family_public_id?: string | null
          id?: string
          name: string
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          family_id?: string | null
          family_public_id?: string | null
          id?: string
          name?: string
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          card_id: string | null
          category_id: string | null
          created_at: string
          current_installment: number
          description: string
          id: string
          is_active: boolean
          member_id: string
          start_date: string
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          current_installment?: number
          description: string
          id?: string
          is_active?: boolean
          member_id: string
          start_date: string
          total_installments: number
          updated_at?: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          current_installment?: number
          description?: string
          id?: string
          is_active?: boolean
          member_id?: string
          start_date?: string
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
      recurrence_frequency: "monthly" | "weekly" | "yearly"
      transaction_type: "income" | "expense"
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
      recurrence_frequency: ["monthly", "weekly", "yearly"],
      transaction_type: ["income", "expense"],
    },
  },
} as const

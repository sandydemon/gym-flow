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
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          gym_owner_id: string
          id: string
          metadata: Json | null
          page: string | null
          user_id: string
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          gym_owner_id: string
          id?: string
          metadata?: Json | null
          page?: string | null
          user_id: string
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          gym_owner_id?: string
          id?: string
          metadata?: Json | null
          page?: string | null
          user_id?: string
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          marked_at: string
          member_id: string
          user_id: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_at?: string
          member_id: string
          user_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_at?: string
          member_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          biceps: number | null
          calves: number | null
          chest: number | null
          created_at: string
          hips: number | null
          id: string
          neck: number | null
          paid_training_member_id: string
          recorded_at: string
          shoulders: number | null
          thighs: number | null
          user_id: string
          waist: number | null
        }
        Insert: {
          biceps?: number | null
          calves?: number | null
          chest?: number | null
          created_at?: string
          hips?: number | null
          id?: string
          neck?: number | null
          paid_training_member_id: string
          recorded_at?: string
          shoulders?: number | null
          thighs?: number | null
          user_id: string
          waist?: number | null
        }
        Update: {
          biceps?: number | null
          calves?: number | null
          chest?: number | null
          created_at?: string
          hips?: number | null
          id?: string
          neck?: number | null
          paid_training_member_id?: string
          recorded_at?: string
          shoulders?: number | null
          thighs?: number | null
          user_id?: string
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_paid_training_member_id_fkey"
            columns: ["paid_training_member_id"]
            isOneToOne: false
            referencedRelation: "paid_training_members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gym_fees: {
        Row: {
          amount: number
          created_at: string
          gym_id: string
          id: string
          month: string
          payment_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          gym_id: string
          id?: string
          month: string
          payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gym_id?: string
          id?: string
          month?: string
          payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_fees_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_users: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          gym_owner_id: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          gym_owner_id: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          gym_owner_id?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gyms: {
        Row: {
          address: string | null
          created_at: string
          gym_email: string
          gym_name: string
          id: string
          is_active: boolean
          owner_name: string | null
          phone: string | null
          subscription_amount: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          gym_email: string
          gym_name: string
          id?: string
          is_active?: boolean
          owner_name?: string | null
          phone?: string | null
          subscription_amount?: number
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          gym_email?: string
          gym_name?: string
          id?: string
          is_active?: boolean
          owner_name?: string | null
          phone?: string | null
          subscription_amount?: number
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          admission_fee: number
          admission_fee_paid: boolean
          created_at: string
          expiry_date: string | null
          full_name: string
          id: string
          is_active: boolean
          join_date: string
          member_code: string | null
          monthly_fee: number
          notes: string | null
          package_duration_months: number
          package_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admission_fee?: number
          admission_fee_paid?: boolean
          created_at?: string
          expiry_date?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          join_date?: string
          member_code?: string | null
          monthly_fee: number
          notes?: string | null
          package_duration_months?: number
          package_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admission_fee?: number
          admission_fee_paid?: boolean
          created_at?: string
          expiry_date?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          join_date?: string
          member_code?: string | null
          monthly_fee?: number
          notes?: string | null
          package_duration_months?: number
          package_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_fees: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          month: string
          payment_date: string | null
          payment_method: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          month: string
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          month?: string
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_training_members: {
        Row: {
          created_at: string
          height: number | null
          id: string
          member_id: string
          notes: string | null
          target: string
          trainer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          member_id: string
          notes?: string | null
          target?: string
          trainer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          member_id?: string
          notes?: string | null
          target?: string
          trainer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_training_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_training_members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          gym_name: string | null
          id: string
          logo_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_name?: string | null
          id?: string
          logo_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gym_name?: string | null
          id?: string
          logo_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          id: string
          label: string | null
          paid_training_member_id: string
          photo_url: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          label?: string | null
          paid_training_member_id: string
          photo_url: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          label?: string | null
          paid_training_member_id?: string
          photo_url?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_paid_training_member_id_fkey"
            columns: ["paid_training_member_id"]
            isOneToOne: false
            referencedRelation: "paid_training_members"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          created_at: string
          id: string
          member_id: string
          reminder_type: string
          sent_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          reminder_type?: string
          sent_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          reminder_type?: string
          sent_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          joining_date: string
          phone: string | null
          role: string
          salary: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          joining_date?: string
          phone?: string | null
          role?: string
          salary?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          joining_date?: string
          phone?: string | null
          role?: string
          salary?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_advances: {
        Row: {
          advance_date: string
          amount: number
          created_at: string
          deducted_amount: number
          id: string
          is_settled: boolean
          notes: string | null
          staff_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_date?: string
          amount: number
          created_at?: string
          deducted_amount?: number
          id?: string
          is_settled?: boolean
          notes?: string | null
          staff_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_date?: string
          amount?: number
          created_at?: string
          deducted_amount?: number
          id?: string
          is_settled?: boolean
          notes?: string | null
          staff_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          marked_at: string
          staff_id: string
          status: string
          user_id: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_at?: string
          staff_id: string
          status?: string
          user_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_at?: string
          staff_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salaries: {
        Row: {
          advance_amount: number
          base_salary: number
          created_at: string
          deduction_amount: number
          id: string
          month: string
          net_paid: number
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          staff_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_amount?: number
          base_salary?: number
          created_at?: string
          deduction_amount?: number
          id?: string
          month: string
          net_paid?: number
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          staff_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_amount?: number
          base_salary?: number
          created_at?: string
          deduction_amount?: number
          id?: string
          month?: string
          net_paid?: number
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          staff_id?: string
          status?: string
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
      weight_progress: {
        Row: {
          created_at: string
          id: string
          paid_training_member_id: string
          recorded_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          paid_training_member_id: string
          recorded_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          paid_training_member_id?: string
          recorded_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_progress_paid_training_member_id_fkey"
            columns: ["paid_training_member_id"]
            isOneToOne: false
            referencedRelation: "paid_training_members"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          body_parts: string[]
          cardio: string | null
          created_at: string
          day_of_week: string
          id: string
          notes: string | null
          paid_training_member_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_parts?: string[]
          cardio?: string | null
          created_at?: string
          day_of_week: string
          id?: string
          notes?: string | null
          paid_training_member_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_parts?: string[]
          cardio?: string | null
          created_at?: string
          day_of_week?: string
          id?: string
          notes?: string | null
          paid_training_member_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_first_admin: { Args: { admin_user_id: string }; Returns: boolean }
      generate_member_code: { Args: { _user_id: string }; Returns: string }
      generate_monthly_gym_fees: { Args: { p_month: string }; Returns: number }
      get_gym_owner_id: { Args: { _user_id: string }; Returns: string }
      get_sub_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      grant_admin_role: { Args: { target_user_email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "owner" | "trainer" | "receptionist"
      subscription_plan: "Monthly" | "Yearly"
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
      app_role: ["admin", "user", "owner", "trainer", "receptionist"],
      subscription_plan: ["Monthly", "Yearly"],
    },
  },
} as const

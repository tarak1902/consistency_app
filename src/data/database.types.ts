// Database types for the public schema.
// Hand-written to match `supabase gen types typescript` output for
// supabase/migrations/20261118000000_init.sql. Regenerate with
// `npm run db:types` once the local stack is running; keep the shape identical.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          user_id: string;
          rate: number;
          duration_days: number;
          rest_weekdays: number[];
          sleep_time: string;
          timezone: string;
          start_date: string;
          end_date: string;
          status: Database['public']['Enums']['plan_status'];
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rate: number;
          duration_days: number;
          rest_weekdays?: number[];
          sleep_time: string;
          timezone: string;
          start_date: string;
          end_date: string;
          status?: Database['public']['Enums']['plan_status'];
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
        Relationships: [];
      };
      works: {
        Row: {
          id: string;
          plan_id: string;
          user_id: string;
          title: string;
          done_criteria: string | null;
          color_index: number;
          position: number;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          title: string;
          done_criteria?: string | null;
          color_index: number;
          position: number;
        };
        Update: Partial<Database['public']['Tables']['works']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'works_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      checkins: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          work_id: string;
          plan_day: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          work_id: string;
          plan_day: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['checkins']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'checkins_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkins_work_id_fkey';
            columns: ['work_id'];
            isOneToOne: false;
            referencedRelation: 'works';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      check_in: {
        Args: { p_work_id: string };
        Returns: Database['public']['Tables']['checkins']['Row'];
      };
      uncheck: {
        Args: { p_work_id: string };
        Returns: undefined;
      };
      create_plan: {
        Args: {
          p_rate: number;
          p_duration_days: number;
          p_rest_weekdays: number[];
          p_sleep_time: string;
          p_timezone: string;
          p_works: Json;
        };
        Returns: string;
      };
      end_plan_early: {
        Args: { p_plan_id: string; p_confirm: string };
        Returns: undefined;
      };
      finalize_expired_plans: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      plan_window: {
        Args: { p_day: string; p_sleep: string; p_tz: string };
        Returns: { open_at: string; close_at: string }[];
      };
      server_time: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      plan_status: 'active' | 'completed' | 'ended_early';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

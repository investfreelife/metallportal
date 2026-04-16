export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          company_name: string | null;
          inn: string | null;
          role: "buyer" | "supplier" | "admin";
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          company_name?: string | null;
          inn?: string | null;
          role?: "buyer" | "supplier" | "admin";
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          company_name?: string | null;
          inn?: string | null;
          role?: "buyer" | "supplier" | "admin";
          is_verified?: boolean;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          image_url: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
      };
      suppliers: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          inn: string;
          kpp: string | null;
          ogrn: string | null;
          legal_address: string | null;
          contact_person: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          description: string | null;
          logo_url: string | null;
          is_verified: boolean;
          rating: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          inn: string;
          kpp?: string | null;
          ogrn?: string | null;
          legal_address?: string | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          description?: string | null;
          logo_url?: string | null;
          is_verified?: boolean;
          rating?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          company_name?: string;
          inn?: string;
          kpp?: string | null;
          ogrn?: string | null;
          legal_address?: string | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          description?: string | null;
          logo_url?: string | null;
          is_verified?: boolean;
          rating?: number;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category_id: string;
          supplier_id: string;
          gost: string | null;
          material: string | null;
          dimensions: string | null;
          weight_per_unit: number | null;
          unit: string;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category_id: string;
          supplier_id: string;
          gost?: string | null;
          material?: string | null;
          dimensions?: string | null;
          weight_per_unit?: number | null;
          unit?: string;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          category_id?: string;
          supplier_id?: string;
          gost?: string | null;
          material?: string | null;
          dimensions?: string | null;
          weight_per_unit?: number | null;
          unit?: string;
          image_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      price_items: {
        Row: {
          id: string;
          product_id: string;
          supplier_id: string;
          base_price: number;
          discount_price: number | null;
          min_quantity: number;
          currency: string;
          in_stock: boolean;
          stock_quantity: number | null;
          delivery_days: number | null;
          valid_from: string;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          supplier_id: string;
          base_price: number;
          discount_price?: number | null;
          min_quantity?: number;
          currency?: string;
          in_stock?: boolean;
          stock_quantity?: number | null;
          delivery_days?: number | null;
          valid_from?: string;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          base_price?: number;
          discount_price?: number | null;
          min_quantity?: number;
          currency?: string;
          in_stock?: boolean;
          stock_quantity?: number | null;
          delivery_days?: number | null;
          valid_from?: string;
          valid_until?: string | null;
          updated_at?: string;
        };
      };
      requests: {
        Row: {
          id: string;
          user_id: string | null;
          type: "price_request" | "custom_order" | "smeta_upload" | "callback";
          status: "new" | "in_progress" | "quoted" | "completed" | "cancelled";
          message: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          file_url: string | null;
          metadata: Json | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          type: "price_request" | "custom_order" | "smeta_upload" | "callback";
          status?: "new" | "in_progress" | "quoted" | "completed" | "cancelled";
          message?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          file_url?: string | null;
          metadata?: Json | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "new" | "in_progress" | "quoted" | "completed" | "cancelled";
          message?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          file_url?: string | null;
          metadata?: Json | null;
          assigned_to?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "buyer" | "supplier" | "admin";
      request_type: "price_request" | "custom_order" | "smeta_upload" | "callback";
      request_status: "new" | "in_progress" | "quoted" | "completed" | "cancelled";
    };
  };
}

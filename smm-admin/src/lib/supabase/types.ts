export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          timezone: string;
          brand_kit: Json;
          schedule: Json;
          require_approval: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clients"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
      };
      client_users: {
        Row: {
          id: string;
          client_id: string;
          user_id: string;
          role: "owner" | "client" | "operator";
        };
        Insert: Omit<Database["public"]["Tables"]["client_users"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["client_users"]["Insert"]>;
      };
      posts_cache: {
        Row: {
          id: string;
          client_id: string;
          platform: string[];
          status: string;
          caption: string | null;
          media_url: string | null;
          scheduled_at: string | null;
          published_at: string | null;
          synced_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["posts_cache"]["Row"], "id" | "synced_at">;
        Update: Partial<Database["public"]["Tables"]["posts_cache"]["Insert"]>;
      };
      invites: {
        Row: {
          id: string;
          client_id: string;
          email: string;
          token: string;
          role: string;
          used: boolean;
          expires_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["invites"]["Row"], "id" | "token">;
        Update: Partial<Database["public"]["Tables"]["invites"]["Insert"]>;
      };
    };
  };
}

// App-level types
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientUser = Database["public"]["Tables"]["client_users"]["Row"];
export type PostCache = Database["public"]["Tables"]["posts_cache"]["Row"];

export type UserRole = "owner" | "client" | "operator";

export type PostStatus = "published" | "scheduled" | "draft" | "pending_approval" | "failed";

export type Platform = "instagram" | "tiktok" | "vk" | "telegram" | "facebook" | "youtube";

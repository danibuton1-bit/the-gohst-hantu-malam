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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_locks: {
        Row: {
          pass_hash: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          pass_hash: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          pass_hash?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_locks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          created_at: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string | null
          sender_id: string
          sender_karakter: string
          sender_nama: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          sender_id: string
          sender_karakter: string
          sender_nama: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          sender_id?: string
          sender_karakter?: string
          sender_nama?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state: {
        Row: {
          keys_found: number
          room_code: string
          started_at: string | null
          updated_at: string
          winner: string | null
        }
        Insert: {
          keys_found?: number
          room_code: string
          started_at?: string | null
          updated_at?: string
          winner?: string | null
        }
        Update: {
          keys_found?: number
          room_code?: string
          started_at?: string | null
          updated_at?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_state_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      players: {
        Row: {
          id: string
          joined_at: string
          karakter: string
          nama: string
          profile_id: string
          role: string | null
          role_pref: string
          room_code: string
          status: string
          username: string
        }
        Insert: {
          id?: string
          joined_at?: string
          karakter: string
          nama: string
          profile_id: string
          role?: string | null
          role_pref?: string
          room_code: string
          status?: string
          username: string
        }
        Update: {
          id?: string
          joined_at?: string
          karakter?: string
          nama?: string
          profile_id?: string
          role?: string | null
          role_pref?: string
          room_code?: string
          status?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          karakter_pilihan: string
          kode_id: string
          nama: string
          tanggal_lahir: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          karakter_pilihan?: string
          kode_id: string
          nama: string
          tanggal_lahir: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          karakter_pilihan?: string
          kode_id?: string
          nama?: string
          tanggal_lahir?: string
          username?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          host_id: string
          map: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          host_id: string
          map?: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          host_id?: string
          map?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_profile: {
        Args: { p_karakter: string; p_nama: string; p_tanggal: string }
        Returns: {
          created_at: string
          id: string
          karakter_pilihan: string
          kode_id: string
          nama: string
          tanggal_lahir: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_password: { Args: { p_id: string; p_kode: string }; Returns: boolean }
      is_admin: { Args: { p_id: string; p_kode: string }; Returns: boolean }
      list_dm: {
        Args: { p_id: string; p_kode: string; p_other: string }
        Returns: {
          body: string
          created_at: string
          id: string
          recipient_id: string | null
          sender_id: string
          sender_karakter: string
          sender_nama: string
        }[]
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_friends: {
        Args: { p_id: string; p_kode: string }
        Returns: {
          friend_id: string
          incoming: boolean
          karakter: string
          kode_id: string
          nama: string
          status: string
          username: string
        }[]
      }
      login_id_card: {
        Args: { p_kode: string; p_nama: string }
        Returns: {
          created_at: string
          id: string
          karakter_pilihan: string
          kode_id: string
          nama: string
          tanggal_lahir: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      login_secure: {
        Args: { p_kode: string; p_nama: string; p_pass: string }
        Returns: Json
      }
      me_ok: { Args: { p_id: string; p_kode: string }; Returns: boolean }
      respond_friend: {
        Args: {
          p_accept: boolean
          p_id: string
          p_kode: string
          p_other: string
        }
        Returns: undefined
      }
      send_chat: {
        Args: { p_body: string; p_id: string; p_kode: string; p_to: string }
        Returns: undefined
      }
      send_friend_request: {
        Args: { p_id: string; p_kode: string; p_target_kode: string }
        Returns: string
      }
      set_karakter: {
        Args: { p_id: string; p_karakter: string; p_kode: string }
        Returns: {
          created_at: string
          id: string
          karakter_pilihan: string
          kode_id: string
          nama: string
          tanggal_lahir: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_password: {
        Args: { p_id: string; p_kode: string; p_new: string; p_old: string }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

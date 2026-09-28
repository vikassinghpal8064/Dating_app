export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_approvals: {
        Row: {
          created_at: string;
          owner_id: string;
          viewer_id: string;
        };
        Insert: {
          created_at?: string;
          owner_id: string;
          viewer_id: string;
        };
        Update: {
          created_at?: string;
          owner_id?: string;
          viewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_approvals_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'contact_approvals_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_approvals_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_approvals_viewer_id_fkey';
            columns: ['viewer_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'contact_approvals_viewer_id_fkey';
            columns: ['viewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_approvals_viewer_id_fkey';
            columns: ['viewer_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_link_requests: {
        Row: {
          called_at: string;
          user_id: string;
        };
        Insert: {
          called_at?: string;
          user_id: string;
        };
        Update: {
          called_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_link_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'contact_link_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contact_link_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      likes: {
        Row: {
          created_at: string;
          liked_id: string;
          liker_id: string;
          type: Database['public']['Enums']['like_type'];
        };
        Insert: {
          created_at?: string;
          liked_id: string;
          liker_id: string;
          type?: Database['public']['Enums']['like_type'];
        };
        Update: {
          created_at?: string;
          liked_id?: string;
          liker_id?: string;
          type?: Database['public']['Enums']['like_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'likes_liked_id_fkey';
            columns: ['liked_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'likes_liked_id_fkey';
            columns: ['liked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_liked_id_fkey';
            columns: ['liked_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_liker_id_fkey';
            columns: ['liker_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'likes_liker_id_fkey';
            columns: ['liker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_liker_id_fkey';
            columns: ['liker_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string | null;
          matched_user_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          matched_user_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          matched_user_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_matched_user_id_fkey';
            columns: ['matched_user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'matches_matched_user_id_fkey';
            columns: ['matched_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_matched_user_id_fkey';
            columns: ['matched_user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'matches_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          match_id: string;
          message_type: Database['public']['Enums']['message_type'];
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          match_id: string;
          message_type?: Database['public']['Enums']['message_type'];
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          match_id?: string;
          message_type?: Database['public']['Enums']['message_type'];
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      passes: {
        Row: {
          created_at: string;
          passed_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          passed_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          passed_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'passes_passed_id_fkey';
            columns: ['passed_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'passes_passed_id_fkey';
            columns: ['passed_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passes_passed_id_fkey';
            columns: ['passed_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'passes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      private_contacts: {
        Row: {
          created_at: string;
          share_mode: Database['public']['Enums']['share_mode'];
          updated_at: string;
          user_id: string;
          whatsapp_number: string;
        };
        Insert: {
          created_at?: string;
          share_mode?: Database['public']['Enums']['share_mode'];
          updated_at?: string;
          user_id: string;
          whatsapp_number: string;
        };
        Update: {
          created_at?: string;
          share_mode?: Database['public']['Enums']['share_mode'];
          updated_at?: string;
          user_id?: string;
          whatsapp_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'private_contacts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'private_contacts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'private_contacts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_photos: {
        Row: {
          created_at: string;
          id: string;
          moderation_status: Database['public']['Enums']['moderation_status'];
          position: number;
          storage_path: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          moderation_status?: Database['public']['Enums']['moderation_status'];
          position?: number;
          storage_path: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          moderation_status?: Database['public']['Enums']['moderation_status'];
          position?: number;
          storage_path?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_photos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'profile_photos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_photos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          age_verified: boolean;
          bio: string;
          created_at: string;
          date_of_birth: string | null;
          drinking: string;
          education: string | null;
          email: string | null;
          exercise: string;
          full_name: string | null;
          gender: Database['public']['Enums']['gender'];
          height_cm: number | null;
          id: string;
          interested_in: Database['public']['Enums']['interested_in'][];
          interests: string[];
          is_admin: boolean;
          is_banned: boolean;
          is_verified: boolean;
          is_visible: boolean;
          languages: string[];
          last_active_at: string;
          latitude: number | null;
          location_city: string | null;
          location_country: string | null;
          location_state: string | null;
          longitude: number | null;
          looking_for: Database['public']['Enums']['looking_for'];
          occupation: string | null;
          phone_verified: boolean;
          photos: string[];
          show_distance: boolean;
          smoking: string;
          updated_at: string;
          whatsapp_consent: boolean;
        };
        Insert: {
          age_verified?: boolean;
          bio?: string;
          created_at?: string;
          date_of_birth?: string | null;
          drinking?: string;
          education?: string | null;
          email?: string | null;
          exercise?: string;
          full_name?: string | null;
          gender?: Database['public']['Enums']['gender'];
          height_cm?: number | null;
          id: string;
          interested_in?: Database['public']['Enums']['interested_in'][];
          interests?: string[];
          is_admin?: boolean;
          is_banned?: boolean;
          is_verified?: boolean;
          is_visible?: boolean;
          languages?: string[];
          last_active_at?: string;
          latitude?: number | null;
          location_city?: string | null;
          location_country?: string | null;
          location_state?: string | null;
          longitude?: number | null;
          looking_for?: Database['public']['Enums']['looking_for'];
          occupation?: string | null;
          phone_verified?: boolean;
          photos?: string[];
          show_distance?: boolean;
          smoking?: string;
          updated_at?: string;
          whatsapp_consent?: boolean;
        };
        Update: {
          age_verified?: boolean;
          bio?: string;
          created_at?: string;
          date_of_birth?: string | null;
          drinking?: string;
          education?: string | null;
          email?: string | null;
          exercise?: string;
          full_name?: string | null;
          gender?: Database['public']['Enums']['gender'];
          height_cm?: number | null;
          id?: string;
          interested_in?: Database['public']['Enums']['interested_in'][];
          interests?: string[];
          is_admin?: boolean;
          is_banned?: boolean;
          is_verified?: boolean;
          is_visible?: boolean;
          languages?: string[];
          last_active_at?: string;
          latitude?: number | null;
          location_city?: string | null;
          location_country?: string | null;
          location_state?: string | null;
          longitude?: number | null;
          looking_for?: Database['public']['Enums']['looking_for'];
          occupation?: string | null;
          phone_verified?: boolean;
          photos?: string[];
          show_distance?: boolean;
          smoking?: string;
          updated_at?: string;
          whatsapp_consent?: boolean;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database['public']['Enums']['report_reason'];
          reported_id: string;
          reporter_id: string;
          status: Database['public']['Enums']['report_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database['public']['Enums']['report_reason'];
          reported_id: string;
          reporter_id: string;
          status?: Database['public']['Enums']['report_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database['public']['Enums']['report_reason'];
          reported_id?: string;
          reporter_id?: string;
          status?: Database['public']['Enums']['report_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reported_id_fkey';
            columns: ['reported_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'reports_reported_id_fkey';
            columns: ['reported_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reported_id_fkey';
            columns: ['reported_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_preferences: {
        Row: {
          created_at: string;
          max_age: number;
          max_distance_km: number;
          min_age: number;
          notifications: NonNullable<Json>;
          privacy: NonNullable<Json>;
          show_me_to: Database['public']['Enums']['show_me_to'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          max_age?: number;
          max_distance_km?: number;
          min_age?: number;
          notifications?: NonNullable<Json>;
          privacy?: NonNullable<Json>;
          show_me_to?: Database['public']['Enums']['show_me_to'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          max_age?: number;
          max_distance_km?: number;
          min_age?: number;
          notifications?: NonNullable<Json>;
          privacy?: NonNullable<Json>;
          show_me_to?: Database['public']['Enums']['show_me_to'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          granted_by: string | null;
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['user_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      whatsapp_consents: {
        Row: {
          id: string;
          matched_user_id: string;
          requested_at: string;
          responded_at: string | null;
          status: Database['public']['Enums']['whatsapp_consent_status'];
          user_id: string;
        };
        Insert: {
          id?: string;
          matched_user_id: string;
          requested_at?: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['whatsapp_consent_status'];
          user_id: string;
        };
        Update: {
          id?: string;
          matched_user_id?: string;
          requested_at?: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['whatsapp_consent_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'whatsapp_consents_matched_user_id_fkey';
            columns: ['matched_user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'whatsapp_consents_matched_user_id_fkey';
            columns: ['matched_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'whatsapp_consents_matched_user_id_fkey';
            columns: ['matched_user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'whatsapp_consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'likes_received';
            referencedColumns: ['liker_id'];
          },
          {
            foreignKeyName: 'whatsapp_consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'whatsapp_consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      likes_received: {
        Row: {
          age: number;
          bio: string;
          distance_km: number | null;
          full_name: string;
          gender: string;
          interested_in: string[];
          is_online: boolean;
          last_active: string;
          like_type: Database['public']['Enums']['like_type'];
          liked_at: string;
          liker_id: string;
          location_city: string;
          location_country: string;
          photos: string[];
        };
        Relationships: [];
      };
      public_profiles: {
        Row: {
          age: number;
          bio: string;
          distance_km: number | null;
          full_name: string;
          gender: string;
          id: string;
          interested_in: string[];
          is_online: boolean;
          last_active: string;
          location_city: string;
          location_country: string;
          photos: string[];
        };
        Relationships: [];
      };
    };
    Functions: {
      calculate_age: { Args: { date_of_birth: string }; Returns: number };
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number };
        Returns: number;
      };
      get_contact_link: { Args: { target_user_id: string }; Returns: string };
      get_contact_number: { Args: { viewer_id: string }; Returns: string };
      get_potential_matches: {
        Args: { limit_count?: number; offset_count?: number; user_id: string };
        Returns: {
          age: number | null;
          bio: string | null;
          distance_km: number | null;
          full_name: string | null;
          gender: string | null;
          id: string | null;
          interested_in: string[] | null;
          is_online: boolean | null;
          last_active: string | null;
          location_city: string | null;
          location_country: string | null;
          photos: string[] | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'public_profiles';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_blocked_pair: { Args: { a: string; b: string }; Returns: boolean };
      is_e164: { Args: { value: string }; Returns: boolean };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_plain_name: { Args: { value: string }; Returns: boolean };
      photo_urls_are_https: { Args: { urls: string[] }; Returns: boolean };
      request_whatsapp: {
        Args: { matched_user_id: string; whatsapp_number: string };
        Returns: {
          id: string;
          matched_user_id: string;
          requested_at: string;
          responded_at: string | null;
          status: Database['public']['Enums']['whatsapp_consent_status'];
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'whatsapp_consents';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      respond_whatsapp_request: {
        Args: {
          consent_id: string;
          status: Database['public']['Enums']['whatsapp_consent_status'];
        };
        Returns: {
          id: string;
          matched_user_id: string;
          requested_at: string;
          responded_at: string | null;
          status: Database['public']['Enums']['whatsapp_consent_status'];
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'whatsapp_consents';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      search_profiles_by_distance: {
        Args: {
          limit_count?: number;
          offset_count?: number;
          radius_km?: number;
          search_lat: number;
          search_lng: number;
        };
        Returns: {
          age: number;
          bio: string;
          distance_km: number;
          full_name: string;
          gender: string;
          id: string;
          interested_in: string[];
          is_online: boolean;
          last_active: string;
          location_city: string;
          location_country: string;
          photos: string[];
        }[];
      };
    };
    Enums: {
      gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
      interested_in: 'male' | 'female' | 'non_binary' | 'everyone';
      like_type: 'like' | 'super_like';
      looking_for: 'casual' | 'serious' | 'friends' | 'unsure';
      message_type: 'text' | 'image' | 'whatsapp_request';
      moderation_status: 'pending' | 'approved' | 'rejected';
      report_reason:
        'harassment' | 'spam' | 'impersonation' | 'nudity' | 'underage' | 'violence' | 'other';
      report_status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
      share_mode: 'never' | 'matches' | 'approved';
      show_me_to: 'everyone' | 'interested_in_me' | 'matches_only';
      user_role: 'admin' | 'moderator';
      whatsapp_consent_status: 'pending' | 'approved' | 'declined' | 'revoked';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      gender: ['male', 'female', 'non_binary', 'prefer_not_to_say'],
      interested_in: ['male', 'female', 'non_binary', 'everyone'],
      like_type: ['like', 'super_like'],
      looking_for: ['casual', 'serious', 'friends', 'unsure'],
      message_type: ['text', 'image', 'whatsapp_request'],
      moderation_status: ['pending', 'approved', 'rejected'],
      report_reason: [
        'harassment',
        'spam',
        'impersonation',
        'nudity',
        'underage',
        'violence',
        'other',
      ],
      report_status: ['open', 'reviewing', 'actioned', 'dismissed'],
      share_mode: ['never', 'matches', 'approved'],
      show_me_to: ['everyone', 'interested_in_me', 'matches_only'],
      user_role: ['admin', 'moderator'],
      whatsapp_consent_status: ['pending', 'approved', 'declined', 'revoked'],
    },
  },
} as const;

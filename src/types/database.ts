
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"admin_id": string,"created_at": string,"details": Json | null,"id": string,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id": string,"created_at"?: string,"details"?: Json | null,"id"?: string,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string,"created_at"?: string,"details"?: Json | null,"id"?: string,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "admin_audit_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "admin_audit_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_audit_log_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_audit_log_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "admin_audit_log_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "admin_audit_log_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admin_audit_log_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocked_email_domains": {
                  Row: {
                    "created_at": string,"domain": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain": string,"id"?: string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"city_coordinates": {
                  Row: {
                    "city": string,"country": string,"latitude": number,"longitude": number
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"country"?: string,"latitude": number,"longitude": number
                  }
                  Update: {
                    "city"?: string,"country"?: string,"latitude"?: number,"longitude"?: number
                  }
                  Relationships: [
                    
                  ]
                },"contact_access_log": {
                  Row: {
                    "created_at": string,"id": string,"owner_id": string,"viewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"owner_id": string,"viewer_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"owner_id"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_access_log_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_access_log_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_access_log_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_access_log_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_access_log_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_access_log_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_access_log_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_access_log_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_approvals": {
                  Row: {
                    "created_at": string,"owner_id": string,"viewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"owner_id": string,"viewer_id": string
                  }
                  Update: {
                    "created_at"?: string,"owner_id"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_approvals_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_approvals_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_approvals_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_approvals_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_approvals_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_approvals_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_approvals_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_approvals_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_link_requests": {
                  Row: {
                    "called_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "called_at"?: string,"user_id": string
                  }
                  Update: {
                    "called_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_link_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_link_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_link_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_link_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_requests": {
                  Row: {
                    "created_at": string,"id": string,"owner_id": string,"requester_id": string,"status": Database["public"]['Enums']["contact_request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"owner_id": string,"requester_id": string,"status"?: Database["public"]['Enums']["contact_request_status"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"owner_id"?: string,"requester_id"?: string,"status"?: Database["public"]['Enums']["contact_request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_requests_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_requests_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_requests_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_requests_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "contact_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "contact_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"likes": {
                  Row: {
                    "created_at": string,"liked_id": string,"liker_id": string,"type": Database["public"]['Enums']["like_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"liked_id": string,"liker_id": string,"type"?: Database["public"]['Enums']["like_type"]
                  }
                  Update: {
                    "created_at"?: string,"liked_id"?: string,"liker_id"?: string,"type"?: Database["public"]['Enums']["like_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "likes_liked_id_fkey"
      columns: ["liked_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "likes_liked_id_fkey"
      columns: ["liked_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "likes_liked_id_fkey"
      columns: ["liked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_liked_id_fkey"
      columns: ["liked_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_liker_id_fkey"
      columns: ["liker_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "likes_liker_id_fkey"
      columns: ["liker_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "likes_liker_id_fkey"
      columns: ["liker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_liker_id_fkey"
      columns: ["liker_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "created_at": string,"id": string,"last_message_at": string | null,"matched_user_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string | null,"matched_user_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string | null,"matched_user_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "matches_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "matches_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "matches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "matches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"member_photos": {
                  Row: {
                    "created_at": string,"id": string,"moderation_status": Database["public"]['Enums']["moderation_status"],"position": number,"storage_path": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"position"?: number,"storage_path": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"position"?: number,"storage_path"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "member_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "member_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"match_id": string,"message_type": Database["public"]['Enums']["message_type"],"read_at": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"match_id": string,"message_type"?: Database["public"]['Enums']["message_type"],"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"match_id"?: string,"message_type"?: Database["public"]['Enums']["message_type"],"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"passes": {
                  Row: {
                    "created_at": string,"passed_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"passed_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"passed_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "passes_passed_id_fkey"
      columns: ["passed_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "passes_passed_id_fkey"
      columns: ["passed_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "passes_passed_id_fkey"
      columns: ["passed_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passes_passed_id_fkey"
      columns: ["passed_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "passes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "passes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"private_contacts": {
                  Row: {
                    "created_at": string,"share_mode": Database["public"]['Enums']["share_mode"],"updated_at": string,"user_id": string,"whatsapp_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"share_mode"?: Database["public"]['Enums']["share_mode"],"updated_at"?: string,"user_id": string,"whatsapp_number": string
                  }
                  Update: {
                    "created_at"?: string,"share_mode"?: Database["public"]['Enums']["share_mode"],"updated_at"?: string,"user_id"?: string,"whatsapp_number"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "private_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "private_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "private_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "private_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_photos": {
                  Row: {
                    "created_at": string,"id": string,"moderation_status": Database["public"]['Enums']["moderation_status"],"position": number,"storage_path": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"position"?: number,"storage_path": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"moderation_status"?: Database["public"]['Enums']["moderation_status"],"position"?: number,"storage_path"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "profile_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "profile_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "age_verified": boolean,"bio": string,"created_at": string,"date_of_birth": string | null,"drinking": string,"education": string | null,"email": string | null,"exercise": string,"full_name": string | null,"gender": Database["public"]['Enums']["gender"],"height_cm": number | null,"id": string,"incognito": boolean,"interested_in": (Database["public"]['Enums']["interested_in"])[],"interests": (string)[],"is_admin": boolean,"is_banned": boolean,"is_verified": boolean,"is_visible": boolean,"languages": (string)[],"last_active_at": string,"latitude": number | null,"location_city": string | null,"location_country": string | null,"location_state": string | null,"longitude": number | null,"looking_for": Database["public"]['Enums']["looking_for"],"occupation": string | null,"phone_verified": boolean,"photos": (string)[],"profile_paused": boolean,"show_distance": boolean,"smoking": string,"updated_at": string,"whatsapp_consent": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "age_verified"?: boolean,"bio"?: string,"created_at"?: string,"date_of_birth"?: string | null,"drinking"?: string,"education"?: string | null,"email"?: string | null,"exercise"?: string,"full_name"?: string | null,"gender"?: Database["public"]['Enums']["gender"],"height_cm"?: number | null,"id": string,"incognito"?: boolean,"interested_in"?: (Database["public"]['Enums']["interested_in"])[],"interests"?: (string)[],"is_admin"?: boolean,"is_banned"?: boolean,"is_verified"?: boolean,"is_visible"?: boolean,"languages"?: (string)[],"last_active_at"?: string,"latitude"?: number | null,"location_city"?: string | null,"location_country"?: string | null,"location_state"?: string | null,"longitude"?: number | null,"looking_for"?: Database["public"]['Enums']["looking_for"],"occupation"?: string | null,"phone_verified"?: boolean,"photos"?: (string)[],"profile_paused"?: boolean,"show_distance"?: boolean,"smoking"?: string,"updated_at"?: string,"whatsapp_consent"?: boolean
                  }
                  Update: {
                    "age_verified"?: boolean,"bio"?: string,"created_at"?: string,"date_of_birth"?: string | null,"drinking"?: string,"education"?: string | null,"email"?: string | null,"exercise"?: string,"full_name"?: string | null,"gender"?: Database["public"]['Enums']["gender"],"height_cm"?: number | null,"id"?: string,"incognito"?: boolean,"interested_in"?: (Database["public"]['Enums']["interested_in"])[],"interests"?: (string)[],"is_admin"?: boolean,"is_banned"?: boolean,"is_verified"?: boolean,"is_visible"?: boolean,"languages"?: (string)[],"last_active_at"?: string,"latitude"?: number | null,"location_city"?: string | null,"location_country"?: string | null,"location_state"?: string | null,"longitude"?: number | null,"looking_for"?: Database["public"]['Enums']["looking_for"],"occupation"?: string | null,"phone_verified"?: boolean,"photos"?: (string)[],"profile_paused"?: boolean,"show_distance"?: boolean,"smoking"?: string,"updated_at"?: string,"whatsapp_consent"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": Database["public"]['Enums']["report_reason"],"reported_id": string,"reporter_id": string,"status": Database["public"]['Enums']["report_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": Database["public"]['Enums']["report_reason"],"reported_id": string,"reporter_id": string,"status"?: Database["public"]['Enums']["report_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: Database["public"]['Enums']["report_reason"],"reported_id"?: string,"reporter_id"?: string,"status"?: Database["public"]['Enums']["report_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reported_id_fkey"
      columns: ["reported_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "reports_reported_id_fkey"
      columns: ["reported_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "reports_reported_id_fkey"
      columns: ["reported_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reported_id_fkey"
      columns: ["reported_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "created_at": string,"max_age": number,"max_distance_km": number,"min_age": number,"notifications": NonNullable<Json>,"privacy": NonNullable<Json>,"show_me_to": Database["public"]['Enums']["show_me_to"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"max_age"?: number,"max_distance_km"?: number,"min_age"?: number,"notifications"?: NonNullable<Json>,"privacy"?: NonNullable<Json>,"show_me_to"?: Database["public"]['Enums']["show_me_to"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"max_age"?: number,"max_distance_km"?: number,"min_age"?: number,"notifications"?: NonNullable<Json>,"privacy"?: NonNullable<Json>,"show_me_to"?: Database["public"]['Enums']["show_me_to"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["user_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_requests": {
                  Row: {
                    "created_at": string,"id": string,"pose_prompt": string,"reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["verification_status"],"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"pose_prompt": string,"reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"storage_path": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"pose_prompt"?: string,"reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "verification_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "verification_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_consents": {
                  Row: {
                    "id": string,"matched_user_id": string,"requested_at": string,"responded_at": string | null,"status": Database["public"]['Enums']["whatsapp_consent_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"matched_user_id": string,"requested_at"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["whatsapp_consent_status"],"user_id": string
                  }
                  Update: {
                    "id"?: string,"matched_user_id"?: string,"requested_at"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["whatsapp_consent_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_consents_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "whatsapp_consents_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "whatsapp_consents_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_consents_matched_user_id_fkey"
      columns: ["matched_user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_received"
      referencedColumns: ["liker_id"]
    },{
      foreignKeyName: "whatsapp_consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "likes_sent"
      referencedColumns: ["liked_id"]
    },{
      foreignKeyName: "whatsapp_consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "likes_received": {
                  Row: {
                    "age": number | null,"bio": string,"distance_km": number | null,"full_name": string | null,"gender": string | null,"interested_in": (string)[] | null,"is_online": boolean | null,"last_active": string | null,"like_type": Database["public"]['Enums']["like_type"],"liked_at": string,"liker_id": string,"location_city": string | null,"location_country": string | null,"photos": (string)[]
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"likes_sent": {
                  Row: {
                    "age": number | null,"bio": string,"distance_km": number | null,"full_name": string | null,"gender": string | null,"interested_in": (string)[] | null,"is_online": boolean | null,"last_active": string | null,"like_type": Database["public"]['Enums']["like_type"],"liked_at": string,"liked_id": string,"location_city": string | null,"location_country": string | null,"photos": (string)[]
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"public_profiles": {
                  Row: {
                    "age": number | null,"bio": string,"distance_km": number | null,"full_name": string | null,"gender": string | null,"id": string,"interested_in": (string)[] | null,"is_online": boolean | null,"last_active": string | null,"location_city": string | null,"location_country": string | null,"photos": (string)[]
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_ban_user":
{ Args: { "p_reason": string,"p_user": string }; Returns: undefined
                           },
"admin_dashboard_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_get_conversation":
{ Args: { "p_limit"?: number,"p_match": string }; Returns: Json
                           },
"admin_get_photos_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"moderation_status": Database["public"]['Enums']["moderation_status"],"photo_position": number,"storage_path": string,"user_id": string,"user_profile": Json
            }[]
                           },
"admin_get_reports_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"details": string,"id": string,"reason": Database["public"]['Enums']["report_reason"],"reported_id": string,"reported_profile": Json,"reporter_id": string,"status": Database["public"]['Enums']["report_status"]
            }[]
                           },
"admin_get_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_get_user":
{ Args: { "p_user": string }; Returns: Json
                           },
"admin_get_verification_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"pose_prompt": string,"status": Database["public"]['Enums']["verification_status"],"storage_path": string,"user_id": string,"user_profile": Json
            }[]
                           },
"admin_list_conversations":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query"?: string }; Returns: {
              "last_message_at": string,"last_message_preview": string,"last_sender_name": string,"match_id": string,"matched_at": string,"message_count": number,"unread_count": number,"user_a_id": string,"user_a_name": string,"user_b_id": string,"user_b_name": string
            }[]
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query"?: string }; Returns: {
              "age": number,"approved_uploads": number,"created_at": string,"email": string,"full_name": string,"gender": string,"id": string,"incognito": boolean,"is_admin": boolean,"is_banned": boolean,"is_verified": boolean,"is_visible": boolean,"last_active_at": string,"likes_sent": number,"location_city": string,"location_country": string,"matches_count": number,"messages_sent": number,"photos_count": number,"profile_paused": boolean,"reports_against": number,"verification_status": string
            }[]
                           },
"admin_reveal_contact":
{ Args: { "p_user": string }; Returns: Json
                           },
"admin_review_photo":
{ Args: { "p_approve": boolean,"p_photo": string,"p_reason": string }; Returns: undefined
                           },
"admin_review_verification":
{ Args: { "p_approve": boolean,"p_reason": string,"p_request": string }; Returns: undefined
                           },
"admin_search_messages":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "content": string,"created_at": string,"match_id": string,"message_id": string,"message_type": string,"read_at": string,"recipient_name": string,"sender_id": string,"sender_name": string
            }[]
                           },
"admin_search_users":
{ Args: { "p_query": string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"id": string,"is_banned": boolean,"is_verified": boolean
            }[]
                           },
"admin_set_report_status":
{ Args: { "p_report": string,"p_status": string }; Returns: undefined
                           },
"admin_unban_user":
{ Args: { "p_user": string }; Returns: undefined
                           },
"calculate_age":
{ Args: { "date_of_birth": string }; Returns: number
                           },
"calculate_distance":
{ Args: { "lat1": number,"lat2": number,"lon1": number,"lon2": number }; Returns: number
                           },
"delete_member_photo":
{ Args: { "photo_id": string }; Returns: undefined
                           },
"distance_bucket":
{ Args: { "distance_km": number }; Returns: string
                           },
"flag_suspicious_message":
{ Args: { "body": string }; Returns: boolean
                           },
"get_contact_link":
{ Args: { "target_user_id": string }; Returns: string
                           },
"get_contact_number":
{ Args: { "viewer_id": string }; Returns: string
                           },
"get_discover_candidates":
{ Args: { "limit_count"?: number,"offset_count"?: number }; Returns: {
              "age": number,"bio": string,"distance_bucket": string,"full_name": string,"gender": string,"height_cm": number,"id": string,"interested_in": (string)[],"interests": (string)[],"is_online": boolean,"is_verified": boolean,"last_active": string,"location_city": string,"location_country": string,"looking_for": string,"photos": (string)[]
            }[]
                           },
"get_potential_matches":
{ Args: { "limit_count"?: number,"offset_count"?: number,"user_id": string }; Returns: {
              "age": number | null,
"bio": string,
"distance_km": number | null,
"full_name": string | null,
"gender": string | null,
"id": string,
"interested_in": (string)[] | null,
"is_online": boolean | null,
"last_active": string | null,
"location_city": string | null,
"location_country": string | null,
"photos": (string)[]
            }[]
                          SetofOptions: {
        from: "*"
        to: "public_profiles"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_profile":
{ Args: { "target_id": string }; Returns: {
              "age": number,"bio": string,"contact_can_request": boolean,"distance_bucket": string,"drinking": string,"education": string,"exercise": string,"full_name": string,"gender": string,"height_cm": number,"id": string,"interested_in": (string)[],"interests": (string)[],"is_match": boolean,"is_online": boolean,"is_verified": boolean,"languages": (string)[],"last_active": string,"liked_viewer": boolean,"location_city": string,"location_country": string,"looking_for": string,"match_id": string,"occupation": string,"photos": (string)[],"smoking": string,"viewer_liked_type": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_pair":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"is_e164":
{ Args: { "value": string }; Returns: boolean
                           },
"is_email_domain_blocked":
{ Args: { "email_address": string }; Returns: boolean
                           },
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_plain_name":
{ Args: { "value": string }; Returns: boolean
                           },
"list_matches":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"last_message": string,"last_message_at": string,"match_id": string,"partner": Database["public"]['Views']["public_profiles"]['Row'],"unread_count": number
            }[]
                           },
"mark_messages_read":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"member_photo_passes_auto_checks":
{ Args: { "photo_path": string }; Returns: boolean
                           },
"photo_urls_are_https":
{ Args: { "urls": (string)[] }; Returns: boolean
                           },
"record_member_photo":
{ Args: { "photo_path": string }; Returns: {
              "created_at": string,
"id": string,
"moderation_status": Database["public"]['Enums']["moderation_status"],
"position": number,
"storage_path": string,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "member_photos"
        isOneToOne: true
        isSetofReturn: false
      } },
"reorder_member_photos":
{ Args: { "photo_ids": (string)[],"positions": (number)[] }; Returns: undefined
                           },
"request_contact":
{ Args: { "p_owner": string }; Returns: undefined
                           },
"request_whatsapp":
{ Args: { "matched_user_id": string,"whatsapp_number": string }; Returns: {
              "id": string,
"matched_user_id": string,
"requested_at": string,
"responded_at": string | null,
"status": Database["public"]['Enums']["whatsapp_consent_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "whatsapp_consents"
        isOneToOne: true
        isSetofReturn: false
      } },
"respond_contact_request":
{ Args: { "p_approve": boolean,"p_request": string }; Returns: undefined
                           },
"respond_whatsapp_request":
{ Args: { "consent_id": string,"status": Database["public"]['Enums']["whatsapp_consent_status"] }; Returns: {
              "id": string,
"matched_user_id": string,
"requested_at": string,
"responded_at": string | null,
"status": Database["public"]['Enums']["whatsapp_consent_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "whatsapp_consents"
        isOneToOne: true
        isSetofReturn: false
      } },
"revoke_all_contact_access":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"search_profiles":
{ Args: { "city_name"?: string,"genders"?: (string)[],"height_max_cm"?: number,"height_min_cm"?: number,"interest_values"?: (string)[],"limit_count"?: number,"looking_for_values"?: (string)[],"max_age"?: number,"min_age"?: number,"offset_count"?: number,"online_only"?: boolean,"radius_km"?: number,"search_lat"?: number,"search_lng"?: number,"verified_only"?: boolean }; Returns: {
              "age": number,"bio": string,"distance_bucket": string,"full_name": string,"gender": string,"height_cm": number,"id": string,"interested_in": (string)[],"interests": (string)[],"is_online": boolean,"is_verified": boolean,"last_active": string,"location_city": string,"location_country": string,"looking_for": string,"photos": (string)[]
            }[]
                           },
"search_profiles_by_distance":
{ Args: { "limit_count"?: number,"offset_count"?: number,"radius_km"?: number,"search_lat": number,"search_lng": number }; Returns: {
              "age": number,"bio": string,"distance_km": number,"full_name": string,"gender": string,"id": string,"interested_in": (string)[],"is_online": boolean,"last_active": string,"location_city": string,"location_country": string,"photos": (string)[]
            }[]
                           },
"send_like":
{ Args: { "like_kind"?: Database["public"]['Enums']["like_type"],"target_user_id": string }; Returns: {
              "created_at": string,"match_id": string,"matched": boolean
            }[]
                           },
"send_pass":
{ Args: { "target_user_id": string }; Returns: undefined
                           },
"set_member_photo_moderation":
{ Args: { "next_status": Database["public"]['Enums']["moderation_status"],"photo_id": string }; Returns: undefined
                           },
"unmatch":
{ Args: { "p_match_id": string }; Returns: undefined
                           },
"unread_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "new_likes": number,"unread_messages": number
            }[]
                           },
"write_admin_audit_log":
{ Args: { "p_action": string,"p_details"?: Json,"p_target_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "contact_request_status": "pending"|"approved"|"declined","gender": "male"|"female"|"non_binary"|"prefer_not_to_say","interested_in": "male"|"female"|"non_binary"|"everyone","like_type": "like"|"super_like","looking_for": "casual"|"serious"|"friends"|"unsure","message_type": "text"|"image"|"whatsapp_request","moderation_status": "pending"|"approved"|"rejected","report_reason": "fake_profile"|"harassment"|"scam"|"inappropriate_photos"|"underage"|"solicitation"|"other","report_status": "open"|"reviewing"|"actioned"|"dismissed","share_mode": "never"|"matches"|"approved","show_me_to": "everyone"|"interested_in_me"|"matches_only","user_role": "admin"|"moderator","verification_status": "pending"|"approved"|"rejected","whatsapp_consent_status": "pending"|"approved"|"declined"|"revoked"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "contact_request_status": ["pending", "approved", "declined"],"gender": ["male", "female", "non_binary", "prefer_not_to_say"],"interested_in": ["male", "female", "non_binary", "everyone"],"like_type": ["like", "super_like"],"looking_for": ["casual", "serious", "friends", "unsure"],"message_type": ["text", "image", "whatsapp_request"],"moderation_status": ["pending", "approved", "rejected"],"report_reason": ["fake_profile", "harassment", "scam", "inappropriate_photos", "underage", "solicitation", "other"],"report_status": ["open", "reviewing", "actioned", "dismissed"],"share_mode": ["never", "matches", "approved"],"show_me_to": ["everyone", "interested_in_me", "matches_only"],"user_role": ["admin", "moderator"],"verification_status": ["pending", "approved", "rejected"],"whatsapp_consent_status": ["pending", "approved", "declined", "revoked"]
          }
        }
} as const

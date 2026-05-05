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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_files: {
        Row: {
          asset_id: string
          bucket: string
          checksum: string | null
          created_at: string
          object_path: string
          original_filename: string
          public_id: string | null
          public_url: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          bucket?: string
          checksum?: string | null
          created_at?: string
          object_path: string
          original_filename: string
          public_id?: string | null
          public_url?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          bucket?: string
          checksum?: string | null
          created_at?: string
          object_path?: string
          original_filename?: string
          public_id?: string | null
          public_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_files_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          public_id: string | null
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          public_id?: string | null
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          public_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_folders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_videos: {
        Row: {
          aspect_ratio: string | null
          asset_id: string
          created_at: string
          duration_seconds: number | null
          fps: number | null
          gumlet_asset_id: string
          gumlet_source_id: string | null
          height: number | null
          original_size_bytes: number | null
          playback_url: string | null
          processing_meta: Json | null
          progress_pct: number
          public_id: string | null
          subtitles_status: string | null
          thumbnail_url: string | null
          transcription_json: Json | null
          updated_at: string
          width: number | null
        }
        Insert: {
          aspect_ratio?: string | null
          asset_id: string
          created_at?: string
          duration_seconds?: number | null
          fps?: number | null
          gumlet_asset_id: string
          gumlet_source_id?: string | null
          height?: number | null
          original_size_bytes?: number | null
          playback_url?: string | null
          processing_meta?: Json | null
          progress_pct?: number
          public_id?: string | null
          subtitles_status?: string | null
          thumbnail_url?: string | null
          transcription_json?: Json | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          aspect_ratio?: string | null
          asset_id?: string
          created_at?: string
          duration_seconds?: number | null
          fps?: number | null
          gumlet_asset_id?: string
          gumlet_source_id?: string | null
          height?: number | null
          original_size_bytes?: number | null
          playback_url?: string | null
          processing_meta?: Json | null
          progress_pct?: number
          public_id?: string | null
          subtitles_status?: string | null
          thumbnail_url?: string | null
          transcription_json?: Json | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_videos_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          folder_id: string | null
          id: string
          mime_type: string | null
          public_id: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["asset_status"]
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          public_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          tenant_id: string
          title: string
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          public_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          tenant_id?: string
          title?: string
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          allow_discount_codes: boolean
          collect_address: boolean
          collect_fiscal_id: boolean
          collect_phone: boolean
          confirmation_message: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          price_id: string
          product_id: string
          public_id: string | null
          smart_id: string
          status: Database["public"]["Enums"]["checkout_status"]
          success_url: string | null
          tenant_id: string
          title: string | null
          total_orders: number
          updated_at: string
        }
        Insert: {
          allow_discount_codes?: boolean
          collect_address?: boolean
          collect_fiscal_id?: boolean
          collect_phone?: boolean
          confirmation_message?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          price_id: string
          product_id: string
          public_id?: string | null
          smart_id: string
          status?: Database["public"]["Enums"]["checkout_status"]
          success_url?: string | null
          tenant_id: string
          title?: string | null
          total_orders?: number
          updated_at?: string
        }
        Update: {
          allow_discount_codes?: boolean
          collect_address?: boolean
          collect_fiscal_id?: boolean
          collect_phone?: boolean
          confirmation_message?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          price_id?: string
          product_id?: string
          public_id?: string | null
          smart_id?: string
          status?: Database["public"]["Enums"]["checkout_status"]
          success_url?: string | null
          tenant_id?: string
          title?: string | null
          total_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cnae_mcc: {
        Row: {
          cnae: string
          cnae_activity: string
          id: number
          mcc: string
          mcc_activity: string
          status: string
        }
        Insert: {
          cnae: string
          cnae_activity: string
          id?: number
          mcc: string
          mcc_activity: string
          status: string
        }
        Update: {
          cnae?: string
          cnae_activity?: string
          id?: number
          mcc?: string
          mcc_activity?: string
          status?: string
        }
        Relationships: []
      }
      course_customers: {
        Row: {
          course_id: string
          created_at: string
          id: string
          public_id: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          public_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          public_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_customers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: Database["public"]["Enums"]["course_category"] | null
          cover_horizontal_url: string | null
          cover_vertical_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          public_id: string | null
          slug: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["course_category"] | null
          cover_horizontal_url?: string | null
          cover_vertical_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          public_id?: string | null
          slug: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["course_category"] | null
          cover_horizontal_url?: string | null
          cover_vertical_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          public_id?: string | null
          slug?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_signup_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      customer_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_count: number
          error_count: number
          filename: string | null
          id: string
          import_type: string
          imported_by: string
          orders_created_count: number
          result: Json | null
          skipped_count: number
          status: string
          tenant_id: string
          total_rows: number
          updated_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          error_count?: number
          filename?: string | null
          id?: string
          import_type?: string
          imported_by: string
          orders_created_count?: number
          result?: Json | null
          skipped_count?: number
          status?: string
          tenant_id: string
          total_rows?: number
          updated_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          error_count?: number
          filename?: string | null
          id?: string
          import_type?: string
          imported_by?: string
          orders_created_count?: number
          result?: Json | null
          skipped_count?: number
          status?: string
          tenant_id?: string
          total_rows?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          currency: string
          document: string | null
          document_type: string | null
          email: string
          email_marketing_status: Database["public"]["Enums"]["email_marketing_status"]
          external_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mrr_cents: number
          name: string | null
          phone: string | null
          phone_country_code: string | null
          public_id: string | null
          region: string | null
          tenant_id: string
          total_revenue_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          document?: string | null
          document_type?: string | null
          email: string
          email_marketing_status?: Database["public"]["Enums"]["email_marketing_status"]
          external_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mrr_cents?: number
          name?: string | null
          phone?: string | null
          phone_country_code?: string | null
          public_id?: string | null
          region?: string | null
          tenant_id: string
          total_revenue_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          document?: string | null
          document_type?: string | null
          email?: string
          email_marketing_status?: Database["public"]["Enums"]["email_marketing_status"]
          external_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mrr_cents?: number
          name?: string | null
          phone?: string | null
          phone_country_code?: string | null
          public_id?: string | null
          region?: string | null
          tenant_id?: string
          total_revenue_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          created_at: string
          editor_state: Json | null
          error_message: string | null
          from_email: string
          from_name: string
          html: string
          id: string
          recipient_count: number
          reply_to: string | null
          resend_broadcast_id: string | null
          scheduled_at: string | null
          segment_filter: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["broadcast_status"]
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          editor_state?: Json | null
          error_message?: string | null
          from_email?: string
          from_name?: string
          html?: string
          id?: string
          recipient_count?: number
          reply_to?: string | null
          resend_broadcast_id?: string | null
          scheduled_at?: string | null
          segment_filter?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          subject?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          editor_state?: Json | null
          error_message?: string | null
          from_email?: string
          from_name?: string
          html?: string
          id?: string
          recipient_count?: number
          reply_to?: string | null
          resend_broadcast_id?: string | null
          scheduled_at?: string | null
          segment_filter?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          email_type: Database["public"]["Enums"]["email_log_type"]
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          order_id: string | null
          public_id: string | null
          recipient_email: string
          resend_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_log_status"]
          subject: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          email_type: Database["public"]["Enums"]["email_log_type"]
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          order_id?: string | null
          public_id?: string | null
          recipient_email: string
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_log_status"]
          subject: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          email_type?: Database["public"]["Enums"]["email_log_type"]
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          order_id?: string | null
          public_id?: string | null
          recipient_email?: string
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_log_status"]
          subject?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_events: {
        Row: {
          buyer_email: string | null
          created_at: string
          error_message: string | null
          event_type: string | null
          external_event_type: string | null
          external_offer_id: string | null
          external_order_id: string | null
          id: string
          integration_id: string | null
          next_retry_at: string | null
          processed_at: string | null
          provider: string
          public_id: string | null
          raw_payload: Json
          result: Json | null
          retry_count: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          buyer_email?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          external_event_type?: string | null
          external_offer_id?: string | null
          external_order_id?: string | null
          id?: string
          integration_id?: string | null
          next_retry_at?: string | null
          processed_at?: string | null
          provider: string
          public_id?: string | null
          raw_payload?: Json
          result?: Json | null
          retry_count?: number
          status?: string
          tenant_id?: string | null
        }
        Update: {
          buyer_email?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          external_event_type?: string | null
          external_offer_id?: string | null
          external_order_id?: string | null
          id?: string
          integration_id?: string | null
          next_retry_at?: string | null
          processed_at?: string | null
          provider?: string
          public_id?: string | null
          raw_payload?: Json
          result?: Json | null
          retry_count?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_product_mappings: {
        Row: {
          created_at: string
          external_product_id: string
          external_product_name: string | null
          id: string
          integration_id: string
          product_id: string | null
          provider: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          external_product_id: string
          external_product_name?: string | null
          id?: string
          integration_id: string
          product_id?: string | null
          provider: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          external_product_id?: string
          external_product_name?: string | null
          id?: string
          integration_id?: string
          product_id?: string | null
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_product_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_product_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_count: number
          error_count: number
          errors: Json
          id: string
          integration_id: string
          params: Json
          processed_items: number
          provider: string
          resource_type: string
          skipped_count: number
          started_at: string
          started_by: string | null
          status: string
          tenant_id: string
          total_items: number | null
          updated_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          error_count?: number
          errors?: Json
          id?: string
          integration_id: string
          params?: Json
          processed_items?: number
          provider: string
          resource_type: string
          skipped_count?: number
          started_at?: string
          started_by?: string | null
          status?: string
          tenant_id: string
          total_items?: number | null
          updated_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          error_count?: number
          errors?: Json
          id?: string
          integration_id?: string
          params?: Json
          processed_items?: number
          provider?: string
          resource_type?: string
          skipped_count?: number
          started_at?: string
          started_by?: string | null
          status?: string
          tenant_id?: string
          total_items?: number | null
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "gateway_sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credential_rules: {
        Row: {
          provider: string
          required_keys: string[]
        }
        Insert: {
          provider: string
          required_keys: string[]
        }
        Update: {
          provider?: string
          required_keys?: string[]
        }
        Relationships: []
      }
      lesson_assets: {
        Row: {
          bucket: string
          created_at: string
          filename: string | null
          id: string
          lesson_id: string
          metadata: Json
          mime_type: string | null
          path: string
          public_id: string | null
          size_bytes: number | null
          updated_at: string
        }
        Insert: {
          bucket: string
          created_at?: string
          filename?: string | null
          id?: string
          lesson_id: string
          metadata?: Json
          mime_type?: string | null
          path: string
          public_id?: string | null
          size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          filename?: string | null
          id?: string
          lesson_id?: string
          metadata?: Json
          mime_type?: string | null
          path?: string
          public_id?: string | null
          size_bytes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_assets_link: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          label: string | null
          lesson_id: string
          public_id: string | null
          sort_order: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          label?: string | null
          lesson_id: string
          public_id?: string | null
          sort_order?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          label?: string | null
          lesson_id?: string
          public_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assets_link_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_assets_link_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_blocks: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          payload: Json
          public_id: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          payload?: Json
          public_id?: string | null
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          payload?: Json
          public_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          lesson_id: string
          progress_seconds: number
          public_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          lesson_id: string
          progress_seconds?: number
          public_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          lesson_id?: string
          progress_seconds?: number
          public_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          gumlet_collection_id: string | null
          id: string
          is_public: boolean
          lesson_id: string
          playback_url: string | null
          provider: string
          provider_asset_id: string | null
          provider_payload: Json
          public_id: string | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          gumlet_collection_id?: string | null
          id?: string
          is_public?: boolean
          lesson_id: string
          playback_url?: string | null
          provider?: string
          provider_asset_id?: string | null
          provider_payload?: Json
          public_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          gumlet_collection_id?: string | null
          id?: string
          is_public?: boolean
          lesson_id?: string
          playback_url?: string | null
          provider?: string
          provider_asset_id?: string | null
          provider_payload?: Json
          public_id?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_videos_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          content_mode: string
          created_at: string
          custom_html: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean
          module_id: string
          public_id: string | null
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          content_mode?: string
          created_at?: string
          custom_html?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          module_id: string
          public_id?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          content_mode?: string
          created_at?: string
          custom_html?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          module_id?: string
          public_id?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          public_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          public_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          public_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          checkout_id: string | null
          created_at: string
          currency: string
          customer_id: string
          gateway_external_id: string | null
          gateway_order_created_at: string | null
          gateway_provider: string | null
          id: string
          idempotency_key: string | null
          integration_id: string | null
          is_order_bump: boolean
          order_number: number | null
          parent_gateway_external_id: string | null
          payment_method: string
          price_id: string | null
          product_id: string
          public_id: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          tenant_id: string
          type: Database["public"]["Enums"]["order_type"]
          unit_amount: number
          updated_at: string
        }
        Insert: {
          checkout_id?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          gateway_external_id?: string | null
          gateway_order_created_at?: string | null
          gateway_provider?: string | null
          id?: string
          idempotency_key?: string | null
          integration_id?: string | null
          is_order_bump?: boolean
          order_number?: number | null
          parent_gateway_external_id?: string | null
          payment_method?: string
          price_id?: string | null
          product_id: string
          public_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          tenant_id: string
          type?: Database["public"]["Enums"]["order_type"]
          unit_amount?: number
          updated_at?: string
        }
        Update: {
          checkout_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          gateway_external_id?: string | null
          gateway_order_created_at?: string | null
          gateway_provider?: string | null
          id?: string
          idempotency_key?: string | null
          integration_id?: string | null
          is_order_bump?: boolean
          order_number?: number | null
          parent_gateway_external_id?: string | null
          payment_method?: string
          price_id?: string | null
          product_id?: string
          public_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["order_type"]
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_auth_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          public_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          public_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          public_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      prices: {
        Row: {
          category: Database["public"]["Enums"]["price_category"]
          created_at: string
          currency: string
          id: string
          is_active: boolean
          min_price: number | null
          package_size: number
          product_id: string
          public_id: string | null
          renewal_interval_quantity: number | null
          renewal_interval_unit:
            | Database["public"]["Enums"]["interval_unit"]
            | null
          scheme: Database["public"]["Enums"]["price_scheme"]
          setup_fee: number | null
          setup_fee_enabled: boolean | null
          suggested_price: number | null
          tiers: Json | null
          trial_interval_quantity: number | null
          trial_interval_unit:
            | Database["public"]["Enums"]["interval_unit"]
            | null
          unit_amount: number
          unit_amount_decimal: string | null
          updated_at: string
          usage_aggregation:
            | Database["public"]["Enums"]["usage_aggregation_type"]
            | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["price_category"]
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          min_price?: number | null
          package_size?: number
          product_id: string
          public_id?: string | null
          renewal_interval_quantity?: number | null
          renewal_interval_unit?:
            | Database["public"]["Enums"]["interval_unit"]
            | null
          scheme?: Database["public"]["Enums"]["price_scheme"]
          setup_fee?: number | null
          setup_fee_enabled?: boolean | null
          suggested_price?: number | null
          tiers?: Json | null
          trial_interval_quantity?: number | null
          trial_interval_unit?:
            | Database["public"]["Enums"]["interval_unit"]
            | null
          unit_amount?: number
          unit_amount_decimal?: string | null
          updated_at?: string
          usage_aggregation?:
            | Database["public"]["Enums"]["usage_aggregation_type"]
            | null
        }
        Update: {
          category?: Database["public"]["Enums"]["price_category"]
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          min_price?: number | null
          package_size?: number
          product_id?: string
          public_id?: string | null
          renewal_interval_quantity?: number | null
          renewal_interval_unit?:
            | Database["public"]["Enums"]["interval_unit"]
            | null
          scheme?: Database["public"]["Enums"]["price_scheme"]
          setup_fee?: number | null
          setup_fee_enabled?: boolean | null
          suggested_price?: number | null
          tiers?: Json | null
          trial_interval_quantity?: number | null
          trial_interval_unit?:
            | Database["public"]["Enums"]["interval_unit"]
            | null
          unit_amount?: number
          unit_amount_decimal?: string | null
          updated_at?: string
          usage_aggregation?:
            | Database["public"]["Enums"]["usage_aggregation_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assets: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          product_id: string
          public_id: string | null
          sort_order: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          product_id: string
          public_id?: string | null
          sort_order?: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          product_id?: string
          public_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          product_id: string
          public_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          product_id: string
          public_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          product_id?: string
          public_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string
          sort_order: number
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id: string
          sort_order?: number
          title: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string
          sort_order?: number
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_showcases: {
        Row: {
          created_at: string
          id: string
          product_id: string
          public_id: string | null
          showcase_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          public_id?: string | null
          showcase_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          public_id?: string | null
          showcase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_showcases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_showcases_showcase_id_fkey"
            columns: ["showcase_id"]
            isOneToOne: false
            referencedRelation: "showcases"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          benefit: string | null
          buy_now_url: string | null
          cover_url: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          pay_what_you_want: boolean
          public_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["product_status"]
          tenant_id: string
          test_mode: boolean
          thumb_url: string | null
          unit_amount: number
          updated_at: string
        }
        Insert: {
          benefit?: string | null
          buy_now_url?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          pay_what_you_want?: boolean
          public_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["product_status"]
          tenant_id: string
          test_mode?: boolean
          thumb_url?: string | null
          unit_amount?: number
          updated_at?: string
        }
        Update: {
          benefit?: string | null
          buy_now_url?: string | null
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          pay_what_you_want?: boolean
          public_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["product_status"]
          tenant_id?: string
          test_mode?: boolean
          thumb_url?: string | null
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          instagram: string | null
          name: string | null
          preferences: Json
          public_id: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name?: string | null
          preferences?: Json
          public_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name?: string | null
          preferences?: Json
          public_id?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      public_id_prefixes: {
        Row: {
          prefix: string
          table_name: string
        }
        Insert: {
          prefix: string
          table_name: string
        }
        Update: {
          prefix?: string
          table_name?: string
        }
        Relationships: []
      }
      seller_documents: {
        Row: {
          bucket: string
          category: Database["public"]["Enums"]["seller_document_category"]
          created_at: string
          id: string
          identity_sub_type: string | null
          mime_type: string
          object_path: string
          original_filename: string
          public_id: string | null
          seller_id: string
          size_bytes: number | null
        }
        Insert: {
          bucket?: string
          category: Database["public"]["Enums"]["seller_document_category"]
          created_at?: string
          id?: string
          identity_sub_type?: string | null
          mime_type: string
          object_path: string
          original_filename: string
          public_id?: string | null
          seller_id: string
          size_bytes?: number | null
        }
        Update: {
          bucket?: string
          category?: Database["public"]["Enums"]["seller_document_category"]
          created_at?: string
          id?: string
          identity_sub_type?: string | null
          mime_type?: string
          object_path?: string
          original_filename?: string
          public_id?: string | null
          seller_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_documents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_events: {
        Row: {
          created_at: string
          event_io: string | null
          event_type: string
          external_event_id: string | null
          external_status: string | null
          id: string
          public_id: string | null
          raw_payload: Json | null
          response: Json | null
          seller_id: string | null
          suborganization_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_io?: string | null
          event_type: string
          external_event_id?: string | null
          external_status?: string | null
          id?: string
          public_id?: string | null
          raw_payload?: Json | null
          response?: Json | null
          seller_id?: string | null
          suborganization_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_io?: string | null
          event_type?: string
          external_event_id?: string | null
          external_status?: string | null
          id?: string
          public_id?: string | null
          raw_payload?: Json | null
          response?: Json | null
          seller_id?: string | null
          suborganization_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_fees: {
        Row: {
          created_at: string
          fee_percent: number
          id: string
          public_id: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_percent?: number
          id?: string
          public_id?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_percent?: number
          id?: string
          public_id?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_fees_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          address_city: string | null
          address_country_code: string | null
          address_line1: string | null
          address_line2: string | null
          address_line3: string | null
          address_neighborhood: string | null
          address_postal_code: string | null
          address_state: string | null
          approved_at: string | null
          bank_account: string | null
          bank_account_type: string
          bank_agency: string | null
          bank_code: string | null
          birthdate: string | null
          business_address_city: string | null
          business_address_country_code: string | null
          business_address_line1: string | null
          business_address_line2: string | null
          business_address_line3: string | null
          business_address_neighborhood: string | null
          business_address_postal_code: string | null
          business_address_state: string | null
          business_description: string | null
          business_email: string | null
          business_name: string | null
          business_opening_date: string | null
          business_phone: string | null
          business_website: string | null
          cnae: Json | null
          created_at: string
          created_by: string | null
          ein: string | null
          email: string | null
          external_suborganization_id: string | null
          first_name: string | null
          id: string
          identity_doc_type: string | null
          last_name: string | null
          main_activity: string | null
          mcc: string | null
          phone_number: string | null
          public_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          revenue: number | null
          statement_descriptor: string | null
          status: Database["public"]["Enums"]["seller_status"]
          submitted_at: string | null
          taxpayer_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["seller_type"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country_code?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          address_neighborhood?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          approved_at?: string | null
          bank_account?: string | null
          bank_account_type?: string
          bank_agency?: string | null
          bank_code?: string | null
          birthdate?: string | null
          business_address_city?: string | null
          business_address_country_code?: string | null
          business_address_line1?: string | null
          business_address_line2?: string | null
          business_address_line3?: string | null
          business_address_neighborhood?: string | null
          business_address_postal_code?: string | null
          business_address_state?: string | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_opening_date?: string | null
          business_phone?: string | null
          business_website?: string | null
          cnae?: Json | null
          created_at?: string
          created_by?: string | null
          ein?: string | null
          email?: string | null
          external_suborganization_id?: string | null
          first_name?: string | null
          id?: string
          identity_doc_type?: string | null
          last_name?: string | null
          main_activity?: string | null
          mcc?: string | null
          phone_number?: string | null
          public_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          revenue?: number | null
          statement_descriptor?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          submitted_at?: string | null
          taxpayer_id?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["seller_type"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country_code?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          address_neighborhood?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          approved_at?: string | null
          bank_account?: string | null
          bank_account_type?: string
          bank_agency?: string | null
          bank_code?: string | null
          birthdate?: string | null
          business_address_city?: string | null
          business_address_country_code?: string | null
          business_address_line1?: string | null
          business_address_line2?: string | null
          business_address_line3?: string | null
          business_address_neighborhood?: string | null
          business_address_postal_code?: string | null
          business_address_state?: string | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_opening_date?: string | null
          business_phone?: string | null
          business_website?: string | null
          cnae?: Json | null
          created_at?: string
          created_by?: string | null
          ein?: string | null
          email?: string | null
          external_suborganization_id?: string | null
          first_name?: string | null
          id?: string
          identity_doc_type?: string | null
          last_name?: string | null
          main_activity?: string | null
          mcc?: string | null
          phone_number?: string | null
          public_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          revenue?: number | null
          statement_descriptor?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          submitted_at?: string | null
          taxpayer_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["seller_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_featured: boolean
          public_id: string | null
          showcase_id: string
          sort_order: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_featured?: boolean
          public_id?: string | null
          showcase_id: string
          sort_order?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          public_id?: string | null
          showcase_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "showcase_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_courses_showcase_id_fkey"
            columns: ["showcase_id"]
            isOneToOne: false
            referencedRelation: "showcases"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_customers: {
        Row: {
          created_at: string
          id: string
          public_id: string | null
          showcase_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_id?: string | null
          showcase_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          public_id?: string | null
          showcase_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_members_showcase_id_fkey"
            columns: ["showcase_id"]
            isOneToOne: false
            referencedRelation: "showcases"
            referencedColumns: ["id"]
          },
        ]
      }
      showcases: {
        Row: {
          bg_dark_url: string | null
          bg_light_url: string | null
          bg_url: string | null
          cover_format: string
          created_at: string
          description: string | null
          grid_columns: number
          hero_url: string | null
          id: string
          is_public: boolean
          public_id: string | null
          slug: string
          sort_order: number
          tenant_id: string
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          bg_dark_url?: string | null
          bg_light_url?: string | null
          bg_url?: string | null
          cover_format?: string
          created_at?: string
          description?: string | null
          grid_columns?: number
          hero_url?: string | null
          id?: string
          is_public?: boolean
          public_id?: string | null
          slug: string
          sort_order?: number
          tenant_id: string
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          bg_dark_url?: string | null
          bg_light_url?: string | null
          bg_url?: string | null
          cover_format?: string
          created_at?: string
          description?: string | null
          grid_columns?: number
          hero_url?: string | null
          id?: string
          is_public?: boolean
          public_id?: string | null
          slug?: string
          sort_order?: number
          tenant_id?: string
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          public_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          public_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          public_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_email_settings: {
        Row: {
          created_at: string
          dns_records: Json | null
          domain: string | null
          domain_status: string
          enabled: boolean
          id: string
          max_recipients_per_broadcast: number
          resend_domain_id: string | null
          resend_topic_id: string | null
          suspended: boolean
          suspended_reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dns_records?: Json | null
          domain?: string | null
          domain_status?: string
          enabled?: boolean
          id?: string
          max_recipients_per_broadcast?: number
          resend_domain_id?: string | null
          resend_topic_id?: string | null
          suspended?: boolean
          suspended_reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dns_records?: Json | null
          domain?: string | null
          domain_status?: string
          enabled?: boolean
          id?: string
          max_recipients_per_broadcast?: number
          resend_domain_id?: string | null
          resend_topic_id?: string | null
          suspended?: boolean
          suspended_reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_email_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integration_secrets: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          integration_id: string
          public_id: string | null
        }
        Insert: {
          created_at?: string | null
          credentials?: Json
          id?: string
          integration_id: string
          public_id?: string | null
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          integration_id?: string
          public_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integration_secrets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          account_external_id: string | null
          account_name: string | null
          account_url: string | null
          avatar_url: string | null
          created_at: string | null
          credentials_hint: Json | null
          id: string
          last_error: string | null
          last_validated_at: string | null
          provider: string
          public_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_external_id?: string | null
          account_name?: string | null
          account_url?: string | null
          avatar_url?: string | null
          created_at?: string | null
          credentials_hint?: Json | null
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          provider: string
          public_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_external_id?: string | null
          account_name?: string | null
          account_url?: string | null
          avatar_url?: string | null
          created_at?: string | null
          credentials_hint?: Json | null
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          provider?: string
          public_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_profile: {
        Row: {
          annual_revenue: string | null
          country: string | null
          created_at: string
          customer_count: string | null
          onboarding_goal: string | null
          referral_source: string | null
          role_tags: Json | null
          tenant_id: string
          updated_at: string
          used_tools: Json | null
        }
        Insert: {
          annual_revenue?: string | null
          country?: string | null
          created_at?: string
          customer_count?: string | null
          onboarding_goal?: string | null
          referral_source?: string | null
          role_tags?: Json | null
          tenant_id: string
          updated_at?: string
          used_tools?: Json | null
        }
        Update: {
          annual_revenue?: string | null
          country?: string | null
          created_at?: string
          customer_count?: string | null
          onboarding_goal?: string | null
          referral_source?: string | null
          role_tags?: Json | null
          tenant_id?: string
          updated_at?: string
          used_tools?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          accent_color: string | null
          checkout_bg_color: string | null
          checkout_button_color: string | null
          checkout_button_style: string
          checkout_font_family: string
          checkout_use_brand_colors: boolean
          created_at: string
          default_language: string | null
          description: string | null
          email_sender_name: string | null
          enable_sale_emails: boolean
          facebook_pixel_id: string | null
          ga_tracking_id: string | null
          gumlet_signed_url_secret: string | null
          gumlet_workspace_id: string | null
          hero_image_url: string | null
          icon_color: string | null
          icon_name: string | null
          icon_url: string | null
          logo_url: string | null
          plan: string
          portal_bg_image_url: string | null
          portal_button_color: string | null
          portal_button_style: string
          portal_products_template: string
          portal_theme_mode: string
          portal_use_brand_colors: boolean
          primary_color: string | null
          public_id: string | null
          social_links: Json | null
          support_email: string | null
          tenant_id: string
          theme_mode: string
          updated_at: string
          video_progress_tracking_enabled: boolean
          video_protection_enabled: boolean
          video_settings: Json
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string | null
          checkout_bg_color?: string | null
          checkout_button_color?: string | null
          checkout_button_style?: string
          checkout_font_family?: string
          checkout_use_brand_colors?: boolean
          created_at?: string
          default_language?: string | null
          description?: string | null
          email_sender_name?: string | null
          enable_sale_emails?: boolean
          facebook_pixel_id?: string | null
          ga_tracking_id?: string | null
          gumlet_signed_url_secret?: string | null
          gumlet_workspace_id?: string | null
          hero_image_url?: string | null
          icon_color?: string | null
          icon_name?: string | null
          icon_url?: string | null
          logo_url?: string | null
          plan?: string
          portal_bg_image_url?: string | null
          portal_button_color?: string | null
          portal_button_style?: string
          portal_products_template?: string
          portal_theme_mode?: string
          portal_use_brand_colors?: boolean
          primary_color?: string | null
          public_id?: string | null
          social_links?: Json | null
          support_email?: string | null
          tenant_id: string
          theme_mode?: string
          updated_at?: string
          video_progress_tracking_enabled?: boolean
          video_protection_enabled?: boolean
          video_settings?: Json
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string | null
          checkout_bg_color?: string | null
          checkout_button_color?: string | null
          checkout_button_style?: string
          checkout_font_family?: string
          checkout_use_brand_colors?: boolean
          created_at?: string
          default_language?: string | null
          description?: string | null
          email_sender_name?: string | null
          enable_sale_emails?: boolean
          facebook_pixel_id?: string | null
          ga_tracking_id?: string | null
          gumlet_signed_url_secret?: string | null
          gumlet_workspace_id?: string | null
          hero_image_url?: string | null
          icon_color?: string | null
          icon_name?: string | null
          icon_url?: string | null
          logo_url?: string | null
          plan?: string
          portal_bg_image_url?: string | null
          portal_button_color?: string | null
          portal_button_style?: string
          portal_products_template?: string
          portal_theme_mode?: string
          portal_use_brand_colors?: boolean
          primary_color?: string | null
          public_id?: string | null
          social_links?: Json | null
          support_email?: string | null
          tenant_id?: string
          theme_mode?: string
          updated_at?: string
          video_progress_tracking_enabled?: boolean
          video_protection_enabled?: boolean
          video_settings?: Json
          website_url?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          country: string | null
          created_at: string
          id: string
          phone: string | null
          public_id: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          public_id?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          public_id?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          public_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          public_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          public_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          public_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          public_id?: string | null
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
      asset_has_file: { Args: { _asset_id: string }; Returns: boolean }
      asset_has_video: { Args: { _asset_id: string }; Returns: boolean }
      asset_lesson_same_tenant: {
        Args: { _asset_id: string; _lesson_id: string }
        Returns: boolean
      }
      can_view_showcase: { Args: { _showcase_id: string }; Returns: boolean }
      change_public_id_prefix: {
        Args: { p_new_prefix: string; p_table: string }
        Returns: number
      }
      connect_integration: {
        Args: {
          p_credentials?: Json
          p_credentials_hint?: Json
          p_metadata?: Json
          p_provider: string
          p_tenant_id: string
        }
        Returns: {
          account_external_id: string | null
          account_name: string | null
          account_url: string | null
          avatar_url: string | null
          created_at: string | null
          credentials_hint: Json | null
          id: string
          last_error: string | null
          last_validated_at: string | null
          provider: string
          public_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tenant_integrations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      decrement_customer_revenue: {
        Args: { p_amount: number; p_customer_id: string }
        Returns: undefined
      }
      delete_tenant_customer: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      duplicate_course: {
        Args: { p_source_course_id: string; p_tenant_id: string }
        Returns: Json
      }
      generate_checkout_smart_id: { Args: never; Returns: string }
      generate_public_id: {
        Args: { id: string; prefix: string }
        Returns: string
      }
      get_asset_tenant: { Args: { _asset_id: string }; Returns: string }
      get_course_tenant: { Args: { _course_id: string }; Returns: string }
      get_customer_purchased_products: {
        Args: never
        Returns: {
          currency: string
          order_created_at: string
          order_id: string
          order_status: string
          product_benefit: string
          product_cover_url: string
          product_id: string
          product_name: string
          product_public_id: string
          product_updated_at: string
          unit_amount: number
        }[]
      }
      get_dashboard_metrics: { Args: { p_tenant_id: string }; Returns: Json }
      get_lesson_course: { Args: { _lesson_id: string }; Returns: string }
      get_module_course: { Args: { _module_id: string }; Returns: string }
      get_order_metrics: {
        Args: {
          p_end_at?: string
          p_product_id?: string
          p_search?: string
          p_source?: string
          p_start_at?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_product_tenant: { Args: { _product_id: string }; Returns: string }
      get_public_checkout: {
        Args: { p_checkout_smart_id: string }
        Returns: {
          allow_discount_codes: boolean
          checkout_bg_color: string
          checkout_button_color: string
          checkout_button_style: string
          checkout_font_family: string
          checkout_use_brand_colors: boolean
          collect_address: boolean
          collect_fiscal_id: boolean
          collect_phone: boolean
          confirmation_message: string
          cover_url: string
          currency: string
          description: string
          expires_at: string
          id: string
          price_category: string
          product_cover_url: string
          product_name: string
          product_status: string
          product_updated_at: string
          renewal_interval_quantity: number
          renewal_interval_unit: string
          smart_id: string
          success_url: string
          tenant_icon_url: string
          tenant_name: string
          tenant_primary_color: string
          tenant_slug: string
          tenant_theme_mode: string
          title: string
          unit_amount: number
        }[]
      }
      get_public_tenant_by_slug: {
        Args: { p_slug: string }
        Returns: {
          accent_color: string
          description: string
          hero_image_url: string
          icon_url: string
          id: string
          name: string
          portal_bg_image_url: string
          portal_button_color: string
          portal_button_style: string
          portal_theme_mode: string
          portal_use_brand_colors: boolean
          primary_color: string
          slug: string
          theme_mode: string
        }[]
      }
      get_superadmin_customers: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_tenant_id?: string
        }
        Returns: {
          created_at: string
          email: string
          email_confirmed_at: string
          id: string
          last_sign_in_at: string
          mrr_cents: number
          name: string
          orders_count: number
          phone: string
          tenant_id: string
          tenant_name: string
          total_count: number
          total_revenue_cents: number
          user_id: string
        }[]
      }
      get_superadmin_dashboard_metrics: { Args: never; Returns: Json }
      get_superadmin_orders: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
          p_tenant_id?: string
        }
        Returns: {
          currency: string
          customer_email: string
          customer_name: string
          effective_order_at: string
          id: string
          order_number: number
          payment_method: string
          product_name: string
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          tenant_name: string
          total_count: number
          unit_amount: number
        }[]
      }
      get_superadmin_products: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_tenant_id?: string
        }
        Returns: {
          benefit: string
          created_at: string
          currency: string
          id: string
          name: string
          status: Database["public"]["Enums"]["product_status"]
          tenant_id: string
          tenant_name: string
          total_count: number
          unit_amount: number
        }[]
      }
      get_superadmin_sellers: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          approved_at: string
          business_name: string
          created_at: string
          ein: string
          email: string
          first_name: string
          id: string
          last_name: string
          rejected_at: string
          status: Database["public"]["Enums"]["seller_status"]
          submitted_at: string
          taxpayer_id: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          total_count: number
          type: Database["public"]["Enums"]["seller_type"]
        }[]
      }
      get_superadmin_tenant_users: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_tenant_id?: string
        }
        Returns: {
          created_at: string
          email: string
          email_confirmed_at: string
          id: string
          last_sign_in_at: string
          name: string
          role: string
          status: string
          tenant_id: string
          tenant_name: string
          total_count: number
          user_id: string
          whatsapp: string
        }[]
      }
      get_superadmin_tenants: {
        Args: {
          p_annual_revenues?: string[]
          p_customer_counts?: string[]
          p_goals?: string[]
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_used_tools?: string[]
        }
        Returns: {
          annual_revenue: string
          courses_count: number
          created_at: string
          customer_count: string
          customers_count: number
          id: string
          name: string
          onboarding_goal: string
          orders_count: number
          owner_email: string
          owner_name: string
          owner_whatsapp: string
          products_count: number
          referral_source: string
          revenue_total: number
          slug: string
          stat_migrate: number
          stat_onboarding_complete: number
          stat_recent_7d: number
          stat_total: number
          total_count: number
          used_tools: Json
        }[]
      }
      get_superadmin_users: {
        Args: {
          p_email_status?: string[]
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_workspace_status?: string[]
        }
        Returns: {
          created_at: string
          email: string
          email_confirmed_at: string
          name: string
          tenant_name: string
          tenant_slug: string
          total_count: number
          user_id: string
          whatsapp: string
        }[]
      }
      get_team_members: {
        Args: { p_tenant_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          name: string
          role: string
          status: string
          user_id: string
        }[]
      }
      get_tenant_customers: {
        Args: { p_search?: string; p_tenant_id: string }
        Returns: {
          avatar_url: string
          city: string
          country: string
          created_at: string
          currency: string
          document: string
          document_type: string
          email: string
          email_marketing_status: string
          first_name: string
          id: string
          last_name: string
          mrr_cents: number
          name: string
          phone: string
          public_id: string
          region: string
          total_revenue_cents: number
          updated_at: string
          user_id: string
        }[]
      }
      get_tenant_orders: {
        Args: {
          p_end_at?: string
          p_page?: number
          p_page_size?: number
          p_product_id?: string
          p_search?: string
          p_source?: string
          p_start_at?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: {
          checkout_id: string
          created_at: string
          currency: string
          customer_email: string
          customer_id: string
          customer_name: string
          effective_order_at: string
          gateway_external_id: string
          gateway_order_created_at: string
          gateway_provider: string
          id: string
          is_order_bump: boolean
          order_number: number
          parent_gateway_external_id: string
          price_id: string
          product_benefit: string
          product_id: string
          product_name: string
          public_id: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_count: number
          type: Database["public"]["Enums"]["order_type"]
          unit_amount: number
          updated_at: string
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      global_search: {
        Args: { p_query: string; p_tenant_id: string }
        Returns: {
          category: string
          id: string
          meta: string
          subtitle: string
          title: string
          url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_checkout_orders: {
        Args: { p_checkout_id: string }
        Returns: undefined
      }
      increment_customer_revenue: {
        Args: { p_amount: number; p_customer_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_asset_available_to_user: {
        Args: { _asset_id: string }
        Returns: boolean
      }
      is_enrolled_in_course: { Args: { _course_id: string }; Returns: boolean }
      is_tenant_customer: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_editor: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_owner: { Args: { _tenant_id: string }; Returns: boolean }
      normalize_lesson_thumbnail_path: {
        Args: { _value: string }
        Returns: string
      }
      reconcile_order_access: {
        Args: { p_order_id: string; p_trigger_source?: string }
        Returns: Json
      }
      resolve_portal_customer: {
        Args: { p_tenant_slug: string }
        Returns: string
      }
      run_customer_csv_import: {
        Args: {
          p_filename: string
          p_import_type?: string
          p_imported_by: string
          p_rows: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      save_lesson_editor:
        | {
            Args: {
              p_content_html?: string
              p_content_mode?: string
              p_custom_html?: string
              p_description?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_links?: Json
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
              p_video_duration?: number
              p_video_payload?: Json
              p_video_playback_url?: string
              p_video_provider?: string
              p_video_provider_asset_id?: string
              p_video_thumbnail_url?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_content_html?: string
              p_content_mode?: string
              p_description?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_links?: Json
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
              p_video_duration?: number
              p_video_payload?: Json
              p_video_playback_url?: string
              p_video_provider?: string
              p_video_provider_asset_id?: string
              p_video_thumbnail_url?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_content_html?: string
              p_description?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_content_html?: string
              p_description?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
              p_video_external_url?: string
              p_video_provider?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_content_html?: string
              p_description?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
              p_video_duration?: number
              p_video_payload?: Json
              p_video_playback_url?: string
              p_video_provider?: string
              p_video_provider_asset_id?: string
              p_video_thumbnail_url?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_content_html?: string
              p_description?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_links?: Json
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
              p_video_duration?: number
              p_video_payload?: Json
              p_video_playback_url?: string
              p_video_provider?: string
              p_video_provider_asset_id?: string
              p_video_thumbnail_url?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_content_html?: string
              p_lesson_id: string
              p_linked_asset_ids?: string[]
              p_thumbnail_path?: string
              p_title: string
              p_video_asset_id?: string
            }
            Returns: Json
          }
      set_product_deliverable:
        | {
            Args: {
              p_asset_ids?: string[]
              p_benefit: string
              p_course_ids?: string[]
              p_product_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_asset_ids?: string[]
              p_benefit: string
              p_course_ids?: string[]
              p_link_items?: Json[]
              p_product_id: string
            }
            Returns: Json
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_tenant_ownership: {
        Args: {
          p_demote_caller?: boolean
          p_new_owner_user_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      unaccent_text: { Args: { "": string }; Returns: string }
      update_customer_profile: {
        Args: {
          p_city?: string
          p_country?: string
          p_name?: string
          p_phone?: string
          p_region?: string
        }
        Returns: undefined
      }
      update_tenant_customer: {
        Args: {
          p_city?: string
          p_country?: string
          p_document?: string
          p_document_type?: string
          p_email_marketing_status?: string
          p_first_name?: string
          p_last_name?: string
          p_name?: string
          p_phone?: string
          p_region?: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      validate_api_key: {
        Args: { p_key_hash: string }
        Returns: {
          key_id: string
          tenant_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "tenant" | "customer"
      asset_status: "uploading" | "processing" | "ready" | "failed" | "deleted"
      asset_type: "video" | "file"
      broadcast_status:
        | "draft"
        | "queued"
        | "sending"
        | "sent"
        | "scheduled"
        | "failed"
        | "cancelled"
      checkout_status: "draft" | "active" | "inactive"
      course_category:
        | "business_entrepreneurship"
        | "marketing_sales"
        | "finance_investments"
        | "technology_programming"
        | "ai_automation"
        | "design_creativity"
        | "productivity_organization"
        | "career_professional"
        | "education_learning"
        | "health_wellbeing"
        | "fitness_performance"
        | "nutrition_food"
        | "personal_development"
        | "relationships_social"
        | "hobbies_lifestyle"
      email_log_status:
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "complained"
        | "failed"
        | "skipped"
      email_log_type:
        | "portal_access"
        | "customer_invite"
        | "access_granted"
        | "team_invite"
        | "reconciliation"
        | "signup_confirmation"
        | "password_reset"
        | "email_change"
        | "magic_link"
        | "auth_invite"
        | "creator_welcome"
      email_marketing_status:
        | "subscribed"
        | "unsubscribed"
        | "archived"
        | "requires_verification"
        | "invalid_email"
        | "bounced"
      interval_unit: "day" | "week" | "month" | "year"
      order_status:
        | "pending"
        | "completed"
        | "refunded"
        | "cancelled"
        | "chargeback"
        | "disputed"
        | "approved"
      order_type: "one_time" | "subscription"
      price_category: "one_time" | "subscription" | "lead_magnet" | "pwyw"
      price_scheme: "standard" | "package" | "graduated" | "volume"
      product_status: "draft" | "active" | "archived"
      seller_document_category:
        | "selfie"
        | "cnh_full"
        | "cnh_front"
        | "cnh_back"
        | "rg_front"
        | "rg_back"
        | "identity"
      seller_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "disabled"
        | "deleted"
      seller_type: "individual" | "business"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "cancelled"
        | "expired"
      tenant_role: "owner" | "editor"
      usage_aggregation_type: "sum" | "last_during_period" | "last_ever" | "max"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "tenant", "customer"],
      asset_status: ["uploading", "processing", "ready", "failed", "deleted"],
      asset_type: ["video", "file"],
      broadcast_status: [
        "draft",
        "queued",
        "sending",
        "sent",
        "scheduled",
        "failed",
        "cancelled",
      ],
      checkout_status: ["draft", "active", "inactive"],
      course_category: [
        "business_entrepreneurship",
        "marketing_sales",
        "finance_investments",
        "technology_programming",
        "ai_automation",
        "design_creativity",
        "productivity_organization",
        "career_professional",
        "education_learning",
        "health_wellbeing",
        "fitness_performance",
        "nutrition_food",
        "personal_development",
        "relationships_social",
        "hobbies_lifestyle",
      ],
      email_log_status: [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complained",
        "failed",
        "skipped",
      ],
      email_log_type: [
        "portal_access",
        "customer_invite",
        "access_granted",
        "team_invite",
        "reconciliation",
        "signup_confirmation",
        "password_reset",
        "email_change",
        "magic_link",
        "auth_invite",
        "creator_welcome",
      ],
      email_marketing_status: [
        "subscribed",
        "unsubscribed",
        "archived",
        "requires_verification",
        "invalid_email",
        "bounced",
      ],
      interval_unit: ["day", "week", "month", "year"],
      order_status: [
        "pending",
        "completed",
        "refunded",
        "cancelled",
        "chargeback",
        "disputed",
        "approved",
      ],
      order_type: ["one_time", "subscription"],
      price_category: ["one_time", "subscription", "lead_magnet", "pwyw"],
      price_scheme: ["standard", "package", "graduated", "volume"],
      product_status: ["draft", "active", "archived"],
      seller_document_category: [
        "selfie",
        "cnh_full",
        "cnh_front",
        "cnh_back",
        "rg_front",
        "rg_back",
        "identity",
      ],
      seller_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "disabled",
        "deleted",
      ],
      seller_type: ["individual", "business"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "paused",
        "cancelled",
        "expired",
      ],
      tenant_role: ["owner", "editor"],
      usage_aggregation_type: ["sum", "last_during_period", "last_ever", "max"],
    },
  },
} as const

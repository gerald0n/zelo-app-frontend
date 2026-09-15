export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      add_ons: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_available: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          must_set_password: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          must_set_password?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          must_set_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_push_subscriptions: {
        Row: {
          admin_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_push_subscriptions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["status_change_actor_type"]
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["status_change_actor_type"]
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["status_change_actor_type"]
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      cart_item_add_ons: {
        Row: {
          add_on_id: string
          cart_item_id: string
          created_at: string
          quantity: number
        }
        Insert: {
          add_on_id: string
          cart_item_id: string
          created_at?: string
          quantity?: number
        }
        Update: {
          add_on_id?: string
          cart_item_id?: string
          created_at?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_item_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_item_add_ons_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_item_pizza_addons: {
        Row: {
          applies_to: Database["public"]["Enums"]["pizza_addon_application"]
          cart_item_id: string
          created_at: string
          pizza_addon_id: string
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["pizza_addon_application"]
          cart_item_id: string
          created_at?: string
          pizza_addon_id: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["pizza_addon_application"]
          cart_item_id?: string
          created_at?: string
          pizza_addon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_item_pizza_addons_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_item_pizza_addons_pizza_addon_id_fkey"
            columns: ["pizza_addon_id"]
            isOneToOne: false
            referencedRelation: "pizza_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          customer_note: string | null
          id: string
          pizza_size_id: string | null
          product_id: string
          quantity: number
          secondary_product_id: string | null
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          customer_note?: string | null
          id?: string
          pizza_size_id?: string | null
          product_id: string
          quantity: number
          secondary_product_id?: string | null
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          customer_note?: string | null
          id?: string
          pizza_size_id?: string | null
          product_id?: string
          quantity?: number
          secondary_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_pizza_size_id_fkey"
            columns: ["pizza_size_id"]
            isOneToOne: false
            referencedRelation: "pizza_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_secondary_product_id_fkey"
            columns: ["secondary_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          anonymous_key: string | null
          created_at: string
          customer_id: string | null
          expires_at: string
          id: string
          last_activity_at: string
          source_order_id: string | null
          updated_at: string
        }
        Insert: {
          anonymous_key?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at: string
          id?: string
          last_activity_at?: string
          source_order_id?: string | null
          updated_at?: string
        }
        Update: {
          anonymous_key?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          last_activity_at?: string
          source_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          scheduling_allow_same_day: boolean
          scheduling_min_lead_minutes: number
          scheduling_same_day_lead_minutes: number
          scheduling_slot_interval_minutes: number
          scheduling_weekday_earliest: string | null
          scheduling_weekend_earliest: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          scheduling_allow_same_day?: boolean
          scheduling_min_lead_minutes?: number
          scheduling_same_day_lead_minutes?: number
          scheduling_slot_interval_minutes?: number
          scheduling_weekday_earliest?: string | null
          scheduling_weekend_earliest?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scheduling_allow_same_day?: boolean
          scheduling_min_lead_minutes?: number
          scheduling_same_day_lead_minutes?: number
          scheduling_slot_interval_minutes?: number
          scheduling_weekday_earliest?: string | null
          scheduling_weekend_earliest?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          starts_at: string | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses: number
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          archived_at: string | null
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          google_formatted_address: string | null
          id: string
          is_default: boolean
          label: string | null
          last_used_at: string | null
          latitude: number
          location_accuracy_meters: number | null
          location_diverged: boolean | null
          location_source: Database["public"]["Enums"]["location_source"] | null
          longitude: number
          neighborhood: string
          number: string
          postal_code: string | null
          reference_point: string | null
          state: string
          street: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          city: string
          complement?: string | null
          created_at?: string
          customer_id: string
          google_formatted_address?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          last_used_at?: string | null
          latitude: number
          location_accuracy_meters?: number | null
          location_diverged?: boolean | null
          location_source?:
            | Database["public"]["Enums"]["location_source"]
            | null
          longitude: number
          neighborhood: string
          number: string
          postal_code?: string | null
          reference_point?: string | null
          state: string
          street: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          google_formatted_address?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          last_used_at?: string | null
          latitude?: number
          location_accuracy_meters?: number | null
          location_diverged?: boolean | null
          location_source?:
            | Database["public"]["Enums"]["location_source"]
            | null
          longitude?: number
          neighborhood?: string
          number?: string
          postal_code?: string | null
          reference_point?: string | null
          state?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_otp_challenges: {
        Row: {
          attempt_count: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          name: string
          phone_e164: string
        }
        Insert: {
          attempt_count?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          name?: string
          phone_e164: string
        }
        Update: {
          attempt_count?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          name?: string
          phone_e164?: string
        }
        Relationships: []
      }
      customer_otp_support_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          consumed_at: string | null
          expires_at: string | null
          id: string
          phone_e164: string
          requested_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          consumed_at?: string | null
          expires_at?: string | null
          id?: string
          phone_e164: string
          requested_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          consumed_at?: string | null
          expires_at?: string | null
          id?: string
          phone_e164?: string
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_otp_support_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          internal_note: string | null
          name: string
          phone_e164: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          internal_note?: string | null
          name: string
          phone_e164: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          internal_note?: string | null
          name?: string
          phone_e164?: string
          updated_at?: string
        }
        Relationships: []
      }
      http_rate_limits: {
        Row: {
          bucket: string
          created_at: string
          id: number
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          key: string
          request_hash: string
          response_body: Json
          response_status: number
          scope: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          key: string
          request_hash: string
          response_body: Json
          response_status: number
          scope: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          key?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          delivery_fee_cents: number
          google_formatted_address: string | null
          id: string
          latitude: number
          location_accuracy_meters: number | null
          location_diverged: boolean | null
          location_source: Database["public"]["Enums"]["location_source"] | null
          longitude: number
          neighborhood: string
          number: string
          order_id: string
          postal_code: string | null
          reference_point: string | null
          route_distance_meters: number
          state: string
          street: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          delivery_fee_cents: number
          google_formatted_address?: string | null
          id?: string
          latitude: number
          location_accuracy_meters?: number | null
          location_diverged?: boolean | null
          location_source?:
            | Database["public"]["Enums"]["location_source"]
            | null
          longitude: number
          neighborhood: string
          number: string
          order_id: string
          postal_code?: string | null
          reference_point?: string | null
          route_distance_meters: number
          state: string
          street: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          delivery_fee_cents?: number
          google_formatted_address?: string | null
          id?: string
          latitude?: number
          location_accuracy_meters?: number | null
          location_diverged?: boolean | null
          location_source?:
            | Database["public"]["Enums"]["location_source"]
            | null
          longitude?: number
          neighborhood?: string
          number?: string
          order_id?: string
          postal_code?: string | null
          reference_point?: string | null
          route_distance_meters?: number
          state?: string
          street?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_add_ons: {
        Row: {
          add_on_id: string | null
          add_on_name: string
          created_at: string
          id: string
          line_total_cents: number
          order_item_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          add_on_id?: string | null
          add_on_name: string
          created_at?: string
          id?: string
          line_total_cents: number
          order_item_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          add_on_id?: string | null
          add_on_name?: string
          created_at?: string
          id?: string
          line_total_cents?: number
          order_item_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_add_ons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_pizza_addons: {
        Row: {
          applies_to: Database["public"]["Enums"]["pizza_addon_application"]
          created_at: string
          id: string
          line_total_cents: number
          order_item_id: string
          pizza_addon_id: string | null
          pizza_addon_name: string
          unit_price_cents: number
        }
        Insert: {
          applies_to: Database["public"]["Enums"]["pizza_addon_application"]
          created_at?: string
          id?: string
          line_total_cents: number
          order_item_id: string
          pizza_addon_id?: string | null
          pizza_addon_name: string
          unit_price_cents: number
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["pizza_addon_application"]
          created_at?: string
          id?: string
          line_total_cents?: number
          order_item_id?: string
          pizza_addon_id?: string | null
          pizza_addon_name?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_pizza_addons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_pizza_addons_pizza_addon_id_fkey"
            columns: ["pizza_addon_id"]
            isOneToOne: false
            referencedRelation: "pizza_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          customer_note: string | null
          id: string
          line_total_cents: number
          order_id: string
          pizza_size_id: string | null
          product_description: string | null
          product_id: string | null
          product_name: string
          quantity: number
          secondary_product_id: string | null
          secondary_product_name: string | null
          unit_price_cents: number
          weight_max_grams: number | null
          weight_min_grams: number | null
        }
        Insert: {
          created_at?: string
          customer_note?: string | null
          id?: string
          line_total_cents: number
          order_id: string
          pizza_size_id?: string | null
          product_description?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          secondary_product_id?: string | null
          secondary_product_name?: string | null
          unit_price_cents: number
          weight_max_grams?: number | null
          weight_min_grams?: number | null
        }
        Update: {
          created_at?: string
          customer_note?: string | null
          id?: string
          line_total_cents?: number
          order_id?: string
          pizza_size_id?: string | null
          product_description?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          secondary_product_id?: string | null
          secondary_product_name?: string | null
          unit_price_cents?: number
          weight_max_grams?: number | null
          weight_min_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_pizza_size_id_fkey"
            columns: ["pizza_size_id"]
            isOneToOne: false
            referencedRelation: "pizza_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_secondary_product_id_fkey"
            columns: ["secondary_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_display_name: string
          customer_id: string | null
          id: string
          is_featured: boolean
          moderated_at: string | null
          order_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_display_name: string
          customer_id?: string | null
          id?: string
          is_featured?: boolean
          moderated_at?: string | null
          order_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_display_name?: string
          customer_id?: string | null
          id?: string
          is_featured?: boolean
          moderated_at?: string | null
          order_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["status_change_actor_type"]
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["status_change_actor_type"]
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["status_change_actor_type"]
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          add_ons_total_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for_amount_cents: number | null
          coupon_code: string | null
          coupon_discount_cents: number
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_note: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id: string | null
          guest_name: string | null
          guest_phone_e164: string | null
          id: string
          internal_note: string | null
          kitchen_printed_at: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_refund_id: string | null
          needs_change: boolean | null
          order_number: number
          paid_at: string | null
          payment_fee_cents: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_attempt: number
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          refunded_at: string | null
          scheduled_for: string | null
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          add_ons_total_cents: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          change_for_amount_cents?: number | null
          coupon_code?: string | null
          coupon_discount_cents?: number
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_note?: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id?: string | null
          guest_name?: string | null
          guest_phone_e164?: string | null
          id?: string
          internal_note?: string | null
          kitchen_printed_at?: string | null
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_refund_id?: string | null
          needs_change?: boolean | null
          order_number?: number
          paid_at?: string | null
          payment_fee_cents?: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pix_attempt?: number
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_ticket_url?: string | null
          refunded_at?: string | null
          scheduled_for?: string | null
          source_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at?: string
        }
        Update: {
          add_ons_total_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          change_for_amount_cents?: number | null
          coupon_code?: string | null
          coupon_discount_cents?: number
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_note?: string | null
          delivery_fee_cents?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id?: string | null
          guest_name?: string | null
          guest_phone_e164?: string | null
          id?: string
          internal_note?: string | null
          kitchen_printed_at?: string | null
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_refund_id?: string | null
          needs_change?: boolean | null
          order_number?: number
          paid_at?: string | null
          payment_fee_cents?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_net_cents?: number | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pix_attempt?: number
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_ticket_url?: string | null
          refunded_at?: string | null
          scheduled_for?: string | null
          source_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          timing?: Database["public"]["Enums"]["order_timing"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
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
            foreignKeyName: "orders_fulfillment_location_id_fkey"
            columns: ["fulfillment_location_id"]
            isOneToOne: false
            referencedRelation: "satellite_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          action: string | null
          created_at: string
          event_id: string | null
          event_type: string | null
          id: string
          mp_order_id: string | null
          mp_payment_id: string | null
          order_id: string | null
          payload: Json
          process_result: string | null
          processed_at: string | null
          provider: string
          signature_valid: boolean
        }
        Insert: {
          action?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          mp_order_id?: string | null
          mp_payment_id?: string | null
          order_id?: string | null
          payload: Json
          process_result?: string | null
          processed_at?: string | null
          provider?: string
          signature_valid?: boolean
        }
        Update: {
          action?: string | null
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          mp_order_id?: string | null
          mp_payment_id?: string | null
          order_id?: string | null
          payload?: Json
          process_result?: string | null
          processed_at?: string | null
          provider?: string
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_addons: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_full_cents: number
          price_half_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_full_cents: number
          price_half_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_full_cents?: number
          price_half_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pizza_flavor_prices: {
        Row: {
          created_at: string
          price_cents: number
          product_id: string
          size_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          price_cents: number
          product_id: string
          size_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          price_cents?: number
          product_id?: string
          size_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_flavor_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_flavor_prices_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "pizza_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_sizes: {
        Row: {
          created_at: string
          diameter_cm: number
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          diameter_cm: number
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          diameter_cm?: number
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_add_ons: {
        Row: {
          add_on_id: string
          created_at: string
          product_id: string
          sort_order: number
        }
        Insert: {
          add_on_id: string
          created_at?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          add_on_id?: string
          created_at?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_add_ons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text: string
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_display_name: string
          customer_id: string
          id: string
          moderated_at: string | null
          order_id: string | null
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_display_name: string
          customer_id: string
          id?: string
          moderated_at?: string | null
          order_id?: string | null
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_display_name?: string
          customer_id?: string
          id?: string
          moderated_at?: string | null
          order_id?: string | null
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          category_id: string
          created_at: string
          description: string | null
          fulfillment_location_id: string | null
          id: string
          is_active: boolean
          is_available: boolean
          name: string
          preview_image_alt_text: string | null
          preview_image_storage_path: string | null
          price_cents: number
          product_type: string
          slug: string
          sort_order: number
          stock_quantity: number | null
          updated_at: string
          weight_max_grams: number | null
          weight_min_grams: number | null
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          fulfillment_location_id?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          name: string
          preview_image_alt_text?: string | null
          preview_image_storage_path?: string | null
          price_cents: number
          product_type?: string
          slug: string
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
          weight_max_grams?: number | null
          weight_min_grams?: number | null
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          fulfillment_location_id?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          name?: string
          preview_image_alt_text?: string | null
          preview_image_storage_path?: string | null
          price_cents?: number
          product_type?: string
          slug?: string
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
          weight_max_grams?: number | null
          weight_min_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_fulfillment_location_id_fkey"
            columns: ["fulfillment_location_id"]
            isOneToOne: false
            referencedRelation: "satellite_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_banners: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          link_href: string | null
          sort_order: number
          starts_at: string | null
          storage_path: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_href?: string | null
          sort_order?: number
          starts_at?: string | null
          storage_path: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_href?: string | null
          sort_order?: number
          starts_at?: string | null
          storage_path?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotion_categories: {
        Row: {
          category_id: string
          created_at: string
          promotion_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          promotion_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_categories_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_products: {
        Row: {
          created_at: string
          product_id: string
          promotion_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          promotion_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          discount_percent: number
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          scope: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          customer_id: string
          endpoint: string
          id: string
          last_seen_at: string | null
          p256dh: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          customer_id: string
          endpoint: string
          id?: string
          last_seen_at?: string | null
          p256dh: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          customer_id?: string
          endpoint?: string
          id?: string
          last_seen_at?: string | null
          p256dh?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_location_delivery_slots: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          label: string | null
          location_id: string
          sort_order: number
          starts_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          label?: string | null
          location_id: string
          sort_order?: number
          starts_at: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          label?: string | null
          location_id?: string
          sort_order?: number
          starts_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "satellite_location_delivery_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "satellite_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_location_hours: {
        Row: {
          created_at: string
          delivery_enabled: boolean
          id: string
          is_closed: boolean
          location_id: string
          pickup_closes_at: string | null
          pickup_opens_at: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          delivery_enabled?: boolean
          id?: string
          is_closed?: boolean
          location_id: string
          pickup_closes_at?: string | null
          pickup_opens_at?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          delivery_enabled?: boolean
          id?: string
          is_closed?: boolean
          location_id?: string
          pickup_closes_at?: string | null
          pickup_opens_at?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "satellite_location_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "satellite_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      satellite_locations: {
        Row: {
          address_line: string
          city: string
          created_at: string
          fixed_delivery_fee_cents: number
          free_delivery_radius_meters: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          max_delivery_radius_meters: number
          min_lead_minutes: number
          name: string
          postal_code: string | null
          slug: string
          state: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line: string
          city: string
          created_at?: string
          fixed_delivery_fee_cents?: number
          free_delivery_radius_meters?: number
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          max_delivery_radius_meters?: number
          min_lead_minutes?: number
          name: string
          postal_code?: string | null
          slug: string
          state: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          fixed_delivery_fee_cents?: number
          free_delivery_radius_meters?: number
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          max_delivery_radius_meters?: number
          min_lead_minutes?: number
          name?: string
          postal_code?: string | null
          slug?: string
          state?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_blackout_periods: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          store_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          store_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_blackout_periods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          delivery_enabled: boolean
          id: string
          is_closed: boolean
          opens_at: string | null
          pickup_enabled: boolean
          store_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          delivery_enabled?: boolean
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          pickup_enabled?: boolean
          store_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          delivery_enabled?: boolean
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          pickup_enabled?: boolean
          store_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_business_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accepts_card: boolean
          accepts_cash: boolean
          accepts_pix: boolean
          address_line: string
          city: string
          cnpj: string | null
          created_at: string
          fixed_delivery_fee_cents: number
          free_delivery_radius_meters: number
          id: string
          is_open_override: boolean | null
          latitude: number
          longitude: number
          max_delivery_radius_meters: number
          name: string
          pause_reason: string | null
          paused_until: string | null
          payment_fee_estimate_bps: number
          phone_e164: string
          pix_copy_paste: string | null
          postal_code: string | null
          state: string
          timezone: string
          updated_at: string
          whatsapp_e164: string
        }
        Insert: {
          accepts_card?: boolean
          accepts_cash?: boolean
          accepts_pix?: boolean
          address_line: string
          city: string
          cnpj?: string | null
          created_at?: string
          fixed_delivery_fee_cents?: number
          free_delivery_radius_meters?: number
          id?: string
          is_open_override?: boolean | null
          latitude: number
          longitude: number
          max_delivery_radius_meters?: number
          name: string
          pause_reason?: string | null
          paused_until?: string | null
          payment_fee_estimate_bps?: number
          phone_e164: string
          pix_copy_paste?: string | null
          postal_code?: string | null
          state: string
          timezone?: string
          updated_at?: string
          whatsapp_e164: string
        }
        Update: {
          accepts_card?: boolean
          accepts_cash?: boolean
          accepts_pix?: boolean
          address_line?: string
          city?: string
          cnpj?: string | null
          created_at?: string
          fixed_delivery_fee_cents?: number
          free_delivery_radius_meters?: number
          id?: string
          is_open_override?: boolean | null
          latitude?: number
          longitude?: number
          max_delivery_radius_meters?: number
          name?: string
          pause_reason?: string | null
          paused_until?: string | null
          payment_fee_estimate_bps?: number
          phone_e164?: string
          pix_copy_paste?: string | null
          postal_code?: string | null
          state?: string
          timezone?: string
          updated_at?: string
          whatsapp_e164?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_order_pix_payment: {
        Args: { p_mp_order_id?: string; p_order_id: string; p_paid_at?: string }
        Returns: {
          add_ons_total_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for_amount_cents: number | null
          coupon_code: string | null
          coupon_discount_cents: number
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_note: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id: string | null
          guest_name: string | null
          guest_phone_e164: string | null
          id: string
          internal_note: string | null
          kitchen_printed_at: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_refund_id: string | null
          needs_change: boolean | null
          order_number: number
          paid_at: string | null
          payment_fee_cents: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_attempt: number
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          refunded_at: string | null
          scheduled_for: string | null
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      create_manual_order: { Args: { payload: Json }; Returns: string }
      create_order: { Args: { payload: Json }; Returns: string }
      create_order_as_customer: {
        Args: { p_customer_id: string; payload: Json }
        Returns: string
      }
      fail_order_pix_payment: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          add_ons_total_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for_amount_cents: number | null
          coupon_code: string | null
          coupon_discount_cents: number
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_note: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id: string | null
          guest_name: string | null
          guest_phone_e164: string | null
          id: string
          internal_note: string | null
          kitchen_printed_at: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_refund_id: string | null
          needs_change: boolean | null
          order_number: number
          paid_at: string | null
          payment_fee_cents: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_attempt: number
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          refunded_at: string | null
          scheduled_for: string | null
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_top_selling_products: {
        Args: { p_limit?: number; p_since: string }
        Returns: {
          product_id: string
          total_quantity: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      preview_coupon: {
        Args: {
          p_code: string
          p_delivery_fee_cents: number
          p_product_ids: string[]
          p_subtotal_cents: number
        }
        Returns: Json
      }
      purge_rate_limits: { Args: { p_older_than?: string }; Returns: number }
      refund_order_pix_payment: {
        Args: { p_mp_refund_id?: string; p_order_id: string }
        Returns: {
          add_ons_total_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for_amount_cents: number | null
          coupon_code: string | null
          coupon_discount_cents: number
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_note: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id: string | null
          guest_name: string | null
          guest_phone_e164: string | null
          id: string
          internal_note: string | null
          kitchen_printed_at: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_refund_id: string | null
          needs_change: boolean | null
          order_number: number
          paid_at: string | null
          payment_fee_cents: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_attempt: number
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          refunded_at: string | null
          scheduled_for: string | null
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_order_status: {
        Args: {
          p_actor_type: Database["public"]["Enums"]["status_change_actor_type"]
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
          p_reason?: string
        }
        Returns: {
          add_ons_total_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for_amount_cents: number | null
          coupon_code: string | null
          coupon_discount_cents: number
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_note: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id: string | null
          guest_name: string | null
          guest_phone_e164: string | null
          id: string
          internal_note: string | null
          kitchen_printed_at: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_refund_id: string | null
          needs_change: boolean | null
          order_number: number
          paid_at: string | null
          payment_fee_cents: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_attempt: number
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          refunded_at: string | null
          scheduled_for: string | null
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_order_status_as_customer: {
        Args: {
          p_customer_id: string
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
          p_reason?: string
        }
        Returns: {
          add_ons_total_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_for_amount_cents: number | null
          coupon_code: string | null
          coupon_discount_cents: number
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_note: string | null
          delivery_fee_cents: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          fulfillment_location_id: string | null
          guest_name: string | null
          guest_phone_e164: string | null
          id: string
          internal_note: string | null
          kitchen_printed_at: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_refund_id: string | null
          needs_change: boolean | null
          order_number: number
          paid_at: string | null
          payment_fee_cents: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_net_cents: number | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pix_attempt: number
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          refunded_at: string | null
          scheduled_for: string | null
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          timing: Database["public"]["Enums"]["order_timing"]
          total_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      delivery_method: "delivery" | "pickup"
      location_source: "geocoded" | "current_location" | "manual_pin"
      order_status:
        | "received"
        | "confirmed"
        | "in_production"
        | "ready_for_delivery"
        | "ready_for_pickup"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      order_timing: "immediate" | "scheduled"
      payment_method: "pix" | "cash" | "card" | "pix_manual"
      payment_status:
        | "pending"
        | "confirmed"
        | "failed"
        | "cancelled"
        | "refunded"
      pizza_addon_application: "whole" | "flavor1" | "flavor2"
      review_status: "pending" | "approved" | "hidden"
      status_change_actor_type: "customer" | "admin" | "system"
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
    Enums: {
      delivery_method: ["delivery", "pickup"],
      location_source: ["geocoded", "current_location", "manual_pin"],
      order_status: [
        "received",
        "confirmed",
        "in_production",
        "ready_for_delivery",
        "ready_for_pickup",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      order_timing: ["immediate", "scheduled"],
      payment_method: ["pix", "cash", "card", "pix_manual"],
      payment_status: [
        "pending",
        "confirmed",
        "failed",
        "cancelled",
        "refunded",
      ],
      pizza_addon_application: ["whole", "flavor1", "flavor2"],
      review_status: ["pending", "approved", "hidden"],
      status_change_actor_type: ["customer", "admin", "system"],
    },
  },
} as const


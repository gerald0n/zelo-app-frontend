export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      add_ons: {
        Row: {
          archived_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_available: boolean;
          name: string;
          price_cents: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_available?: boolean;
          name: string;
          price_cents: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_available?: boolean;
          name?: string;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          must_set_password: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          is_active?: boolean;
          must_set_password?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          must_set_password?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: Database['public']['Enums']['status_change_actor_type'];
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: Database['public']['Enums']['status_change_actor_type'];
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: Database['public']['Enums']['status_change_actor_type'];
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      cart_item_add_ons: {
        Row: {
          add_on_id: string;
          cart_item_id: string;
          created_at: string;
          quantity: number;
        };
        Insert: {
          add_on_id: string;
          cart_item_id: string;
          created_at?: string;
          quantity?: number;
        };
        Update: {
          add_on_id?: string;
          cart_item_id?: string;
          created_at?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'cart_item_add_ons_add_on_id_fkey';
            columns: ['add_on_id'];
            isOneToOne: false;
            referencedRelation: 'add_ons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cart_item_add_ons_cart_item_id_fkey';
            columns: ['cart_item_id'];
            isOneToOne: false;
            referencedRelation: 'cart_items';
            referencedColumns: ['id'];
          },
        ];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          customer_note: string | null;
          id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          customer_note?: string | null;
          id?: string;
          product_id: string;
          quantity: number;
          updated_at?: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          customer_note?: string | null;
          id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cart_items_cart_id_fkey';
            columns: ['cart_id'];
            isOneToOne: false;
            referencedRelation: 'carts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cart_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      carts: {
        Row: {
          anonymous_key: string | null;
          created_at: string;
          customer_id: string | null;
          expires_at: string;
          id: string;
          last_activity_at: string;
          source_order_id: string | null;
          updated_at: string;
        };
        Insert: {
          anonymous_key?: string | null;
          created_at?: string;
          customer_id?: string | null;
          expires_at: string;
          id?: string;
          last_activity_at?: string;
          source_order_id?: string | null;
          updated_at?: string;
        };
        Update: {
          anonymous_key?: string | null;
          created_at?: string;
          customer_id?: string | null;
          expires_at?: string;
          id?: string;
          last_activity_at?: string;
          source_order_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'carts_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'carts_source_order_id_fkey';
            columns: ['source_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          archived_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_addresses: {
        Row: {
          archived_at: string | null;
          city: string;
          complement: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          is_default: boolean;
          label: string | null;
          last_used_at: string | null;
          latitude: number;
          longitude: number;
          neighborhood: string;
          number: string;
          postal_code: string | null;
          reference_point: string | null;
          state: string;
          street: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          city: string;
          complement?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          last_used_at?: string | null;
          latitude: number;
          longitude: number;
          neighborhood: string;
          number: string;
          postal_code?: string | null;
          reference_point?: string | null;
          state: string;
          street: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          city?: string;
          complement?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          last_used_at?: string | null;
          latitude?: number;
          longitude?: number;
          neighborhood?: string;
          number?: string;
          postal_code?: string | null;
          reference_point?: string | null;
          state?: string;
          street?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_addresses_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_otp_challenges: {
        Row: {
          attempt_count: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          name: string;
          phone_e164: string;
        };
        Insert: {
          attempt_count?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          name?: string;
          phone_e164: string;
        };
        Update: {
          attempt_count?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          name?: string;
          phone_e164?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          internal_note: string | null;
          name: string;
          phone_e164: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id: string;
          internal_note?: string | null;
          name: string;
          phone_e164: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          internal_note?: string | null;
          name?: string;
          phone_e164?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      http_rate_limits: {
        Row: {
          bucket: string;
          created_at: string;
          id: number;
        };
        Insert: {
          bucket: string;
          created_at?: string;
          id?: never;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          id?: never;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          customer_id: string | null;
          id: string;
          key: string;
          request_hash: string;
          response_body: Json;
          response_status: number;
          scope: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          key: string;
          request_hash: string;
          response_body: Json;
          response_status: number;
          scope: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          key?: string;
          request_hash?: string;
          response_body?: Json;
          response_status?: number;
          scope?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'idempotency_keys_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      order_addresses: {
        Row: {
          city: string;
          complement: string | null;
          created_at: string;
          delivery_fee_cents: number;
          id: string;
          latitude: number;
          longitude: number;
          neighborhood: string;
          number: string;
          order_id: string;
          postal_code: string | null;
          reference_point: string | null;
          route_distance_meters: number;
          state: string;
          street: string;
        };
        Insert: {
          city: string;
          complement?: string | null;
          created_at?: string;
          delivery_fee_cents: number;
          id?: string;
          latitude: number;
          longitude: number;
          neighborhood: string;
          number: string;
          order_id: string;
          postal_code?: string | null;
          reference_point?: string | null;
          route_distance_meters: number;
          state: string;
          street: string;
        };
        Update: {
          city?: string;
          complement?: string | null;
          created_at?: string;
          delivery_fee_cents?: number;
          id?: string;
          latitude?: number;
          longitude?: number;
          neighborhood?: string;
          number?: string;
          order_id?: string;
          postal_code?: string | null;
          reference_point?: string | null;
          route_distance_meters?: number;
          state?: string;
          street?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_addresses_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_item_add_ons: {
        Row: {
          add_on_id: string | null;
          add_on_name: string;
          created_at: string;
          id: string;
          line_total_cents: number;
          order_item_id: string;
          quantity: number;
          unit_price_cents: number;
        };
        Insert: {
          add_on_id?: string | null;
          add_on_name: string;
          created_at?: string;
          id?: string;
          line_total_cents: number;
          order_item_id: string;
          quantity: number;
          unit_price_cents: number;
        };
        Update: {
          add_on_id?: string | null;
          add_on_name?: string;
          created_at?: string;
          id?: string;
          line_total_cents?: number;
          order_item_id?: string;
          quantity?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_item_add_ons_add_on_id_fkey';
            columns: ['add_on_id'];
            isOneToOne: false;
            referencedRelation: 'add_ons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_item_add_ons_order_item_id_fkey';
            columns: ['order_item_id'];
            isOneToOne: false;
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          customer_note: string | null;
          id: string;
          line_total_cents: number;
          order_id: string;
          product_description: string | null;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          weight_max_grams: number | null;
          weight_min_grams: number | null;
        };
        Insert: {
          created_at?: string;
          customer_note?: string | null;
          id?: string;
          line_total_cents: number;
          order_id: string;
          product_description?: string | null;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          weight_max_grams?: number | null;
          weight_min_grams?: number | null;
        };
        Update: {
          created_at?: string;
          customer_note?: string | null;
          id?: string;
          line_total_cents?: number;
          order_id?: string;
          product_description?: string | null;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price_cents?: number;
          weight_max_grams?: number | null;
          weight_min_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      order_status_history: {
        Row: {
          actor_id: string | null;
          actor_type: Database['public']['Enums']['status_change_actor_type'];
          created_at: string;
          id: string;
          new_status: Database['public']['Enums']['order_status'];
          order_id: string;
          previous_status: Database['public']['Enums']['order_status'] | null;
          reason: string | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_type: Database['public']['Enums']['status_change_actor_type'];
          created_at?: string;
          id?: string;
          new_status: Database['public']['Enums']['order_status'];
          order_id: string;
          previous_status?: Database['public']['Enums']['order_status'] | null;
          reason?: string | null;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: Database['public']['Enums']['status_change_actor_type'];
          created_at?: string;
          id?: string;
          new_status?: Database['public']['Enums']['order_status'];
          order_id?: string;
          previous_status?: Database['public']['Enums']['order_status'] | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_status_history_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          add_ons_total_cents: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          change_for_amount_cents: number | null;
          created_at: string;
          customer_id: string | null;
          customer_note: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name: string | null;
          guest_phone_e164: string | null;
          id: string;
          internal_note: string | null;
          mp_order_id: string | null;
          mp_refund_id: string | null;
          needs_change: boolean | null;
          order_number: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_attempt: number;
          pix_expires_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_ticket_url: string | null;
          refunded_at: string | null;
          scheduled_for: string | null;
          source_order_id: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          add_ons_total_cents: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          change_for_amount_cents?: number | null;
          created_at?: string;
          customer_id?: string | null;
          customer_note?: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name?: string | null;
          guest_phone_e164?: string | null;
          id?: string;
          internal_note?: string | null;
          mp_order_id?: string | null;
          mp_refund_id?: string | null;
          needs_change?: boolean | null;
          order_number?: number;
          paid_at?: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          pix_attempt?: number;
          pix_expires_at?: string | null;
          pix_qr_code?: string | null;
          pix_qr_code_base64?: string | null;
          pix_ticket_url?: string | null;
          refunded_at?: string | null;
          scheduled_for?: string | null;
          source_order_id?: string | null;
          status?: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at?: string;
        };
        Update: {
          add_ons_total_cents?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          change_for_amount_cents?: number | null;
          created_at?: string;
          customer_id?: string | null;
          customer_note?: string | null;
          delivery_fee_cents?: number;
          delivery_method?: Database['public']['Enums']['delivery_method'];
          guest_name?: string | null;
          guest_phone_e164?: string | null;
          id?: string;
          internal_note?: string | null;
          mp_order_id?: string | null;
          mp_refund_id?: string | null;
          needs_change?: boolean | null;
          order_number?: number;
          paid_at?: string | null;
          payment_method?: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          pix_attempt?: number;
          pix_expires_at?: string | null;
          pix_qr_code?: string | null;
          pix_qr_code_base64?: string | null;
          pix_ticket_url?: string | null;
          refunded_at?: string | null;
          scheduled_for?: string | null;
          source_order_id?: string | null;
          status?: Database['public']['Enums']['order_status'];
          subtotal_cents?: number;
          timing?: Database['public']['Enums']['order_timing'];
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_source_order_id_fkey';
            columns: ['source_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_events: {
        Row: {
          action: string | null;
          created_at: string;
          event_id: string | null;
          event_type: string | null;
          id: string;
          mp_order_id: string | null;
          mp_payment_id: string | null;
          order_id: string | null;
          payload: Json;
          process_result: string | null;
          processed_at: string | null;
          provider: string;
          signature_valid: boolean;
        };
        Insert: {
          action?: string | null;
          created_at?: string;
          event_id?: string | null;
          event_type?: string | null;
          id?: string;
          mp_order_id?: string | null;
          mp_payment_id?: string | null;
          order_id?: string | null;
          payload: Json;
          process_result?: string | null;
          processed_at?: string | null;
          provider?: string;
          signature_valid?: boolean;
        };
        Update: {
          action?: string | null;
          created_at?: string;
          event_id?: string | null;
          event_type?: string | null;
          id?: string;
          mp_order_id?: string | null;
          mp_payment_id?: string | null;
          order_id?: string | null;
          payload?: Json;
          process_result?: string | null;
          processed_at?: string | null;
          provider?: string;
          signature_valid?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      product_add_ons: {
        Row: {
          add_on_id: string;
          created_at: string;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          add_on_id: string;
          created_at?: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          add_on_id?: string;
          created_at?: string;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'product_add_ons_add_on_id_fkey';
            columns: ['add_on_id'];
            isOneToOne: false;
            referencedRelation: 'add_ons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_add_ons_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          product_id: string;
          sort_order: number;
          storage_path: string;
        };
        Insert: {
          alt_text: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          product_id: string;
          sort_order?: number;
          storage_path: string;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          product_id?: string;
          sort_order?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_available: boolean;
          name: string;
          price_cents: number;
          slug: string;
          sort_order: number;
          stock_quantity: number | null;
          updated_at: string;
          weight_max_grams: number | null;
          weight_min_grams: number | null;
        };
        Insert: {
          archived_at?: string | null;
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_available?: boolean;
          name: string;
          price_cents: number;
          slug: string;
          sort_order?: number;
          stock_quantity?: number | null;
          updated_at?: string;
          weight_max_grams?: number | null;
          weight_min_grams?: number | null;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_available?: boolean;
          name?: string;
          price_cents?: number;
          slug?: string;
          sort_order?: number;
          stock_quantity?: number | null;
          updated_at?: string;
          weight_max_grams?: number | null;
          weight_min_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      promotion_categories: {
        Row: {
          category_id: string;
          created_at: string;
          promotion_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          promotion_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          promotion_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'promotion_categories_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promotion_categories_promotion_id_fkey';
            columns: ['promotion_id'];
            isOneToOne: false;
            referencedRelation: 'promotions';
            referencedColumns: ['id'];
          },
        ];
      };
      promotion_products: {
        Row: {
          created_at: string;
          product_id: string;
          promotion_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          promotion_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          promotion_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'promotion_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promotion_products_promotion_id_fkey';
            columns: ['promotion_id'];
            isOneToOne: false;
            referencedRelation: 'promotions';
            referencedColumns: ['id'];
          },
        ];
      };
      promotions: {
        Row: {
          created_at: string;
          discount_percent: number;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          scope: string;
          starts_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          discount_percent: number;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          scope: string;
          starts_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          discount_percent?: number;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          scope?: string;
          starts_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          customer_id: string;
          endpoint: string;
          id: string;
          last_seen_at: string | null;
          p256dh: string;
          revoked_at: string | null;
          updated_at: string;
          user_agent: string | null;
        };
        Insert: {
          auth: string;
          created_at?: string;
          customer_id: string;
          endpoint: string;
          id?: string;
          last_seen_at?: string | null;
          p256dh: string;
          revoked_at?: string | null;
          updated_at?: string;
          user_agent?: string | null;
        };
        Update: {
          auth?: string;
          created_at?: string;
          customer_id?: string;
          endpoint?: string;
          id?: string;
          last_seen_at?: string | null;
          p256dh?: string;
          revoked_at?: string | null;
          updated_at?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      store_blackout_periods: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          starts_at: string;
          store_id: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          starts_at: string;
          store_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          starts_at?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_blackout_periods_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      store_business_hours: {
        Row: {
          closes_at: string | null;
          created_at: string;
          delivery_enabled: boolean;
          id: string;
          is_closed: boolean;
          opens_at: string | null;
          pickup_enabled: boolean;
          store_id: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          closes_at?: string | null;
          created_at?: string;
          delivery_enabled?: boolean;
          id?: string;
          is_closed?: boolean;
          opens_at?: string | null;
          pickup_enabled?: boolean;
          store_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          closes_at?: string | null;
          created_at?: string;
          delivery_enabled?: boolean;
          id?: string;
          is_closed?: boolean;
          opens_at?: string | null;
          pickup_enabled?: boolean;
          store_id?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'store_business_hours_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      stores: {
        Row: {
          accepts_card: boolean;
          accepts_cash: boolean;
          accepts_pix: boolean;
          address_line: string;
          city: string;
          created_at: string;
          fixed_delivery_fee_cents: number;
          free_delivery_radius_meters: number;
          id: string;
          is_open_override: boolean | null;
          latitude: number;
          longitude: number;
          max_delivery_radius_meters: number;
          name: string;
          phone_e164: string;
          pix_copy_paste: string | null;
          postal_code: string | null;
          schedule_slot_times: string[];
          state: string;
          timezone: string;
          updated_at: string;
          whatsapp_e164: string;
        };
        Insert: {
          accepts_card?: boolean;
          accepts_cash?: boolean;
          accepts_pix?: boolean;
          address_line: string;
          city: string;
          created_at?: string;
          fixed_delivery_fee_cents?: number;
          free_delivery_radius_meters?: number;
          id?: string;
          is_open_override?: boolean | null;
          latitude: number;
          longitude: number;
          max_delivery_radius_meters?: number;
          name: string;
          phone_e164: string;
          pix_copy_paste?: string | null;
          postal_code?: string | null;
          schedule_slot_times?: string[];
          state: string;
          timezone?: string;
          updated_at?: string;
          whatsapp_e164: string;
        };
        Update: {
          accepts_card?: boolean;
          accepts_cash?: boolean;
          accepts_pix?: boolean;
          address_line?: string;
          city?: string;
          created_at?: string;
          fixed_delivery_fee_cents?: number;
          free_delivery_radius_meters?: number;
          id?: string;
          is_open_override?: boolean | null;
          latitude?: number;
          longitude?: number;
          max_delivery_radius_meters?: number;
          name?: string;
          phone_e164?: string;
          pix_copy_paste?: string | null;
          postal_code?: string | null;
          schedule_slot_times?: string[];
          state?: string;
          timezone?: string;
          updated_at?: string;
          whatsapp_e164?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirm_order_pix_payment: {
        Args: {
          p_mp_order_id?: string;
          p_order_id: string;
          p_paid_at?: string;
        };
        Returns: {
          add_ons_total_cents: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          change_for_amount_cents: number | null;
          created_at: string;
          customer_id: string | null;
          customer_note: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name: string | null;
          guest_phone_e164: string | null;
          id: string;
          internal_note: string | null;
          mp_order_id: string | null;
          mp_refund_id: string | null;
          needs_change: boolean | null;
          order_number: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_attempt: number;
          pix_expires_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_ticket_url: string | null;
          refunded_at: string | null;
          scheduled_for: string | null;
          source_order_id: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_manual_order: { Args: { payload: Json }; Returns: string };
      create_order: { Args: { payload: Json }; Returns: string };
      create_order_as_customer: {
        Args: { p_customer_id: string; payload: Json };
        Returns: string;
      };
      fail_order_pix_payment: {
        Args: { p_order_id: string; p_reason?: string };
        Returns: {
          add_ons_total_cents: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          change_for_amount_cents: number | null;
          created_at: string;
          customer_id: string | null;
          customer_note: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name: string | null;
          guest_phone_e164: string | null;
          id: string;
          internal_note: string | null;
          mp_order_id: string | null;
          mp_refund_id: string | null;
          needs_change: boolean | null;
          order_number: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_attempt: number;
          pix_expires_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_ticket_url: string | null;
          refunded_at: string | null;
          scheduled_for: string | null;
          source_order_id: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_admin: { Args: never; Returns: boolean };
      is_hhmm_list: { Args: { v: string[] }; Returns: boolean };
      purge_rate_limits: { Args: { p_older_than?: string }; Returns: number };
      refund_order_pix_payment: {
        Args: { p_mp_refund_id?: string; p_order_id: string };
        Returns: {
          add_ons_total_cents: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          change_for_amount_cents: number | null;
          created_at: string;
          customer_id: string | null;
          customer_note: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name: string | null;
          guest_phone_e164: string | null;
          id: string;
          internal_note: string | null;
          mp_order_id: string | null;
          mp_refund_id: string | null;
          needs_change: boolean | null;
          order_number: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_attempt: number;
          pix_expires_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_ticket_url: string | null;
          refunded_at: string | null;
          scheduled_for: string | null;
          source_order_id: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_order_status: {
        Args: {
          p_actor_type: Database['public']['Enums']['status_change_actor_type'];
          p_new_status: Database['public']['Enums']['order_status'];
          p_order_id: string;
          p_reason?: string;
        };
        Returns: {
          add_ons_total_cents: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          change_for_amount_cents: number | null;
          created_at: string;
          customer_id: string | null;
          customer_note: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name: string | null;
          guest_phone_e164: string | null;
          id: string;
          internal_note: string | null;
          mp_order_id: string | null;
          mp_refund_id: string | null;
          needs_change: boolean | null;
          order_number: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_attempt: number;
          pix_expires_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_ticket_url: string | null;
          refunded_at: string | null;
          scheduled_for: string | null;
          source_order_id: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_order_status_as_customer: {
        Args: {
          p_customer_id: string;
          p_new_status: Database['public']['Enums']['order_status'];
          p_order_id: string;
          p_reason?: string;
        };
        Returns: {
          add_ons_total_cents: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          change_for_amount_cents: number | null;
          created_at: string;
          customer_id: string | null;
          customer_note: string | null;
          delivery_fee_cents: number;
          delivery_method: Database['public']['Enums']['delivery_method'];
          guest_name: string | null;
          guest_phone_e164: string | null;
          id: string;
          internal_note: string | null;
          mp_order_id: string | null;
          mp_refund_id: string | null;
          needs_change: boolean | null;
          order_number: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          pix_attempt: number;
          pix_expires_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_ticket_url: string | null;
          refunded_at: string | null;
          scheduled_for: string | null;
          source_order_id: string | null;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          timing: Database['public']['Enums']['order_timing'];
          total_cents: number;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      delivery_method: 'delivery' | 'pickup';
      order_status:
        | 'received'
        | 'confirmed'
        | 'in_production'
        | 'ready_for_delivery'
        | 'ready_for_pickup'
        | 'out_for_delivery'
        | 'delivered'
        | 'cancelled';
      order_timing: 'immediate' | 'scheduled';
      payment_method: 'pix' | 'cash' | 'card';
      payment_status:
        'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded';
      status_change_actor_type: 'customer' | 'admin' | 'system';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      delivery_method: ['delivery', 'pickup'],
      order_status: [
        'received',
        'confirmed',
        'in_production',
        'ready_for_delivery',
        'ready_for_pickup',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      order_timing: ['immediate', 'scheduled'],
      payment_method: ['pix', 'cash', 'card'],
      payment_status: [
        'pending',
        'confirmed',
        'failed',
        'cancelled',
        'refunded',
      ],
      status_change_actor_type: ['customer', 'admin', 'system'],
    },
  },
} as const;

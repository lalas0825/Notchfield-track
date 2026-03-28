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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_feedback: {
        Row: {
          ai_response: string | null
          ai_type: string
          created_at: string | null
          feedback_text: string | null
          id: string
          message_id: string
          metadata: Json | null
          organization_id: string
          project_id: string
          query_text: string | null
          rating: string
          user_id: string
        }
        Insert: {
          ai_response?: string | null
          ai_type: string
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          message_id: string
          metadata?: Json | null
          organization_id: string
          project_id: string
          query_text?: string | null
          rating: string
          user_id: string
        }
        Update: {
          ai_response?: string | null
          ai_type?: string
          created_at?: string | null
          feedback_text?: string | null
          id?: string
          message_id?: string
          metadata?: Json | null
          organization_id?: string
          project_id?: string
          query_text?: string | null
          rating?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          ai_type: string
          created_at: string | null
          id: string
          organization_id: string
          project_id: string
          user_id: string
        }
        Insert: {
          ai_type: string
          created_at?: string | null
          id?: string
          organization_id: string
          project_id: string
          user_id: string
        }
        Update: {
          ai_type?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      area_time_entries: {
        Row: {
          area_id: string
          assigned_by: string | null
          created_at: string
          ended_at: string | null
          hours: number | null
          id: string
          organization_id: string
          project_id: string
          started_at: string
          worker_id: string
          worker_role: string
        }
        Insert: {
          area_id: string
          assigned_by?: string | null
          created_at?: string
          ended_at?: string | null
          hours?: number | null
          id?: string
          organization_id: string
          project_id: string
          started_at: string
          worker_id: string
          worker_role?: string
        }
        Update: {
          area_id?: string
          assigned_by?: string | null
          created_at?: string
          ended_at?: string | null
          hours?: number | null
          id?: string
          organization_id?: string
          project_id?: string
          started_at?: string
          worker_id?: string
          worker_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_time_entries_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_time_entries_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assemblies: {
        Row: {
          classification_id: string
          created_at: string
          created_by: string
          daily_production_rate: number | null
          description: string | null
          equipment_cost_cents: number
          helper_count: number
          id: string
          labor_cost_cents: number
          material_cost_cents: number
          mechanic_count: number
          name: string
          organization_id: string
          overhead_percent: number
          project_id: string
          subcontractor_cost_cents: number
          total_cost_cents: number
          updated_at: string
        }
        Insert: {
          classification_id: string
          created_at?: string
          created_by: string
          daily_production_rate?: number | null
          description?: string | null
          equipment_cost_cents?: number
          helper_count?: number
          id?: string
          labor_cost_cents?: number
          material_cost_cents?: number
          mechanic_count?: number
          name: string
          organization_id: string
          overhead_percent?: number
          project_id: string
          subcontractor_cost_cents?: number
          total_cost_cents?: number
          updated_at?: string
        }
        Update: {
          classification_id?: string
          created_at?: string
          created_by?: string
          daily_production_rate?: number | null
          description?: string | null
          equipment_cost_cents?: number
          helper_count?: number
          id?: string
          labor_cost_cents?: number
          material_cost_cents?: number
          mechanic_count?: number
          name?: string
          organization_id?: string
          overhead_percent?: number
          project_id?: string
          subcontractor_cost_cents?: number
          total_cost_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assemblies_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "classifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assemblies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_adjustments: {
        Row: {
          applies_to: string
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          project_id: string
          sort_order: number
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          applies_to?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          project_id: string
          sort_order?: number
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          applies_to?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "bid_adjustments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_packages: {
        Row: {
          awarded_amount: number | null
          awarded_to: string | null
          bids: Json | null
          created_at: string | null
          created_by: string
          due_date: string | null
          id: string
          name: string
          organization_id: string
          project_id: string
          scope: string | null
          status: string
          trade: string
          updated_at: string | null
        }
        Insert: {
          awarded_amount?: number | null
          awarded_to?: string | null
          bids?: Json | null
          created_at?: string | null
          created_by: string
          due_date?: string | null
          id?: string
          name: string
          organization_id: string
          project_id: string
          scope?: string | null
          status?: string
          trade: string
          updated_at?: string | null
        }
        Update: {
          awarded_amount?: number | null
          awarded_to?: string | null
          bids?: Json | null
          created_at?: string | null
          created_by?: string
          due_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          scope?: string | null
          status?: string
          trade?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_snapshots: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          grand_total_cents: number
          id: string
          name: string
          organization_id: string
          project_id: string
          snapshot_data: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          grand_total_cents?: number
          id?: string
          name: string
          organization_id: string
          project_id: string
          snapshot_data: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          grand_total_cents?: number
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          snapshot_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bid_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number
          category: string | null
          committed_amount: number
          cost_code: string
          created_at: string | null
          created_by: string | null
          description: string
          forecast_amount: number
          id: string
          notes: string | null
          organization_id: string
          origin_reference: Json | null
          original_amount: number
          project_id: string
          updated_at: string | null
        }
        Insert: {
          actual_amount?: number
          category?: string | null
          committed_amount?: number
          cost_code: string
          created_at?: string | null
          created_by?: string | null
          description: string
          forecast_amount?: number
          id?: string
          notes?: string | null
          organization_id: string
          origin_reference?: Json | null
          original_amount?: number
          project_id: string
          updated_at?: string | null
        }
        Update: {
          actual_amount?: number
          category?: string | null
          committed_amount?: number
          cost_code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          forecast_amount?: number
          id?: string
          notes?: string | null
          organization_id?: string
          origin_reference?: Json | null
          original_amount?: number
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_items: {
        Row: {
          amount: number | null
          change_order_id: string
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
        }
        Insert: {
          amount?: number | null
          change_order_id: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
        }
        Update: {
          amount?: number | null
          change_order_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_order_items_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          cost_amount: number | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          markup_percent: number | null
          number: number
          organization_id: string
          project_id: string
          source_comparison_id: string | null
          status: string
          time_impact_days: number | null
          title: string
          total_with_markup: number | null
          updated_at: string | null
        }
        Insert: {
          cost_amount?: number | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          markup_percent?: number | null
          number?: number
          organization_id: string
          project_id: string
          source_comparison_id?: string | null
          status?: string
          time_impact_days?: number | null
          title: string
          total_with_markup?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_amount?: number | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          markup_percent?: number | null
          number?: number
          organization_id?: string
          project_id?: string
          source_comparison_id?: string | null
          status?: string
          time_impact_days?: number | null
          title?: string
          total_with_markup?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      classifications: {
        Row: {
          catalog_item_id: string | null
          color: string
          created_at: string
          grout_spec: string | null
          id: string
          lead_time_days: number | null
          material_finish: string | null
          name: string
          organization_id: string
          project_id: string
          submittal_status: string | null
          supplier_name: string | null
          supplier_po: string | null
          unit_cost_cents: number
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          waste_factor: number
        }
        Insert: {
          catalog_item_id?: string | null
          color?: string
          created_at?: string
          grout_spec?: string | null
          id?: string
          lead_time_days?: number | null
          material_finish?: string | null
          name: string
          organization_id: string
          project_id: string
          submittal_status?: string | null
          supplier_name?: string | null
          supplier_po?: string | null
          unit_cost_cents?: number
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          waste_factor?: number
        }
        Update: {
          catalog_item_id?: string | null
          color?: string
          created_at?: string
          grout_spec?: string | null
          id?: string
          lead_time_days?: number | null
          material_finish?: string | null
          name?: string
          organization_id?: string
          project_id?: string
          submittal_status?: string | null
          supplier_name?: string | null
          supplier_po?: string | null
          unit_cost_cents?: number
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          waste_factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "classifications_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          amount_cents: number
          budget_item_id: string
          committed_date: string
          created_at: string
          created_by: string
          description: string
          id: string
          organization_id: string
          project_id: string
          reference_number: string | null
          source_id: string | null
          source_type: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          budget_item_id: string
          committed_date?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          organization_id: string
          project_id: string
          reference_number?: string | null
          source_id?: string | null
          source_type: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          budget_item_id?: string
          committed_date?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          organization_id?: string
          project_id?: string
          reference_number?: string | null
          source_id?: string | null
          source_type?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          amount: number
          budget_item_id: string
          category: string | null
          commitment_id: string | null
          created_at: string | null
          created_by: string
          date: string
          description: string | null
          id: string
          invoice_number: string | null
          organization_id: string
          project_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          budget_item_id: string
          category?: string | null
          commitment_id?: string | null
          created_at?: string | null
          created_by: string
          date: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          organization_id: string
          project_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          budget_item_id?: string
          category?: string | null
          commitment_id?: string | null
          created_at?: string | null
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          organization_id?: string
          project_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_assignments: {
        Row: {
          area_id: string
          assigned_at: string
          assigned_by: string
          created_at: string
          id: string
          organization_id: string
          project_id: string
          worker_id: string
        }
        Insert: {
          area_id: string
          assigned_at?: string
          assigned_by: string
          created_at?: string
          id?: string
          organization_id: string
          project_id: string
          worker_id: string
        }
        Update: {
          area_id?: string
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          id?: string
          organization_id?: string
          project_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_assignments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_cost_logs: {
        Row: {
          area_id: string
          calculated_at: string
          created_at: string
          crew_size: number
          daily_rate_cents: number
          days_lost: number
          delay_log_id: string
          id: string
          organization_id: string
          project_id: string
          total_cost_cents: number
        }
        Insert: {
          area_id: string
          calculated_at?: string
          created_at?: string
          crew_size: number
          daily_rate_cents: number
          days_lost: number
          delay_log_id: string
          id?: string
          organization_id: string
          project_id: string
          total_cost_cents: number
        }
        Update: {
          area_id?: string
          calculated_at?: string
          created_at?: string
          crew_size?: number
          daily_rate_cents?: number
          days_lost?: number
          delay_log_id?: string
          id?: string
          organization_id?: string
          project_id?: string
          total_cost_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "delay_cost_logs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_cost_logs_delay_log_id_fkey"
            columns: ["delay_log_id"]
            isOneToOne: false
            referencedRelation: "production_block_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_cost_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_cost_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          organization_id: string
          page_number: number
          project_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          organization_id: string
          page_number?: number
          project_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          organization_id?: string
          page_number?: number
          project_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signoffs: {
        Row: {
          created_at: string | null
          document_id: string
          document_type: string
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string
          signature_data: Json | null
          signed_at: string | null
          signer_company: string | null
          signer_email: string | null
          signer_name: string | null
          status: string
          token: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          document_type: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          signature_data?: Json | null
          signed_at?: string | null
          signer_company?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          document_type?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          signature_data?: Json | null
          signed_at?: string | null
          signer_company?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_comparison_logs: {
        Row: {
          comparison_result_json: Json
          created_at: string | null
          created_by: string
          id: string
          organization_id: string
          project_id: string
          status: string
          updated_at: string | null
          v1_content_hash: string
          v1_drawing_id: string
          v2_content_hash: string
          v2_drawing_id: string
        }
        Insert: {
          comparison_result_json?: Json
          created_at?: string | null
          created_by: string
          id?: string
          organization_id: string
          project_id: string
          status?: string
          updated_at?: string | null
          v1_content_hash: string
          v1_drawing_id: string
          v2_content_hash: string
          v2_drawing_id: string
        }
        Update: {
          comparison_result_json?: Json
          created_at?: string | null
          created_by?: string
          id?: string
          organization_id?: string
          project_id?: string
          status?: string
          updated_at?: string | null
          v1_content_hash?: string
          v1_drawing_id?: string
          v2_content_hash?: string
          v2_drawing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_comparison_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_comparison_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_comparison_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_comparison_logs_v1_drawing_id_fkey"
            columns: ["v1_drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_comparison_logs_v2_drawing_id_fkey"
            columns: ["v2_drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_register: {
        Row: {
          created_at: string
          created_by: string
          current_revision: string
          discipline: string | null
          id: string
          number: string
          organization_id: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_revision?: string
          discipline?: string | null
          id?: string
          number: string
          organization_id: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_revision?: string
          discipline?: string | null
          id?: string
          number?: string
          organization_id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_register_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_register_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_register_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_revisions: {
        Row: {
          created_at: string
          description: string | null
          drawing_id: string
          file_url: string | null
          id: string
          issued_at: string
          organization_id: string
          revision_code: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          drawing_id: string
          file_url?: string | null
          id?: string
          issued_at?: string
          organization_id: string
          revision_code: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          drawing_id?: string
          file_url?: string | null
          id?: string
          issued_at?: string
          organization_id?: string
          revision_code?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_revisions_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawing_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_revisions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_sets: {
        Row: {
          content_hash: string | null
          created_at: string
          created_by: string
          file_path: string
          id: string
          name: string
          organization_id: string
          page_count: number
          project_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          created_by: string
          file_path: string
          id?: string
          name: string
          organization_id: string
          page_count?: number
          project_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          created_by?: string
          file_path?: string
          id?: string
          name?: string
          organization_id?: string
          page_count?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawings: {
        Row: {
          created_at: string
          drawing_set_id: string
          id: string
          label: string | null
          organization_id: string
          page_number: number
          project_id: string
          scale_factor: number | null
          scale_line_pixels: number | null
          scale_line_real: number | null
          scale_unit: string | null
        }
        Insert: {
          created_at?: string
          drawing_set_id: string
          id?: string
          label?: string | null
          organization_id: string
          page_number?: number
          project_id: string
          scale_factor?: number | null
          scale_line_pixels?: number | null
          scale_line_real?: number | null
          scale_unit?: string | null
        }
        Update: {
          created_at?: string
          drawing_set_id?: string
          id?: string
          label?: string | null
          organization_id?: string
          page_number?: number
          project_id?: string
          scale_factor?: number | null
          scale_line_pixels?: number | null
          scale_line_real?: number | null
          scale_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawings_drawing_set_id_fkey"
            columns: ["drawing_set_id"]
            isOneToOne: false
            referencedRelation: "drawing_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      field_photos: {
        Row: {
          area_id: string | null
          caption: string | null
          context_type: string
          created_at: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          local_uri: string | null
          object_id: string | null
          organization_id: string
          phase_id: string | null
          project_id: string
          remote_url: string | null
          sync_status: string
          taken_at: string
          taken_by: string
          thumbnail_url: string | null
        }
        Insert: {
          area_id?: string | null
          caption?: string | null
          context_type: string
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          local_uri?: string | null
          object_id?: string | null
          organization_id: string
          phase_id?: string | null
          project_id: string
          remote_url?: string | null
          sync_status?: string
          taken_at?: string
          taken_by: string
          thumbnail_url?: string | null
        }
        Update: {
          area_id?: string | null
          caption?: string | null
          context_type?: string
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          local_uri?: string | null
          object_id?: string | null
          organization_id?: string
          phase_id?: string | null
          project_id?: string
          remote_url?: string | null
          sync_status?: string
          taken_at?: string
          taken_by?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_photos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_photos_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_checkins: {
        Row: {
          accuracy_meters: number | null
          created_at: string
          device_id: string | null
          gps_lat: number
          gps_lng: number
          id: string
          organization_id: string
          project_id: string
          type: string
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          created_at?: string
          device_id?: string | null
          gps_lat: number
          gps_lng: number
          id?: string
          organization_id: string
          project_id: string
          type: string
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          created_at?: string
          device_id?: string | null
          gps_lat?: number
          gps_lng?: number
          id?: string
          organization_id?: string
          project_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_checkins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_geofences: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string | null
          organization_id: string
          project_id: string
          radius_meters: number
          updated_at: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          organization_id: string
          project_id: string
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          organization_id?: string
          project_id?: string
          radius_meters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_geofences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_geofences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_geofences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          role?: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          id: string
          opened_at: string | null
          organization_id: string
          pdf_url: string | null
          project_id: string
          receipt_device: string | null
          receipt_ip: string | null
          recipient_email: string | null
          related_area_id: string | null
          related_delay_log_id: string | null
          sent_at: string | null
          sha256_hash: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type: string
          id?: string
          opened_at?: string | null
          organization_id: string
          pdf_url?: string | null
          project_id: string
          receipt_device?: string | null
          receipt_ip?: string | null
          recipient_email?: string | null
          related_area_id?: string | null
          related_delay_log_id?: string | null
          sent_at?: string | null
          sha256_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          id?: string
          opened_at?: string | null
          organization_id?: string
          pdf_url?: string | null
          project_id?: string
          receipt_device?: string | null
          receipt_ip?: string | null
          recipient_email?: string | null
          related_area_id?: string | null
          related_delay_log_id?: string | null
          sent_at?: string | null
          sha256_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_related_area_id_fkey"
            columns: ["related_area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_related_delay_log_id_fkey"
            columns: ["related_delay_log_id"]
            isOneToOne: false
            referencedRelation: "production_block_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_production_targets: {
        Row: {
          created_at: string
          finalized_at: string
          finalized_by: string
          id: string
          notes: string | null
          organization_id: string
          project_id: string
          snapshot_data: Json
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          finalized_at?: string
          finalized_by: string
          id?: string
          notes?: string | null
          organization_id: string
          project_id: string
          snapshot_data: Json
          status?: string
          version?: number
        }
        Update: {
          created_at?: string
          finalized_at?: string
          finalized_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string
          snapshot_data?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "master_production_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_production_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          action_items: Json | null
          agenda: string | null
          attendees: Json | null
          created_at: string | null
          created_by: string
          date: string
          distributed_at: string | null
          id: string
          notes: string | null
          number: number
          organization_id: string
          project_id: string
          title: string
        }
        Insert: {
          action_items?: Json | null
          agenda?: string | null
          attendees?: Json | null
          created_at?: string | null
          created_by: string
          date: string
          distributed_at?: string | null
          id?: string
          notes?: string | null
          number?: number
          organization_id: string
          project_id: string
          title: string
        }
        Update: {
          action_items?: Json | null
          agenda?: string | null
          attendees?: Json | null
          created_at?: string | null
          created_by?: string
          date?: string
          distributed_at?: string | null
          id?: string
          notes?: string | null
          number?: number
          organization_id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          channel: string
          content: Json
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          event_type: string
          id: string
          idempotency_key: string
          max_retries: number
          organization_id: string
          project_id: string | null
          recipient_id: string
          retry_count: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          content?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          max_retries?: number
          organization_id: string
          project_id?: string | null
          recipient_id: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          max_retries?: number
          organization_id?: string
          project_id?: string | null
          recipient_id?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          helper_daily_rate: number
          id: string
          logo_url: string | null
          max_storage_mb: number
          max_users: number
          mechanic_daily_rate: number
          name: string
          onboarding_completed: boolean
          phone: string | null
          plan: string
          primary_trades: string[] | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string
          trial_ends_at: string | null
          unit_system: string
          website: string | null
        }
        Insert: {
          address?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          helper_daily_rate?: number
          id?: string
          logo_url?: string | null
          max_storage_mb?: number
          max_users?: number
          mechanic_daily_rate?: number
          name: string
          onboarding_completed?: boolean
          phone?: string | null
          plan?: string
          primary_trades?: string[] | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          unit_system?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          helper_daily_rate?: number
          id?: string
          logo_url?: string | null
          max_storage_mb?: number
          max_users?: number
          mechanic_daily_rate?: number
          name?: string
          onboarding_completed?: boolean
          phone?: string | null
          plan?: string
          primary_trades?: string[] | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          unit_system?: string
          website?: string | null
        }
        Relationships: []
      }
      pm_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_attachments: {
        Row: {
          content_type: string
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          organization_id: string
          project_id: string
          uploaded_by: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          organization_id: string
          project_id: string
          uploaded_by: string
        }
        Update: {
          content_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          organization_id?: string
          project_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          code: string
          created_at: string
          finish: string | null
          id: string
          material_type: string
          name: string
          notes: string | null
          organization_id: string
          pieces_per_box: number | null
          sf_per_box: number | null
          supplier: string | null
          thickness: string | null
          unit_cost_cents: number
          updated_at: string
          waste_factor: number
          weight_per_box_lbs: number | null
        }
        Insert: {
          code: string
          created_at?: string
          finish?: string | null
          id?: string
          material_type: string
          name: string
          notes?: string | null
          organization_id: string
          pieces_per_box?: number | null
          sf_per_box?: number | null
          supplier?: string | null
          thickness?: string | null
          unit_cost_cents?: number
          updated_at?: string
          waste_factor?: number
          weight_per_box_lbs?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          finish?: string | null
          id?: string
          material_type?: string
          name?: string
          notes?: string | null
          organization_id?: string
          pieces_per_box?: number | null
          sf_per_box?: number | null
          supplier?: string | null
          thickness?: string | null
          unit_cost_cents?: number
          updated_at?: string
          waste_factor?: number
          weight_per_box_lbs?: number | null
        }
        Relationships: []
      }
      production_area_objects: {
        Row: {
          area_id: string
          created_at: string
          id: string
          organization_id: string
          takeoff_object_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          organization_id: string
          takeoff_object_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          takeoff_object_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_area_objects_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_area_objects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_area_objects_takeoff_object_id_fkey"
            columns: ["takeoff_object_id"]
            isOneToOne: false
            referencedRelation: "takeoff_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      production_areas: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          blocked_resolved_at: string | null
          classification_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          floor: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          project_id: string
          quantity: number
          started_at: string | null
          status: string
          template_id: string | null
          unit_type: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          blocked_resolved_at?: string | null
          classification_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          floor?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          project_id: string
          quantity?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          unit_type?: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          blocked_resolved_at?: string | null
          classification_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          floor?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          project_id?: string
          quantity?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          unit_type?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_areas_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "classifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_areas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_areas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "production_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      production_block_logs: {
        Row: {
          area_id: string
          blocked_at: string
          blocked_by: string
          blocked_note: string | null
          blocked_reason: string
          created_at: string
          id: string
          impact_cost_cents: number | null
          impact_days: number | null
          organization_id: string
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          area_id: string
          blocked_at?: string
          blocked_by: string
          blocked_note?: string | null
          blocked_reason: string
          created_at?: string
          id?: string
          impact_cost_cents?: number | null
          impact_days?: number | null
          organization_id: string
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          area_id?: string
          blocked_at?: string
          blocked_by?: string
          blocked_note?: string | null
          blocked_reason?: string
          created_at?: string
          id?: string
          impact_cost_cents?: number | null
          impact_days?: number | null
          organization_id?: string
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_block_logs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_block_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_block_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      production_phase_progress: {
        Row: {
          area_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          inspection_result: string | null
          inspector_id: string | null
          notes: string | null
          organization_id: string
          percent_complete: number
          phase_id: string
          photo_urls: string[] | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          inspection_result?: string | null
          inspector_id?: string | null
          notes?: string | null
          organization_id: string
          percent_complete?: number
          phase_id: string
          photo_urls?: string[] | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          inspection_result?: string | null
          inspector_id?: string | null
          notes?: string | null
          organization_id?: string
          percent_complete?: number
          phase_id?: string
          photo_urls?: string[] | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_phase_progress_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "production_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_phase_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_phase_progress_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "production_template_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      production_template_phases: {
        Row: {
          created_at: string
          crew_role: string
          crew_size: number
          depends_on_phase: number | null
          description: string | null
          estimated_duration_hours: number | null
          id: string
          is_optional: boolean
          name: string
          organization_id: string
          requires_inspection: boolean
          sequence: number
          setting_coverage: number | null
          setting_material: string | null
          template_id: string
          updated_at: string
          wait_hours_after: number
        }
        Insert: {
          created_at?: string
          crew_role?: string
          crew_size?: number
          depends_on_phase?: number | null
          description?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_optional?: boolean
          name: string
          organization_id: string
          requires_inspection?: boolean
          sequence: number
          setting_coverage?: number | null
          setting_material?: string | null
          template_id: string
          updated_at?: string
          wait_hours_after?: number
        }
        Update: {
          created_at?: string
          crew_role?: string
          crew_size?: number
          depends_on_phase?: number | null
          description?: string | null
          estimated_duration_hours?: number | null
          id?: string
          is_optional?: boolean
          name?: string
          organization_id?: string
          requires_inspection?: boolean
          sequence?: number
          setting_coverage?: number | null
          setting_material?: string | null
          template_id?: string
          updated_at?: string
          wait_hours_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_template_phases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_template_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "production_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      production_templates: {
        Row: {
          created_at: string
          created_by: string
          daily_production_rate: number | null
          default_crew_size: number
          description: string | null
          helper_count: number
          id: string
          is_active: boolean
          mechanic_count: number
          name: string
          organization_id: string
          phases_count: number
          progress_unit: string
          project_id: string | null
          trade: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          daily_production_rate?: number | null
          default_crew_size?: number
          description?: string | null
          helper_count?: number
          id?: string
          is_active?: boolean
          mechanic_count?: number
          name: string
          organization_id: string
          phases_count?: number
          progress_unit?: string
          project_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          daily_production_rate?: number | null
          default_crew_size?: number
          description?: string | null
          helper_count?: number
          id?: string
          is_active?: boolean
          mechanic_count?: number
          name?: string
          organization_id?: string
          phases_count?: number
          progress_unit?: string
          project_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deactivated_at: string | null
          full_name: string | null
          id: string
          is_active: boolean
          locale: string
          notify_email: boolean
          notify_telegram: boolean
          organization_id: string
          role: string
          telegram_chat_id: string | null
          telegram_linked_at: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          locale?: string
          notify_email?: boolean
          notify_telegram?: boolean
          organization_id: string
          role?: string
          telegram_chat_id?: string | null
          telegram_linked_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          notify_email?: boolean
          notify_telegram?: boolean
          organization_id?: string
          role?: string
          telegram_chat_id?: string | null
          telegram_linked_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          chunk_count: number | null
          created_at: string
          embedded_at: string | null
          embedding_status: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          organization_id: string
          project_id: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string
          embedded_at?: string | null
          embedding_status?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          organization_id: string
          project_id: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string
        }
        Update: {
          chunk_count?: number | null
          created_at?: string
          embedded_at?: string | null
          embedding_status?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          organization_id?: string
          project_id?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      readyboard_access_logs: {
        Row: {
          accessed_at: string
          client_ip: string | null
          endpoint: string
          id: string
          organization_id: string
          project_id: string
          response_status: number
          token_id: string
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          client_ip?: string | null
          endpoint: string
          id?: string
          organization_id: string
          project_id: string
          response_status?: number
          token_id: string
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          client_ip?: string | null
          endpoint?: string
          id?: string
          organization_id?: string
          project_id?: string
          response_status?: number
          token_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "readyboard_access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readyboard_access_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readyboard_access_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "readyboard_share_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      readyboard_share_tokens: {
        Row: {
          access_count: number
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_revoked: boolean
          label: string
          last_accessed_at: string | null
          organization_id: string
          project_id: string
          revoked_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_revoked?: boolean
          label?: string
          last_accessed_at?: string | null
          organization_id: string
          project_id: string
          revoked_at?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          access_count?: number
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_revoked?: boolean
          label?: string
          last_accessed_at?: string | null
          organization_id?: string
          project_id?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readyboard_share_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readyboard_share_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readyboard_share_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      repeating_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          organization_id: string
          project_id: string
          repeat_count: number
          source_drawing_id: string
          source_object_ids: string[]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          project_id: string
          repeat_count?: number
          source_drawing_id: string
          source_object_ids: string[]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          repeat_count?: number
          source_drawing_id?: string
          source_object_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "repeating_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeating_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeating_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeating_groups_source_drawing_id_fkey"
            columns: ["source_drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
        ]
      }
      report_logs: {
        Row: {
          content_hash: string | null
          created_at: string
          error_message: string | null
          file_size_bytes: number | null
          generated_by: string | null
          id: string
          metadata: Json | null
          organization_id: string
          project_id: string
          qr_token: string
          report_date: string
          report_type: string
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          project_id: string
          qr_token?: string
          report_date: string
          report_type?: string
          status?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          file_size_bytes?: number | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          project_id?: string
          qr_token?: string
          report_date?: string
          report_type?: string
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rfis: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          number: number
          organization_id: string
          project_id: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          number?: number
          organization_id: string
          project_id: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          number?: number
          organization_id?: string
          project_id?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfis_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfis_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_documents: {
        Row: {
          content: Json
          created_at: string | null
          created_by: string
          doc_type: string
          id: string
          number: number
          organization_id: string
          project_id: string
          signatures: Json | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: Json
          created_at?: string | null
          created_by: string
          doc_type: string
          id?: string
          number?: number
          organization_id: string
          project_id: string
          signatures?: Json | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          created_by?: string
          doc_type?: string
          id?: string
          number?: number
          organization_id?: string
          project_id?: string
          signatures?: Json | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_tasks: {
        Row: {
          assigned_trade: string | null
          created_at: string | null
          depends_on: string[] | null
          duration_days: number | null
          end_date: string | null
          id: string
          milestone: boolean | null
          name: string
          organization_id: string
          percent_complete: number | null
          project_id: string
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_trade?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          duration_days?: number | null
          end_date?: string | null
          id?: string
          milestone?: boolean | null
          name: string
          organization_id: string
          percent_complete?: number | null
          project_id: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_trade?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          duration_days?: number | null
          end_date?: string | null
          id?: string
          milestone?: boolean | null
          name?: string
          organization_id?: string
          percent_complete?: number | null
          project_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_import_logs: {
        Row: {
          areas_created: number
          created_at: string
          detected_format: string
          error_details: Json | null
          errors_count: number
          file_name: string
          file_size_bytes: number
          id: string
          imported_by: string
          imported_total_qty: number | null
          objects_created: number
          organization_id: string
          original_total_qty: number | null
          project_id: string
          status: string
          total_rows: number
          warnings_count: number
        }
        Insert: {
          areas_created?: number
          created_at?: string
          detected_format?: string
          error_details?: Json | null
          errors_count?: number
          file_name: string
          file_size_bytes?: number
          id?: string
          imported_by: string
          imported_total_qty?: number | null
          objects_created?: number
          organization_id: string
          original_total_qty?: number | null
          project_id: string
          status?: string
          total_rows?: number
          warnings_count?: number
        }
        Update: {
          areas_created?: number
          created_at?: string
          detected_format?: string
          error_details?: Json | null
          errors_count?: number
          file_name?: string
          file_size_bytes?: number
          id?: string
          imported_by?: string
          imported_total_qty?: number | null
          objects_created?: number
          organization_id?: string
          original_total_qty?: number | null
          project_id?: string
          status?: string
          total_rows?: number
          warnings_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "scope_import_logs_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_import_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_cutting_lists: {
        Row: {
          created_at: string
          created_by: string
          fabrication_order_id: string
          id: string
          notes: string | null
          optimization_score: number | null
          organization_id: string
          pieces_data: Json
          project_id: string | null
          slab_length_mm: number
          slab_thickness_mm: number | null
          slab_width_mm: number
          title: string
          total_slabs_needed: number
          updated_at: string
          waste_percentage: number
        }
        Insert: {
          created_at?: string
          created_by: string
          fabrication_order_id: string
          id?: string
          notes?: string | null
          optimization_score?: number | null
          organization_id: string
          pieces_data?: Json
          project_id?: string | null
          slab_length_mm: number
          slab_thickness_mm?: number | null
          slab_width_mm: number
          title?: string
          total_slabs_needed?: number
          updated_at?: string
          waste_percentage?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          fabrication_order_id?: string
          id?: string
          notes?: string | null
          optimization_score?: number | null
          organization_id?: string
          pieces_data?: Json
          project_id?: string | null
          slab_length_mm?: number
          slab_thickness_mm?: number | null
          slab_width_mm?: number
          title?: string
          total_slabs_needed?: number
          updated_at?: string
          waste_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_cutting_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_cutting_lists_fabrication_order_id_fkey"
            columns: ["fabrication_order_id"]
            isOneToOne: false
            referencedRelation: "shop_fabrication_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_cutting_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_fabrication_items: {
        Row: {
          completed_quantity: number
          created_at: string
          created_by: string
          current_stage: string
          description: string
          fabrication_order_id: string
          id: string
          length_mm: number
          material_type: string | null
          notes: string | null
          organization_id: string
          origin_reference: Json | null
          project_id: string | null
          quantity: number
          sequence: number
          thickness_mm: number | null
          unit_cost_cents: number
          updated_at: string
          warehouse_item_id: string | null
          warehouse_transaction_id: string | null
          waste_cost_cents: number
          waste_qty: number
          width_mm: number
        }
        Insert: {
          completed_quantity?: number
          created_at?: string
          created_by: string
          current_stage?: string
          description: string
          fabrication_order_id: string
          id?: string
          length_mm: number
          material_type?: string | null
          notes?: string | null
          organization_id: string
          origin_reference?: Json | null
          project_id?: string | null
          quantity?: number
          sequence: number
          thickness_mm?: number | null
          unit_cost_cents?: number
          updated_at?: string
          warehouse_item_id?: string | null
          warehouse_transaction_id?: string | null
          waste_cost_cents?: number
          waste_qty?: number
          width_mm: number
        }
        Update: {
          completed_quantity?: number
          created_at?: string
          created_by?: string
          current_stage?: string
          description?: string
          fabrication_order_id?: string
          id?: string
          length_mm?: number
          material_type?: string | null
          notes?: string | null
          organization_id?: string
          origin_reference?: Json | null
          project_id?: string | null
          quantity?: number
          sequence?: number
          thickness_mm?: number | null
          unit_cost_cents?: number
          updated_at?: string
          warehouse_item_id?: string | null
          warehouse_transaction_id?: string | null
          waste_cost_cents?: number
          waste_qty?: number
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_fabrication_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_fabrication_items_fabrication_order_id_fkey"
            columns: ["fabrication_order_id"]
            isOneToOne: false
            referencedRelation: "shop_fabrication_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_fabrication_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_fabrication_items_warehouse_item_id_fkey"
            columns: ["warehouse_item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_fabrication_items_warehouse_transaction_id_fkey"
            columns: ["warehouse_transaction_id"]
            isOneToOne: false
            referencedRelation: "warehouse_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_fabrication_orders: {
        Row: {
          completed_date: string | null
          completed_pieces: number
          created_at: string
          created_by: string
          delivered_date: string | null
          description: string | null
          due_date: string | null
          id: string
          labor_cost_cents: number
          material_cost_cents: number
          number: number
          organization_id: string
          origin_reference: Json | null
          priority: string
          project_id: string | null
          status: string
          title: string
          total_pieces: number
          updated_at: string
          waste_cost_cents: number
        }
        Insert: {
          completed_date?: string | null
          completed_pieces?: number
          created_at?: string
          created_by: string
          delivered_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          labor_cost_cents?: number
          material_cost_cents?: number
          number?: number
          organization_id: string
          origin_reference?: Json | null
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          total_pieces?: number
          updated_at?: string
          waste_cost_cents?: number
        }
        Update: {
          completed_date?: string | null
          completed_pieces?: number
          created_at?: string
          created_by?: string
          delivered_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          labor_cost_cents?: number
          material_cost_cents?: number
          number?: number
          organization_id?: string
          origin_reference?: Json | null
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          total_pieces?: number
          updated_at?: string
          waste_cost_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_fabrication_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_fabrication_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_qc_inspections: {
        Row: {
          created_at: string
          created_by: string
          defect_description: string | null
          defect_type: string | null
          fabrication_item_id: string
          id: string
          inspector_id: string
          notes: string | null
          organization_id: string
          photo_urls: Json | null
          project_id: string | null
          result: string
        }
        Insert: {
          created_at?: string
          created_by: string
          defect_description?: string | null
          defect_type?: string | null
          fabrication_item_id: string
          id?: string
          inspector_id: string
          notes?: string | null
          organization_id: string
          photo_urls?: Json | null
          project_id?: string | null
          result: string
        }
        Update: {
          created_at?: string
          created_by?: string
          defect_description?: string | null
          defect_type?: string | null
          fabrication_item_id?: string
          id?: string
          inspector_id?: string
          notes?: string | null
          organization_id?: string
          photo_urls?: Json | null
          project_id?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_qc_inspections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_qc_inspections_fabrication_item_id_fkey"
            columns: ["fabrication_item_id"]
            isOneToOne: false
            referencedRelation: "shop_fabrication_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_qc_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_qc_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_stage_transitions: {
        Row: {
          created_at: string
          created_by: string
          duration_seconds: number | null
          fabrication_item_id: string
          from_stage: string
          id: string
          notes: string | null
          operator_id: string | null
          organization_id: string
          project_id: string | null
          to_stage: string
          warehouse_transaction_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          fabrication_item_id: string
          from_stage: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          organization_id: string
          project_id?: string | null
          to_stage: string
          warehouse_transaction_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          fabrication_item_id?: string
          from_stage?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          organization_id?: string
          project_id?: string | null
          to_stage?: string
          warehouse_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_stage_transitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_stage_transitions_fabrication_item_id_fkey"
            columns: ["fabrication_item_id"]
            isOneToOne: false
            referencedRelation: "shop_fabrication_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_stage_transitions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_stage_transitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_stage_transitions_warehouse_transaction_id_fkey"
            columns: ["warehouse_transaction_id"]
            isOneToOne: false
            referencedRelation: "warehouse_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      submittals: {
        Row: {
          created_at: string | null
          created_by: string
          current_revision: number
          due_date: string | null
          file_path: string | null
          id: string
          notes: string | null
          number: number
          organization_id: string
          project_id: string
          spec_section: string | null
          status: string
          submitted_to: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          current_revision?: number
          due_date?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          number?: number
          organization_id: string
          project_id: string
          spec_section?: string | null
          status?: string
          submitted_to?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          current_revision?: number
          due_date?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          number?: number
          organization_id?: string
          project_id?: string
          spec_section?: string | null
          status?: string
          submitted_to?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submittals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submittals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_objects: {
        Row: {
          area_pixels: number | null
          area_sqft: number | null
          classification_id: string | null
          coordinates: Json
          created_at: string
          created_by: string
          drawing_id: string
          fabric_data: Json | null
          id: string
          is_deduction: boolean
          label: string | null
          length_ft: number | null
          length_pixels: number | null
          organization_id: string
          project_id: string
          source_object_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          area_pixels?: number | null
          area_sqft?: number | null
          classification_id?: string | null
          coordinates?: Json
          created_at?: string
          created_by: string
          drawing_id: string
          fabric_data?: Json | null
          id?: string
          is_deduction?: boolean
          label?: string | null
          length_ft?: number | null
          length_pixels?: number | null
          organization_id: string
          project_id: string
          source_object_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          area_pixels?: number | null
          area_sqft?: number | null
          classification_id?: string | null
          coordinates?: Json
          created_at?: string
          created_by?: string
          drawing_id?: string
          fabric_data?: Json | null
          id?: string
          is_deduction?: boolean
          label?: string | null
          length_ft?: number | null
          length_pixels?: number | null
          organization_id?: string
          project_id?: string
          source_object_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_takeoff_objects_classification"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "classifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_objects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_objects_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_objects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_objects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_objects_source_object_id_fkey"
            columns: ["source_object_id"]
            isOneToOne: false
            referencedRelation: "takeoff_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          profile_id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id: string
          profile_id: string
          token?: string
          used?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_link_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transmittals: {
        Row: {
          comments: string | null
          created_at: string | null
          created_by: string
          id: string
          items: Json
          number: number
          organization_id: string
          project_id: string
          sent_at: string | null
          status: string
          subject: string
          to_company: string
          to_contact: string | null
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          items?: Json
          number?: number
          organization_id: string
          project_id: string
          sent_at?: string | null
          status?: string
          subject: string
          to_company: string
          to_contact?: string | null
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          items?: Json
          number?: number
          organization_id?: string
          project_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_company?: string
          to_contact?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transmittals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transmittals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transmittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_cycle_counts: {
        Row: {
          abc_filter: string | null
          completed_date: string | null
          count_data: Json
          created_at: string | null
          created_by: string
          id: string
          items_counted: number
          items_with_variance: number
          location_filter: string | null
          number: number
          organization_id: string
          project_id: string | null
          scheduled_date: string
          status: string
          title: string
          total_variance_value_cents: number
          updated_at: string | null
        }
        Insert: {
          abc_filter?: string | null
          completed_date?: string | null
          count_data?: Json
          created_at?: string | null
          created_by: string
          id?: string
          items_counted?: number
          items_with_variance?: number
          location_filter?: string | null
          number?: number
          organization_id: string
          project_id?: string | null
          scheduled_date: string
          status?: string
          title: string
          total_variance_value_cents?: number
          updated_at?: string | null
        }
        Update: {
          abc_filter?: string | null
          completed_date?: string | null
          count_data?: Json
          created_at?: string | null
          created_by?: string
          id?: string
          items_counted?: number
          items_with_variance?: number
          location_filter?: string | null
          number?: number
          organization_id?: string
          project_id?: string | null
          scheduled_date?: string
          status?: string
          title?: string
          total_variance_value_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_cycle_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_cycle_counts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_cycle_counts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_items: {
        Row: {
          abc_class: string | null
          condition: string
          created_at: string | null
          created_by: string
          description: string
          id: string
          location_id: string | null
          min_stock_level: number
          notes: string | null
          organization_id: string
          project_id: string | null
          quantity_on_hand: number
          sku: string
          unit: string
          unit_cost_cents: number
          updated_at: string | null
        }
        Insert: {
          abc_class?: string | null
          condition?: string
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          location_id?: string | null
          min_stock_level?: number
          notes?: string | null
          organization_id: string
          project_id?: string | null
          quantity_on_hand?: number
          sku: string
          unit?: string
          unit_cost_cents?: number
          updated_at?: string | null
        }
        Update: {
          abc_class?: string | null
          condition?: string
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          location_id?: string | null
          min_stock_level?: number
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          quantity_on_hand?: number
          sku?: string
          unit?: string
          unit_cost_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          aisle: string | null
          bay: string | null
          bin: string | null
          code: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean
          label: string | null
          level: string | null
          organization_id: string
          project_id: string | null
          updated_at: string | null
          zone: string
        }
        Insert: {
          aisle?: string | null
          bay?: string | null
          bin?: string | null
          code: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean
          label?: string | null
          level?: string | null
          organization_id: string
          project_id?: string | null
          updated_at?: string | null
          zone: string
        }
        Update: {
          aisle?: string | null
          bay?: string | null
          bin?: string | null
          code?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean
          label?: string | null
          level?: string | null
          organization_id?: string
          project_id?: string | null
          updated_at?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_transactions: {
        Row: {
          created_at: string | null
          created_by: string
          from_location_id: string | null
          id: string
          item_id: string
          notes: string | null
          organization_id: string
          project_id: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_number: string | null
          to_location_id: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          from_location_id?: string | null
          id?: string
          item_id: string
          notes?: string | null
          organization_id: string
          project_id?: string | null
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reference_number?: string | null
          to_location_id?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          from_location_id?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reference_number?: string | null
          to_location_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transactions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tickets: {
        Row: {
          area: string | null
          created_at: string | null
          created_by: string
          description: string | null
          floor: string | null
          id: string
          number: number
          organization_id: string
          photos: Json | null
          project_id: string
          related_drawing_id: string | null
          related_rfi_id: string | null
          signature_url: string | null
          signed_at: string | null
          signed_by_id: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          floor?: string | null
          id?: string
          number?: number
          organization_id: string
          photos?: Json | null
          project_id: string
          related_drawing_id?: string | null
          related_rfi_id?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          floor?: string | null
          id?: string
          number?: number
          organization_id?: string
          photos?: Json | null
          project_id?: string
          related_drawing_id?: string | null
          related_rfi_id?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tickets_related_drawing_id_fkey"
            columns: ["related_drawing_id"]
            isOneToOne: false
            referencedRelation: "drawing_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tickets_related_rfi_id_fkey"
            columns: ["related_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tickets_signed_by_id_fkey"
            columns: ["signed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { accepting_user_id: string; invitation_token: string }
        Returns: Json
      }
      advance_fabrication_stage: {
        Args: {
          p_consume_qty?: number
          p_created_by?: string
          p_duration_seconds?: number
          p_item_id: string
          p_notes?: string
          p_operator_id: string
          p_to_stage: string
        }
        Returns: Json
      }
      increment_share_token_access: {
        Args: { token_id: string }
        Returns: undefined
      }
      is_valid_fab_stage_transition: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      match_document_chunks: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_min_similarity?: number
          p_project_id: string
        }
        Returns: {
          content: string
          document_id: string
          document_name: string
          id: string
          page_number: number
          similarity: number
        }[]
      }
      record_warehouse_transaction: {
        Args: {
          p_created_by?: string
          p_from_location_id?: string
          p_item_id: string
          p_notes?: string
          p_organization_id: string
          p_project_id: string
          p_quantity_change: number
          p_reference_number?: string
          p_to_location_id?: string
          p_transaction_type: string
        }
        Returns: Json
      }
      transfer_ownership: { Args: { new_owner_id: string }; Returns: Json }
      user_org_id: { Args: never; Returns: string }
      user_role: { Args: never; Returns: string }
    }
    Enums: {
      document_type:
        | "plan"
        | "spec"
        | "contract"
        | "rfi_attachment"
        | "submittal_attachment"
      unit_type: "area" | "length" | "count"
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
      document_type: [
        "plan",
        "spec",
        "contract",
        "rfi_attachment",
        "submittal_attachment",
      ],
      unit_type: ["area", "length", "count"],
    },
  },
} as const

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
      alerts: {
        Row: {
          alert_type: string
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          project_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          project_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          project_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_migrations: {
        Row: {
          applied_at: string | null
          name: string
        }
        Insert: {
          applied_at?: string | null
          name: string
        }
        Update: {
          applied_at?: string | null
          name?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          accuracy: number | null
          company_id: string
          distance_m: number | null
          id: string
          kind: string
          lat: number | null
          lng: number | null
          marked_at: string
          notes: string | null
          photo_path: string | null
          project_id: string
          user_id: string
          within_geofence: boolean | null
        }
        Insert: {
          accuracy?: number | null
          company_id: string
          distance_m?: number | null
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          marked_at?: string
          notes?: string | null
          photo_path?: string | null
          project_id: string
          user_id: string
          within_geofence?: boolean | null
        }
        Update: {
          accuracy?: number | null
          company_id?: string
          distance_m?: number | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          marked_at?: string
          notes?: string | null
          photo_path?: string | null
          project_id?: string
          user_id?: string
          within_geofence?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          company_id: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          project_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          project_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          project_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      budget_changes: {
        Row: {
          amount: number
          change_type: string
          created_at: string
          created_by: string | null
          id: string
          new_budget: number | null
          previous_budget: number | null
          project_id: string
          reason: string | null
          wbs_id: string | null
        }
        Insert: {
          amount: number
          change_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_budget?: number | null
          previous_budget?: number | null
          project_id: string
          reason?: string | null
          wbs_id?: string | null
        }
        Update: {
          amount?: number
          change_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_budget?: number | null
          previous_budget?: number | null
          project_id?: string
          reason?: string | null
          wbs_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_changes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_changes_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "budget_changes_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_boxes: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          project_id: string
          responsible_id: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          project_id: string
          responsible_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          responsible_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_boxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_boxes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_boxes_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          box_id: string
          concept: string
          created_at: string
          created_by: string | null
          expense_id: string | null
          fund_request_id: string | null
          id: string
          moved_at: string
          movement_type: string
          project_id: string
        }
        Insert: {
          amount: number
          box_id: string
          concept: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          fund_request_id?: string | null
          id?: string
          moved_at?: string
          movement_type: string
          project_id: string
        }
        Update: {
          amount?: number
          box_id?: string
          concept?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          fund_request_id?: string | null
          id?: string
          moved_at?: string
          movement_type?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "v_cash_box_balance"
            referencedColumns: ["box_id"]
          },
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_paid"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "cash_movements_fund_request_id_fkey"
            columns: ["fund_request_id"]
            isOneToOne: false
            referencedRelation: "fund_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          amount: number
          collected_at: string
          created_at: string
          id: string
          notes: string | null
          operation_number: string | null
          project_id: string
          registered_by: string | null
          valuation_id: string
        }
        Insert: {
          amount: number
          collected_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          operation_number?: string | null
          project_id: string
          registered_by?: string | null
          valuation_id: string
        }
        Update: {
          amount?: number
          collected_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          operation_number?: string | null
          project_id?: string
          registered_by?: string | null
          valuation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string
          active: boolean
          code: string
          created_at: string
          id: string
          legal_name: string | null
          logo_key: string | null
          name: string
          ruc: string | null
          sort: number
          tagline: string | null
        }
        Insert: {
          accent_color?: string
          active?: boolean
          code: string
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_key?: string | null
          name: string
          ruc?: string | null
          sort?: number
          tagline?: string | null
        }
        Update: {
          accent_color?: string
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_key?: string | null
          name?: string
          ruc?: string | null
          sort?: number
          tagline?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          all_projects: boolean
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          all_projects?: boolean
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          all_projects?: boolean
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          brand: string | null
          code: string
          company_id: string
          created_at: string
          equipment_type: string | null
          id: string
          model: string | null
          name: string
          notes: string | null
          order_id: string | null
          ownership: string
          project_id: string | null
          rate_amount: number | null
          rate_period: string | null
          serial: string | null
          status: string
        }
        Insert: {
          brand?: string | null
          code: string
          company_id: string
          created_at?: string
          equipment_type?: string | null
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          order_id?: string | null
          ownership?: string
          project_id?: string | null
          rate_amount?: number | null
          rate_period?: string | null
          serial?: string | null
          status?: string
        }
        Update: {
          brand?: string | null
          code?: string
          company_id?: string
          created_at?: string
          equipment_type?: string | null
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          order_id?: string | null
          ownership?: string
          project_id?: string | null
          rate_amount?: number | null
          rate_period?: string | null
          serial?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balance"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "equipment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assignments: {
        Row: {
          assigned_to: string
          assigned_to_dni: string | null
          condition_in: string | null
          condition_out: string | null
          delivered_at: string
          delivered_by: string | null
          equipment_id: string
          id: string
          notes: string | null
          project_id: string
          returned_at: string | null
          signature_in: string | null
          signature_out: string | null
        }
        Insert: {
          assigned_to: string
          assigned_to_dni?: string | null
          condition_in?: string | null
          condition_out?: string | null
          delivered_at?: string
          delivered_by?: string | null
          equipment_id: string
          id?: string
          notes?: string | null
          project_id: string
          returned_at?: string | null
          signature_in?: string | null
          signature_out?: string | null
        }
        Update: {
          assigned_to?: string
          assigned_to_dni?: string | null
          condition_in?: string | null
          condition_out?: string | null
          delivered_at?: string
          delivered_by?: string | null
          equipment_id?: string
          id?: string
          notes?: string | null
          project_id?: string
          returned_at?: string | null
          signature_in?: string | null
          signature_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignments_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_allocations: {
        Row: {
          amount_pen: number
          description: string | null
          expense_id: string
          id: string
          wbs_id: string
        }
        Insert: {
          amount_pen: number
          description?: string | null
          expense_id: string
          id?: string
          wbs_id: string
        }
        Update: {
          amount_pen?: number
          description?: string | null
          expense_id?: string
          id?: string
          wbs_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_paid"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_allocations_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "expense_allocations_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_files: {
        Row: {
          captured_at: string | null
          created_at: string
          expense_id: string
          file_name: string | null
          file_path: string
          id: string
          lat: number | null
          lng: number | null
          mime: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          expense_id: string
          file_name?: string | null
          file_path: string
          id?: string
          lat?: number | null
          lng?: number | null
          mime?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          expense_id?: string
          file_name?: string | null
          file_path?: string
          id?: string
          lat?: number | null
          lng?: number | null
          mime?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_files_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_files_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_paid"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string | null
          company_id: string
          cost_pen: number | null
          created_at: string
          created_by: string | null
          currency: string
          declared_at: string | null
          description: string
          doc_number: string | null
          doc_type: Database["public"]["Enums"]["doc_type"]
          due_date: string | null
          exceeds_budget: boolean
          exchange_rate: number
          id: string
          igv: number | null
          issue_date: string
          lat: number | null
          lng: number | null
          observation: string | null
          order_id: string | null
          order_override: boolean
          origin: string
          payable_pen: number | null
          phase_id: string | null
          project_id: string
          reception_date: string | null
          retention_pct: number
          retention_pen: number | null
          seq: number | null
          series: string | null
          status: Database["public"]["Enums"]["expense_status"]
          subtotal: number | null
          supplier_id: string | null
          tax_condition: string
          total: number
          total_pen: number | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          wbs_id: string | null
          week: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          company_id: string
          cost_pen?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          declared_at?: string | null
          description: string
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          due_date?: string | null
          exceeds_budget?: boolean
          exchange_rate?: number
          id?: string
          igv?: number | null
          issue_date?: string
          lat?: number | null
          lng?: number | null
          observation?: string | null
          order_id?: string | null
          order_override?: boolean
          origin?: string
          payable_pen?: number | null
          phase_id?: string | null
          project_id: string
          reception_date?: string | null
          retention_pct?: number
          retention_pen?: number | null
          seq?: number | null
          series?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          subtotal?: number | null
          supplier_id?: string | null
          tax_condition?: string
          total: number
          total_pen?: number | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wbs_id?: string | null
          week?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          company_id?: string
          cost_pen?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          declared_at?: string | null
          description?: string
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          due_date?: string | null
          exceeds_budget?: boolean
          exchange_rate?: number
          id?: string
          igv?: number | null
          issue_date?: string
          lat?: number | null
          lng?: number | null
          observation?: string | null
          order_id?: string | null
          order_override?: boolean
          origin?: string
          payable_pen?: number | null
          phase_id?: string | null
          project_id?: string
          reception_date?: string | null
          retention_pct?: number
          retention_pen?: number | null
          seq?: number | null
          series?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          subtotal?: number | null
          supplier_id?: string | null
          tax_condition?: string
          total?: number
          total_pen?: number | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wbs_id?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balance"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "expenses_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "expenses_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_requests: {
        Row: {
          amount: number
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          box_id: string | null
          company_id: string
          created_at: string
          deposit_operation: string | null
          deposited_at: string | null
          deposited_by: string | null
          id: string
          needed_by: string | null
          project_id: string
          reason: string
          rendered_amount: number | null
          rendered_at: string | null
          requested_by: string | null
          seq: number | null
          status: string
        }
        Insert: {
          amount: number
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          box_id?: string | null
          company_id: string
          created_at?: string
          deposit_operation?: string | null
          deposited_at?: string | null
          deposited_by?: string | null
          id?: string
          needed_by?: string | null
          project_id: string
          reason: string
          rendered_amount?: number | null
          rendered_at?: string | null
          requested_by?: string | null
          seq?: number | null
          status?: string
        }
        Update: {
          amount?: number
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          box_id?: string | null
          company_id?: string
          created_at?: string
          deposit_operation?: string | null
          deposited_at?: string | null
          deposited_by?: string | null
          id?: string
          needed_by?: string | null
          project_id?: string
          reason?: string
          rendered_amount?: number | null
          rendered_at?: string | null
          requested_by?: string | null
          seq?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_requests_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "cash_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_requests_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "v_cash_box_balance"
            referencedColumns: ["box_id"]
          },
          {
            foreignKeyName: "fund_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_requests_deposited_by_fkey"
            columns: ["deposited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_projections: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["labor_category"]
          id: string
          phase_id: string | null
          project_id: string
          workers: number | null
        }
        Insert: {
          amount?: number
          category: Database["public"]["Enums"]["labor_category"]
          id?: string
          phase_id?: string | null
          project_id: string
          workers?: number | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["labor_category"]
          id?: string
          phase_id?: string | null
          project_id?: string
          workers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_projections_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_projections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category: string
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          min_stock: number
          name: string
          unit: string
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          min_stock?: number
          name: string
          unit: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          min_stock?: number
          name?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          description: string
          id: string
          material_id: string | null
          order_id: string
          quantity: number
          total: number | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          material_id?: string | null
          order_id: string
          quantity?: number
          total?: number | null
          unit?: string | null
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          material_id?: string | null
          order_id?: string
          quantity?: number
          total?: number | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_material_fk"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balance"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_frequency: string
          company_id: string
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          exchange_rate: number
          id: string
          igv: number
          includes_igv: boolean
          notes: string | null
          number: string | null
          order_type: string
          phase_id: string | null
          project_id: string
          requested_by: string | null
          seq: number | null
          start_date: string | null
          status: string
          subtotal: number
          subtotal_pen: number
          supplier_id: string | null
          title: string
          total: number
          wbs_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_frequency?: string
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          exchange_rate?: number
          id?: string
          igv?: number
          includes_igv?: boolean
          notes?: string | null
          number?: string | null
          order_type: string
          phase_id?: string | null
          project_id: string
          requested_by?: string | null
          seq?: number | null
          start_date?: string | null
          status?: string
          subtotal?: number
          subtotal_pen?: number
          supplier_id?: string | null
          title: string
          total?: number
          wbs_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_frequency?: string
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          exchange_rate?: number
          id?: string
          igv?: number
          includes_igv?: boolean
          notes?: string | null
          number?: string | null
          order_type?: string
          phase_id?: string | null
          project_id?: string
          requested_by?: string | null
          seq?: number | null
          start_date?: string | null
          status?: string
          subtotal?: number
          subtotal_pen?: number
          supplier_id?: string | null
          title?: string
          total?: number
          wbs_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "orders_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_pen: number
          bank: string | null
          company_id: string | null
          created_at: string
          expense_id: string
          id: string
          method: string
          notes: string | null
          operation_number: string | null
          paid_at: string
          percentage: number | null
          project_id: string | null
          registered_by: string | null
          void_reason: string | null
          voided: boolean
        }
        Insert: {
          amount_pen: number
          bank?: string | null
          company_id?: string | null
          created_at?: string
          expense_id: string
          id?: string
          method?: string
          notes?: string | null
          operation_number?: string | null
          paid_at?: string
          percentage?: number | null
          project_id?: string | null
          registered_by?: string | null
          void_reason?: string | null
          voided?: boolean
        }
        Update: {
          amount_pen?: number
          bank?: string | null
          company_id?: string | null
          created_at?: string
          expense_id?: string
          id?: string
          method?: string
          notes?: string | null
          operation_number?: string | null
          paid_at?: string
          percentage?: number | null
          project_id?: string | null
          registered_by?: string | null
          void_reason?: string | null
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_paid"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          amount: number
          category: string
          days: number | null
          id: string
          payroll_id: string
          workers: number
        }
        Insert: {
          amount?: number
          category: string
          days?: number | null
          id?: string
          payroll_id: string
          workers?: number
        }
        Update: {
          amount?: number
          category?: string
          days?: number | null
          id?: string
          payroll_id?: string
          workers?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payrolls"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          notes: string | null
          payroll_type: string
          period_end: string | null
          period_label: string
          period_start: string | null
          phase_id: string | null
          project_id: string
          total: number
          wbs_id: string | null
          week: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          payroll_type?: string
          period_end?: string | null
          period_label: string
          period_start?: string | null
          phase_id?: string | null
          project_id: string
          total?: number
          wbs_id?: string | null
          week?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          payroll_type?: string
          period_end?: string | null
          period_label?: string
          period_start?: string | null
          phase_id?: string | null
          project_id?: string
          total?: number
          wbs_id?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_paid"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "payrolls_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "payrolls_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      period_closures: {
        Row: {
          closed_at: string
          closed_by: string | null
          id: string
          label: string | null
          period_end: string
          period_start: string
          project_id: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          id?: string
          label?: string | null
          period_end: string
          period_start: string
          project_id: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          id?: string
          label?: string | null
          period_end?: string
          period_start?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          code: string
          color: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_id: string
          sale_amount: number
          sort: number
          start_date: string | null
        }
        Insert: {
          code: string
          color?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_id: string
          sale_amount?: number
          sort?: number
          start_date?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_id?: string
          sale_amount?: number
          sort?: number
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_color: string | null
          created_at: string
          dni: string | null
          email: string
          full_name: string
          id: string
          is_holding_admin: boolean
          last_seen_at: string | null
          phone: string | null
          position: string | null
        }
        Insert: {
          active?: boolean
          avatar_color?: string | null
          created_at?: string
          dni?: string | null
          email: string
          full_name: string
          id: string
          is_holding_admin?: boolean
          last_seen_at?: string | null
          phone?: string | null
          position?: string | null
        }
        Update: {
          active?: boolean
          avatar_color?: string | null
          created_at?: string
          dni?: string | null
          email?: string
          full_name?: string
          id?: string
          is_holding_admin?: boolean
          last_seen_at?: string | null
          phone?: string | null
          position?: string | null
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          doc_kind: string
          expiry_date: string | null
          file_path: string | null
          id: string
          issue_date: string | null
          notes: string | null
          number: string | null
          project_id: string
          title: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          doc_kind: string
          expiry_date?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          number?: string | null
          project_id: string
          title: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          doc_kind?: string
          expiry_date?: string | null
          file_path?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          number?: string | null
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      project_members: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          admin_id: string | null
          alert_threshold: number
          client_name: string | null
          client_ruc: string | null
          closed_at: string | null
          code: string
          company_id: string
          contract_amount: number
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          exchange_rate: number
          extended_end_date: string | null
          geofence_radius: number
          id: string
          lat: number | null
          lng: number | null
          location: string | null
          manager_id: string | null
          name: string
          project_type: string
          region: string | null
          resident_id: string | null
          short_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          template_of: string | null
        }
        Insert: {
          address?: string | null
          admin_id?: string | null
          alert_threshold?: number
          client_name?: string | null
          client_ruc?: string | null
          closed_at?: string | null
          code: string
          company_id: string
          contract_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          exchange_rate?: number
          extended_end_date?: string | null
          geofence_radius?: number
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          manager_id?: string | null
          name: string
          project_type?: string
          region?: string | null
          resident_id?: string | null
          short_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_of?: string | null
        }
        Update: {
          address?: string | null
          admin_id?: string | null
          alert_threshold?: number
          client_name?: string | null
          client_ruc?: string | null
          closed_at?: string | null
          code?: string
          company_id?: string
          contract_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          exchange_rate?: number
          extended_end_date?: string | null
          geofence_radius?: number
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          manager_id?: string | null
          name?: string
          project_type?: string
          region?: string | null
          resident_id?: string | null
          short_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_of_fkey"
            columns: ["template_of"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          document_ref: string | null
          expense_id: string | null
          front: string | null
          id: string
          material_id: string
          moved_at: string
          movement_type: string
          notes: string | null
          order_id: string | null
          phase_id: string | null
          photo_path: string | null
          project_id: string
          quantity: number
          responsible_name: string | null
          supplier_id: string | null
          total_cost: number | null
          unit_cost: number
          wbs_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          document_ref?: string | null
          expense_id?: string | null
          front?: string | null
          id?: string
          material_id: string
          moved_at?: string
          movement_type: string
          notes?: string | null
          order_id?: string | null
          phase_id?: string | null
          photo_path?: string | null
          project_id: string
          quantity: number
          responsible_name?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          unit_cost?: number
          wbs_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_ref?: string | null
          expense_id?: string | null
          front?: string | null
          id?: string
          material_id?: string
          moved_at?: string
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          phase_id?: string | null
          photo_path?: string | null
          project_id?: string
          quantity?: number
          responsible_name?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          unit_cost?: number
          wbs_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_paid"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_balance"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "stock_movements_wbs_id_fkey"
            columns: ["wbs_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_number: string | null
          address: string | null
          bank: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          kind: string
          name: string
          phone: string | null
          ruc: string
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          bank?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name: string
          phone?: string | null
          ruc: string
        }
        Update: {
          account_number?: string | null
          address?: string | null
          bank?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string
          phone?: string | null
          ruc?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          approved_amount: number | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          number: number
          period_end: string | null
          period_start: string | null
          phase_id: string | null
          presented_amount: number
          project_id: string
          status: string
        }
        Insert: {
          approved_amount?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          number: number
          period_end?: string | null
          period_start?: string | null
          phase_id?: string | null
          presented_amount?: number
          project_id: string
          status?: string
        }
        Update: {
          approved_amount?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          number?: number
          period_end?: string | null
          period_start?: string | null
          phase_id?: string | null
          presented_amount?: number
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuations_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wbs_nodes: {
        Row: {
          budget: number
          code: string
          cost_center: string | null
          cost_type: string | null
          created_at: string
          id: string
          is_leaf: boolean
          level: number
          margin: number
          name: string
          parent_id: string | null
          phase_id: string | null
          project_id: string
          sort: number
        }
        Insert: {
          budget?: number
          code: string
          cost_center?: string | null
          cost_type?: string | null
          created_at?: string
          id?: string
          is_leaf?: boolean
          level?: number
          margin?: number
          name: string
          parent_id?: string | null
          phase_id?: string | null
          project_id: string
          sort?: number
        }
        Update: {
          budget?: number
          code?: string
          cost_center?: string | null
          cost_type?: string | null
          created_at?: string
          id?: string
          is_leaf?: boolean
          level?: number
          margin?: number
          name?: string
          parent_id?: string | null
          phase_id?: string | null
          project_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "wbs_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "wbs_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_nodes_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cash_box_balance: {
        Row: {
          balance: number | null
          box_id: string | null
          income: number | null
          outcome: number | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_boxes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_expense_paid: {
        Row: {
          expense_id: string | null
          last_paid_at: string | null
          paid_pen: number | null
          payments_count: number | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_balance: {
        Row: {
          invoiced_pen: number | null
          invoices: number | null
          order_id: string | null
          paid_pen: number | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock: {
        Row: {
          cost_in: number | null
          cost_out: number | null
          last_movement: string | null
          material_id: string | null
          project_id: string | null
          qty_in: number | null
          qty_out: number | null
          stock: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_wbs_stats: {
        Row: {
          approved: number | null
          budget: number | null
          code: string | null
          committed: number | null
          cost_type: string | null
          declared: number | null
          docs: number | null
          is_leaf: boolean | null
          level: number | null
          margin: number | null
          name: string | null
          paid: number | null
          parent_id: string | null
          pending_approval: number | null
          phase_id: string | null
          project_id: string | null
          registered: number | null
          sort: number | null
          wbs_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wbs_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_wbs_stats"
            referencedColumns: ["wbs_id"]
          },
          {
            foreignKeyName: "wbs_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wbs_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_nodes_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wbs_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_budget_change: {
        Args: {
          p_amount: number
          p_reason: string
          p_type: string
          p_wbs: string
        }
        Returns: {
          amount: number
          change_type: string
          created_at: string
          created_by: string | null
          id: string
          new_budget: number | null
          previous_budget: number | null
          project_id: string
          reason: string | null
          wbs_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "budget_changes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_project: { Args: { pid: string }; Returns: boolean }
      company_role: {
        Args: { cid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_company_role: {
        Args: { cid: string; roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_project_role: {
        Args: { pid: string; roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      is_company_member: { Args: { cid: string }; Returns: boolean }
      is_holding_admin: { Args: never; Returns: boolean }
      project_role: {
        Args: { pid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      project_week: {
        Args: { p_date: string; p_project: string }
        Returns: number
      }
      project_writable: { Args: { pid: string }; Returns: boolean }
      refresh_project_alerts: { Args: { p_project: string }; Returns: number }
      upsert_alert: {
        Args: {
          p_company: string
          p_entity: string
          p_entity_type: string
          p_message: string
          p_project: string
          p_severity: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "gerente_general"
        | "gerente_proyectos"
        | "residente"
        | "administrador"
        | "contabilidad"
        | "almacen"
      doc_type: "FT" | "BV" | "RH" | "TK" | "PL" | "OT"
      expense_status:
        | "borrador"
        | "declarado"
        | "observado"
        | "aprobado"
        | "pagado_parcial"
        | "pagado"
        | "anulado"
      labor_category: "capataz" | "operario" | "oficial" | "peon"
      project_status:
        | "preparacion"
        | "ejecucion"
        | "paralizada"
        | "cancelada"
        | "cerrada"
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
      app_role: [
        "gerente_general",
        "gerente_proyectos",
        "residente",
        "administrador",
        "contabilidad",
        "almacen",
      ],
      doc_type: ["FT", "BV", "RH", "TK", "PL", "OT"],
      expense_status: [
        "borrador",
        "declarado",
        "observado",
        "aprobado",
        "pagado_parcial",
        "pagado",
        "anulado",
      ],
      labor_category: ["capataz", "operario", "oficial", "peon"],
      project_status: [
        "preparacion",
        "ejecucion",
        "paralizada",
        "cancelada",
        "cerrada",
      ],
    },
  },
} as const

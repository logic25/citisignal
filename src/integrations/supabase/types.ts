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
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          id: string
          month: string
          question_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          question_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          question_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          completion_tokens: number
          created_at: string
          estimated_cost_usd: number
          feature: string
          id: string
          metadata: Json | null
          model: string
          prompt_tokens: number
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          feature: string
          id?: string
          metadata?: Json | null
          model?: string
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          feature?: string
          id?: string
          metadata?: Json | null
          model?: string
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      api_call_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          property_id: string | null
          response_time_ms: number | null
          status_code: number | null
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          property_id?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          property_id?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_call_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          agency: string
          applicant_name: string | null
          application_number: string
          application_type: string
          approval_date: string | null
          created_at: string
          description: string | null
          dwelling_units: number | null
          estimated_cost: number | null
          expiration_date: string | null
          filing_date: string | null
          floor_area: number | null
          id: string
          job_type: string | null
          notes: string | null
          owner_name: string | null
          property_id: string
          raw_data: Json | null
          source: string
          status: string | null
          stories: number | null
          synced_at: string | null
          tenant_name: string | null
          tenant_notes: string | null
          updated_at: string
          work_type: string | null
        }
        Insert: {
          agency?: string
          applicant_name?: string | null
          application_number: string
          application_type: string
          approval_date?: string | null
          created_at?: string
          description?: string | null
          dwelling_units?: number | null
          estimated_cost?: number | null
          expiration_date?: string | null
          filing_date?: string | null
          floor_area?: number | null
          id?: string
          job_type?: string | null
          notes?: string | null
          owner_name?: string | null
          property_id: string
          raw_data?: Json | null
          source?: string
          status?: string | null
          stories?: number | null
          synced_at?: string | null
          tenant_name?: string | null
          tenant_notes?: string | null
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          agency?: string
          applicant_name?: string | null
          application_number?: string
          application_type?: string
          approval_date?: string | null
          created_at?: string
          description?: string | null
          dwelling_units?: number | null
          estimated_cost?: number | null
          expiration_date?: string | null
          filing_date?: string | null
          floor_area?: number | null
          id?: string
          job_type?: string | null
          notes?: string | null
          owner_name?: string | null
          property_id?: string
          raw_data?: Json | null
          source?: string
          status?: string | null
          stories?: number | null
          synced_at?: string | null
          tenant_name?: string | null
          tenant_notes?: string | null
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          page_url: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      building_insurance_policies: {
        Row: {
          aggregate_limit: number | null
          ai_review_notes: string | null
          ai_review_status: string | null
          ai_reviewed_at: string | null
          broker_email: string | null
          broker_name: string | null
          broker_phone: string | null
          carrier_name: string | null
          certificate_url: string | null
          coverage_amount: number | null
          created_at: string
          deductible: number | null
          effective_date: string | null
          endorsements: string | null
          expiration_date: string | null
          id: string
          notes: string | null
          per_occurrence_limit: number | null
          policy_document_url: string | null
          policy_number: string | null
          policy_type: string
          premium_annual: number | null
          property_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregate_limit?: number | null
          ai_review_notes?: string | null
          ai_review_status?: string | null
          ai_reviewed_at?: string | null
          broker_email?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          carrier_name?: string | null
          certificate_url?: string | null
          coverage_amount?: number | null
          created_at?: string
          deductible?: number | null
          effective_date?: string | null
          endorsements?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          per_occurrence_limit?: number | null
          policy_document_url?: string | null
          policy_number?: string | null
          policy_type: string
          premium_annual?: number | null
          property_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aggregate_limit?: number | null
          ai_review_notes?: string | null
          ai_review_status?: string | null
          ai_reviewed_at?: string | null
          broker_email?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          carrier_name?: string | null
          certificate_url?: string | null
          coverage_amount?: number | null
          created_at?: string
          deductible?: number | null
          effective_date?: string | null
          endorsements?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          per_occurrence_limit?: number | null
          policy_document_url?: string | null
          policy_number?: string | null
          policy_type?: string
          premium_annual?: number | null
          property_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_insurance_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          id: string
          property_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          id?: string
          property_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          id?: string
          property_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cam_budgets: {
        Row: {
          budget_year: number
          created_at: string
          id: string
          name: string
          notes: string | null
          property_id: string
          status: string
          total_budget: number
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_year: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          property_id: string
          status?: string
          total_budget?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_year?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          status?: string
          total_budget?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cam_budgets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cam_line_items: {
        Row: {
          actual_amount: number
          budget_id: string
          budgeted_amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          budget_id: string
          budgeted_amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          budget_id?: string
          budgeted_amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cam_line_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "cam_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      cam_tenant_allocations: {
        Row: {
          actual_annual: number
          allocation_method: string
          allocation_percentage: number | null
          budget_id: string
          created_at: string
          estimated_annual: number
          fixed_amount: number | null
          id: string
          monthly_charge: number
          reconciliation_amount: number | null
          tenant_id: string
          tenant_sqft: number | null
          updated_at: string
        }
        Insert: {
          actual_annual?: number
          allocation_method?: string
          allocation_percentage?: number | null
          budget_id: string
          created_at?: string
          estimated_annual?: number
          fixed_amount?: number | null
          id?: string
          monthly_charge?: number
          reconciliation_amount?: number | null
          tenant_id: string
          tenant_sqft?: number | null
          updated_at?: string
        }
        Update: {
          actual_annual?: number
          allocation_method?: string
          allocation_percentage?: number | null
          budget_id?: string
          created_at?: string
          estimated_annual?: number
          fixed_amount?: number | null
          id?: string
          monthly_charge?: number
          reconciliation_amount?: number | null
          tenant_id?: string
          tenant_sqft?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cam_tenant_allocations_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "cam_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_tenant_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          change_type: string
          created_at: string
          description: string | null
          entity_id: string
          entity_label: string | null
          entity_type: string
          id: string
          new_value: string | null
          notified: boolean
          previous_value: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          change_type: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_label?: string | null
          entity_type: string
          id?: string
          new_value?: string | null
          notified?: boolean
          previous_value?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          change_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          id?: string
          new_value?: string | null
          notified?: boolean
          previous_value?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requirements: {
        Row: {
          applicability_reason: string | null
          created_at: string
          cycle_year: number | null
          description: string | null
          due_date: string | null
          filing_deadline: string | null
          id: string
          last_filed_date: string | null
          local_law: string
          next_due_date: string | null
          notes: string | null
          penalty_amount: number | null
          penalty_description: string | null
          property_id: string
          requirement_name: string
          status: string
          updated_at: string
        }
        Insert: {
          applicability_reason?: string | null
          created_at?: string
          cycle_year?: number | null
          description?: string | null
          due_date?: string | null
          filing_deadline?: string | null
          id?: string
          last_filed_date?: string | null
          local_law: string
          next_due_date?: string | null
          notes?: string | null
          penalty_amount?: number | null
          penalty_description?: string | null
          property_id: string
          requirement_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicability_reason?: string | null
          created_at?: string
          cycle_year?: number | null
          description?: string | null
          due_date?: string | null
          filing_deadline?: string | null
          id?: string
          last_filed_date?: string | null
          local_law?: string
          next_due_date?: string | null
          notes?: string | null
          penalty_amount?: number | null
          penalty_description?: string | null
          property_id?: string
          requirement_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_scores: {
        Row: {
          calculated_at: string
          compliance_details: Json | null
          compliance_score: number
          created_at: string
          grade: string
          id: string
          property_id: string
          resolution_details: Json | null
          resolution_score: number
          score: number
          updated_at: string
          user_id: string
          violation_details: Json | null
          violation_score: number
        }
        Insert: {
          calculated_at?: string
          compliance_details?: Json | null
          compliance_score?: number
          created_at?: string
          grade?: string
          id?: string
          property_id: string
          resolution_details?: Json | null
          resolution_score?: number
          score?: number
          updated_at?: string
          user_id: string
          violation_details?: Json | null
          violation_score?: number
        }
        Update: {
          calculated_at?: string
          compliance_details?: Json | null
          compliance_score?: number
          created_at?: string
          grade?: string
          id?: string
          property_id?: string
          resolution_details?: Json | null
          resolution_score?: number
          score?: number
          updated_at?: string
          user_id?: string
          violation_details?: Json | null
          violation_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_reports: {
        Row: {
          address: string
          ai_analysis: string | null
          applications_data: Json | null
          bbl: string | null
          bin: string | null
          building_data: Json | null
          created_at: string
          general_notes: string | null
          id: string
          line_item_notes: Json | null
          orders_data: Json | null
          pdf_url: string | null
          prepared_by: string | null
          prepared_for: string
          report_date: string
          status: string
          updated_at: string
          user_id: string
          violations_data: Json | null
        }
        Insert: {
          address: string
          ai_analysis?: string | null
          applications_data?: Json | null
          bbl?: string | null
          bin?: string | null
          building_data?: Json | null
          created_at?: string
          general_notes?: string | null
          id?: string
          line_item_notes?: Json | null
          orders_data?: Json | null
          pdf_url?: string | null
          prepared_by?: string | null
          prepared_for: string
          report_date?: string
          status?: string
          updated_at?: string
          user_id: string
          violations_data?: Json | null
        }
        Update: {
          address?: string
          ai_analysis?: string | null
          applications_data?: Json | null
          bbl?: string | null
          bin?: string | null
          building_data?: Json | null
          created_at?: string
          general_notes?: string | null
          id?: string
          line_item_notes?: Json | null
          orders_data?: Json | null
          pdf_url?: string | null
          prepared_by?: string | null
          prepared_for?: string
          report_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          violations_data?: Json | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          email_type: string
          id: string
          metadata: Json | null
          recipient_email: string | null
          sent_at: string
          subject: string
          user_id: string
        }
        Insert: {
          email_type: string
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          sent_at?: string
          subject: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          metadata?: Json | null
          recipient_email?: string | null
          sent_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          created_at: string
          digest_day: string
          digest_frequency: string
          email: string | null
          id: string
          notify_expirations: boolean
          notify_new_applications: boolean
          notify_new_violations: boolean
          notify_status_changes: boolean
          notify_tenant_insurance_expiry: boolean
          reminder_days: number[]
          telegram_critical_alerts: boolean | null
          telegram_daily_summary: boolean | null
          telegram_expirations: boolean | null
          telegram_new_applications: boolean | null
          telegram_new_violations: boolean | null
          telegram_status_changes: boolean | null
          tenant_reminder_days: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_day?: string
          digest_frequency?: string
          email?: string | null
          id?: string
          notify_expirations?: boolean
          notify_new_applications?: boolean
          notify_new_violations?: boolean
          notify_status_changes?: boolean
          notify_tenant_insurance_expiry?: boolean
          reminder_days?: number[]
          telegram_critical_alerts?: boolean | null
          telegram_daily_summary?: boolean | null
          telegram_expirations?: boolean | null
          telegram_new_applications?: boolean | null
          telegram_new_violations?: boolean | null
          telegram_status_changes?: boolean | null
          tenant_reminder_days?: number[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_day?: string
          digest_frequency?: string
          email?: string | null
          id?: string
          notify_expirations?: boolean
          notify_new_applications?: boolean
          notify_new_violations?: boolean
          notify_status_changes?: boolean
          notify_tenant_insurance_expiry?: boolean
          reminder_days?: number[]
          telegram_critical_alerts?: boolean | null
          telegram_daily_summary?: boolean | null
          telegram_expirations?: boolean | null
          telegram_new_applications?: boolean | null
          telegram_new_violations?: boolean | null
          telegram_status_changes?: boolean | null
          tenant_reminder_days?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          upvotes: number
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          upvotes?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          payment_method: string | null
          property_id: string
          reference_entity_id: string | null
          reference_entity_type: string | null
          reference_number: string | null
          status: string
          tenant_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          property_id: string
          reference_entity_id?: string | null
          reference_entity_type?: string | null
          reference_number?: string | null
          status?: string
          tenant_id?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          property_id?: string
          reference_entity_id?: string | null
          reference_entity_type?: string | null
          reference_number?: string | null
          status?: string
          tenant_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          notes: string | null
          org_name: string | null
          updated_at: string
          use_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          notes?: string | null
          org_name?: string | null
          updated_at?: string
          use_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          notes?: string | null
          org_name?: string | null
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      lease_conversations: {
        Row: {
          created_at: string
          document_id: string
          id: string
          last_message_at: string | null
          property_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          last_message_at?: string | null
          property_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          last_message_at?: string | null
          property_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_conversations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_messages: {
        Row: {
          citations: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          citations?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          citations?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "lease_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["notification_priority"]
          property_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          property_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          property_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      oath_hearings: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          created_at: string
          disposition: string | null
          disposition_date: string | null
          hearing_date: string | null
          hearing_status: string | null
          id: string
          last_synced_at: string | null
          penalty_amount: number | null
          penalty_paid: boolean | null
          property_id: string | null
          raw_data: Json | null
          summons_number: string
          updated_at: string
          violation_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string
          disposition?: string | null
          disposition_date?: string | null
          hearing_date?: string | null
          hearing_status?: string | null
          id?: string
          last_synced_at?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          property_id?: string | null
          raw_data?: Json | null
          summons_number: string
          updated_at?: string
          violation_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          created_at?: string
          disposition?: string | null
          disposition_date?: string | null
          hearing_date?: string | null
          hearing_status?: string | null
          id?: string
          last_synced_at?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          property_id?: string | null
          raw_data?: Json | null
          summons_number?: string
          updated_at?: string
          violation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oath_hearings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oath_hearings_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_account_links: {
        Row: {
          channel: string
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pending_po_confirmations: {
        Row: {
          channel: string
          chat_id: string | null
          confirmation_code: string
          created_at: string | null
          expires_at: string
          id: string
          po_id: string
          used: boolean | null
          vendor_id: string
        }
        Insert: {
          channel: string
          chat_id?: string | null
          confirmation_code: string
          created_at?: string | null
          expires_at: string
          id?: string
          po_id: string
          used?: boolean | null
          vendor_id: string
        }
        Update: {
          channel?: string
          chat_id?: string | null
          confirmation_code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          po_id?: string
          used?: boolean | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_po_confirmations_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_po_confirmations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          display_name: string | null
          has_completed_onboarding: boolean
          id: string
          license_id: string | null
          org_role: string | null
          organization_id: string | null
          phone: string | null
          po_terms_and_conditions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          has_completed_onboarding?: boolean
          id?: string
          license_id?: string | null
          org_role?: string | null
          organization_id?: string | null
          phone?: string | null
          po_terms_and_conditions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          has_completed_onboarding?: boolean
          id?: string
          license_id?: string | null
          org_role?: string | null
          organization_id?: string | null
          phone?: string | null
          po_terms_and_conditions?: string | null
          updated_at?: string
          user_id?: string
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
      properties: {
        Row: {
          additional_bins: string[] | null
          address: string
          air_rights_sqft: number | null
          applicable_agencies: string[] | null
          assessed_land_value: number | null
          assessed_total_value: number | null
          assigned_phone_number: string | null
          basement_code: string | null
          bbl: string | null
          bin: string | null
          borough: string | null
          building_area_sqft: number | null
          building_class: string | null
          building_remarks: string | null
          burns_no4_oil: boolean | null
          census_tract: string | null
          co_data: Json | null
          co_status: string | null
          commercial_area_sqft: number | null
          commercial_overlay: string | null
          community_board: string | null
          compliance_filings: Json | null
          compliance_status: string | null
          council_district: string | null
          created_at: string
          cross_streets: string | null
          dwelling_units: number | null
          environmental_restrictions: string | null
          exempt_land_value: number | null
          exempt_total_value: number | null
          factory_area_sqft: number | null
          fire_company: string | null
          floor_area_ratio: number | null
          garage_area_sqft: number | null
          grandfathered_sign: boolean | null
          gross_sqft: number | null
          has_backflow_device: boolean | null
          has_boiler: boolean | null
          has_cooling_tower: boolean | null
          has_elevator: boolean | null
          has_fire_alarm: boolean | null
          has_gas: boolean | null
          has_parking_structure: boolean | null
          has_place_of_assembly: boolean | null
          has_retaining_wall: boolean | null
          has_sprinkler: boolean | null
          has_standpipe: boolean | null
          has_water_tank: boolean | null
          height_ft: number | null
          historic_district: string | null
          hpd_multiple_dwelling: boolean | null
          id: string
          is_city_owned: boolean | null
          is_food_establishment: boolean | null
          is_landmark: boolean | null
          jurisdiction: Database["public"]["Enums"]["jurisdiction_type"]
          land_use: string | null
          landmark_status: string | null
          last_checked_at: string | null
          last_synced_at: string | null
          latitude: number | null
          legal_adult_use: boolean | null
          limited_height_district: string | null
          local_law: string | null
          loft_law: boolean | null
          longitude: number | null
          lot_area_sqft: number | null
          lot_depth: number | null
          lot_frontage: number | null
          max_floor_area_ratio: number | null
          monitoring_enabled: boolean | null
          nta_name: string | null
          number_of_buildings: number | null
          number_of_floors: number | null
          occupancy_classification: string | null
          occupancy_group: string | null
          office_area_sqft: number | null
          other_area_sqft: number | null
          overlay_district: string | null
          owner_name: string | null
          owner_phone: string | null
          police_precinct: string | null
          portfolio_id: string | null
          primary_use_group: string | null
          professional_cert_restricted: boolean | null
          residential_area_sqft: number | null
          retail_area_sqft: number | null
          sanitation_borough: string | null
          sanitation_subsection: string | null
          school_district: string | null
          sms_enabled: boolean | null
          special_district: string | null
          special_place_name: string | null
          special_status: string | null
          split_zone: boolean | null
          sro_restricted: boolean | null
          storage_area_sqft: number | null
          stories: number | null
          ta_restricted: boolean | null
          total_units: number | null
          ub_restricted: boolean | null
          unused_far: number | null
          updated_at: string
          use_type: string | null
          user_id: string
          year_altered_1: number | null
          year_altered_2: number | null
          year_built: number | null
          zoning_district: string | null
          zoning_district_2: string | null
          zoning_district_3: string | null
          zoning_map: string | null
        }
        Insert: {
          additional_bins?: string[] | null
          address: string
          air_rights_sqft?: number | null
          applicable_agencies?: string[] | null
          assessed_land_value?: number | null
          assessed_total_value?: number | null
          assigned_phone_number?: string | null
          basement_code?: string | null
          bbl?: string | null
          bin?: string | null
          borough?: string | null
          building_area_sqft?: number | null
          building_class?: string | null
          building_remarks?: string | null
          burns_no4_oil?: boolean | null
          census_tract?: string | null
          co_data?: Json | null
          co_status?: string | null
          commercial_area_sqft?: number | null
          commercial_overlay?: string | null
          community_board?: string | null
          compliance_filings?: Json | null
          compliance_status?: string | null
          council_district?: string | null
          created_at?: string
          cross_streets?: string | null
          dwelling_units?: number | null
          environmental_restrictions?: string | null
          exempt_land_value?: number | null
          exempt_total_value?: number | null
          factory_area_sqft?: number | null
          fire_company?: string | null
          floor_area_ratio?: number | null
          garage_area_sqft?: number | null
          grandfathered_sign?: boolean | null
          gross_sqft?: number | null
          has_backflow_device?: boolean | null
          has_boiler?: boolean | null
          has_cooling_tower?: boolean | null
          has_elevator?: boolean | null
          has_fire_alarm?: boolean | null
          has_gas?: boolean | null
          has_parking_structure?: boolean | null
          has_place_of_assembly?: boolean | null
          has_retaining_wall?: boolean | null
          has_sprinkler?: boolean | null
          has_standpipe?: boolean | null
          has_water_tank?: boolean | null
          height_ft?: number | null
          historic_district?: string | null
          hpd_multiple_dwelling?: boolean | null
          id?: string
          is_city_owned?: boolean | null
          is_food_establishment?: boolean | null
          is_landmark?: boolean | null
          jurisdiction?: Database["public"]["Enums"]["jurisdiction_type"]
          land_use?: string | null
          landmark_status?: string | null
          last_checked_at?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          legal_adult_use?: boolean | null
          limited_height_district?: string | null
          local_law?: string | null
          loft_law?: boolean | null
          longitude?: number | null
          lot_area_sqft?: number | null
          lot_depth?: number | null
          lot_frontage?: number | null
          max_floor_area_ratio?: number | null
          monitoring_enabled?: boolean | null
          nta_name?: string | null
          number_of_buildings?: number | null
          number_of_floors?: number | null
          occupancy_classification?: string | null
          occupancy_group?: string | null
          office_area_sqft?: number | null
          other_area_sqft?: number | null
          overlay_district?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          police_precinct?: string | null
          portfolio_id?: string | null
          primary_use_group?: string | null
          professional_cert_restricted?: boolean | null
          residential_area_sqft?: number | null
          retail_area_sqft?: number | null
          sanitation_borough?: string | null
          sanitation_subsection?: string | null
          school_district?: string | null
          sms_enabled?: boolean | null
          special_district?: string | null
          special_place_name?: string | null
          special_status?: string | null
          split_zone?: boolean | null
          sro_restricted?: boolean | null
          storage_area_sqft?: number | null
          stories?: number | null
          ta_restricted?: boolean | null
          total_units?: number | null
          ub_restricted?: boolean | null
          unused_far?: number | null
          updated_at?: string
          use_type?: string | null
          user_id: string
          year_altered_1?: number | null
          year_altered_2?: number | null
          year_built?: number | null
          zoning_district?: string | null
          zoning_district_2?: string | null
          zoning_district_3?: string | null
          zoning_map?: string | null
        }
        Update: {
          additional_bins?: string[] | null
          address?: string
          air_rights_sqft?: number | null
          applicable_agencies?: string[] | null
          assessed_land_value?: number | null
          assessed_total_value?: number | null
          assigned_phone_number?: string | null
          basement_code?: string | null
          bbl?: string | null
          bin?: string | null
          borough?: string | null
          building_area_sqft?: number | null
          building_class?: string | null
          building_remarks?: string | null
          burns_no4_oil?: boolean | null
          census_tract?: string | null
          co_data?: Json | null
          co_status?: string | null
          commercial_area_sqft?: number | null
          commercial_overlay?: string | null
          community_board?: string | null
          compliance_filings?: Json | null
          compliance_status?: string | null
          council_district?: string | null
          created_at?: string
          cross_streets?: string | null
          dwelling_units?: number | null
          environmental_restrictions?: string | null
          exempt_land_value?: number | null
          exempt_total_value?: number | null
          factory_area_sqft?: number | null
          fire_company?: string | null
          floor_area_ratio?: number | null
          garage_area_sqft?: number | null
          grandfathered_sign?: boolean | null
          gross_sqft?: number | null
          has_backflow_device?: boolean | null
          has_boiler?: boolean | null
          has_cooling_tower?: boolean | null
          has_elevator?: boolean | null
          has_fire_alarm?: boolean | null
          has_gas?: boolean | null
          has_parking_structure?: boolean | null
          has_place_of_assembly?: boolean | null
          has_retaining_wall?: boolean | null
          has_sprinkler?: boolean | null
          has_standpipe?: boolean | null
          has_water_tank?: boolean | null
          height_ft?: number | null
          historic_district?: string | null
          hpd_multiple_dwelling?: boolean | null
          id?: string
          is_city_owned?: boolean | null
          is_food_establishment?: boolean | null
          is_landmark?: boolean | null
          jurisdiction?: Database["public"]["Enums"]["jurisdiction_type"]
          land_use?: string | null
          landmark_status?: string | null
          last_checked_at?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          legal_adult_use?: boolean | null
          limited_height_district?: string | null
          local_law?: string | null
          loft_law?: boolean | null
          longitude?: number | null
          lot_area_sqft?: number | null
          lot_depth?: number | null
          lot_frontage?: number | null
          max_floor_area_ratio?: number | null
          monitoring_enabled?: boolean | null
          nta_name?: string | null
          number_of_buildings?: number | null
          number_of_floors?: number | null
          occupancy_classification?: string | null
          occupancy_group?: string | null
          office_area_sqft?: number | null
          other_area_sqft?: number | null
          overlay_district?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          police_precinct?: string | null
          portfolio_id?: string | null
          primary_use_group?: string | null
          professional_cert_restricted?: boolean | null
          residential_area_sqft?: number | null
          retail_area_sqft?: number | null
          sanitation_borough?: string | null
          sanitation_subsection?: string | null
          school_district?: string | null
          sms_enabled?: boolean | null
          special_district?: string | null
          special_place_name?: string | null
          special_status?: string | null
          split_zone?: boolean | null
          sro_restricted?: boolean | null
          storage_area_sqft?: number | null
          stories?: number | null
          ta_restricted?: boolean | null
          total_units?: number | null
          ub_restricted?: boolean | null
          unused_far?: number | null
          updated_at?: string
          use_type?: string | null
          user_id?: string
          year_altered_1?: number | null
          year_altered_2?: number | null
          year_built?: number | null
          zoning_district?: string | null
          zoning_district_2?: string | null
          zoning_district_3?: string | null
          zoning_map?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      property_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          property_id: string
          title: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          property_id: string
          title: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_activity_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ai_conversations: {
        Row: {
          created_at: string
          id: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "property_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          description: string | null
          document_name: string
          document_type: string
          expiration_date: string | null
          extracted_text: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          is_current: boolean | null
          metadata: Json | null
          property_id: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_name: string
          document_type: string
          expiration_date?: string | null
          extracted_text?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_current?: boolean | null
          metadata?: Json | null
          property_id: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          document_name?: string
          document_type?: string
          expiration_date?: string | null
          extracted_text?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_current?: boolean | null
          metadata?: Json | null
          property_id?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          property_id: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          property_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          property_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_taxes: {
        Row: {
          amount_paid: number | null
          assessed_value: number | null
          attorney_email: string | null
          attorney_fee: number | null
          attorney_firm: string | null
          attorney_name: string | null
          attorney_phone: string | null
          balance_due: number | null
          created_at: string
          due_date: string | null
          exemption_end_date: string | null
          exemption_notes: string | null
          exemption_start_date: string | null
          exemption_type: string | null
          id: string
          notes: string | null
          paid_date: string | null
          payment_status: string
          property_id: string
          protest_filed_date: string | null
          protest_hearing_date: string | null
          protest_outcome_notes: string | null
          protest_status: string | null
          q1_amount: number | null
          q1_due_date: string | null
          q1_paid: number | null
          q1_status: string | null
          q2_amount: number | null
          q2_due_date: string | null
          q2_paid: number | null
          q2_status: string | null
          q3_amount: number | null
          q3_due_date: string | null
          q3_paid: number | null
          q3_status: string | null
          q4_amount: number | null
          q4_due_date: string | null
          q4_paid: number | null
          q4_status: string | null
          tax_amount: number | null
          tax_rate: number | null
          tax_year: number
          tenant_name: string | null
          tenant_responsible: boolean | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          assessed_value?: number | null
          attorney_email?: string | null
          attorney_fee?: number | null
          attorney_firm?: string | null
          attorney_name?: string | null
          attorney_phone?: string | null
          balance_due?: number | null
          created_at?: string
          due_date?: string | null
          exemption_end_date?: string | null
          exemption_notes?: string | null
          exemption_start_date?: string | null
          exemption_type?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string
          property_id: string
          protest_filed_date?: string | null
          protest_hearing_date?: string | null
          protest_outcome_notes?: string | null
          protest_status?: string | null
          q1_amount?: number | null
          q1_due_date?: string | null
          q1_paid?: number | null
          q1_status?: string | null
          q2_amount?: number | null
          q2_due_date?: string | null
          q2_paid?: number | null
          q2_status?: string | null
          q3_amount?: number | null
          q3_due_date?: string | null
          q3_paid?: number | null
          q3_status?: string | null
          q4_amount?: number | null
          q4_due_date?: string | null
          q4_paid?: number | null
          q4_status?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          tax_year: number
          tenant_name?: string | null
          tenant_responsible?: boolean | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          assessed_value?: number | null
          attorney_email?: string | null
          attorney_fee?: number | null
          attorney_firm?: string | null
          attorney_name?: string | null
          attorney_phone?: string | null
          balance_due?: number | null
          created_at?: string
          due_date?: string | null
          exemption_end_date?: string | null
          exemption_notes?: string | null
          exemption_start_date?: string | null
          exemption_type?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string
          property_id?: string
          protest_filed_date?: string | null
          protest_hearing_date?: string | null
          protest_outcome_notes?: string | null
          protest_status?: string | null
          q1_amount?: number | null
          q1_due_date?: string | null
          q1_paid?: number | null
          q1_status?: string | null
          q2_amount?: number | null
          q2_due_date?: string | null
          q2_paid?: number | null
          q2_status?: string | null
          q3_amount?: number | null
          q3_due_date?: string | null
          q3_paid?: number | null
          q3_status?: string | null
          q4_amount?: number | null
          q4_due_date?: string | null
          q4_paid?: number | null
          q4_status?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          tax_year?: number
          tenant_name?: string | null
          tenant_responsible?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_taxes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number
          created_at: string
          id: string
          owner_signed_at: string | null
          pdf_url: string | null
          po_number: string
          property_id: string
          scope: string
          status: string
          terms_and_conditions: string | null
          updated_at: string
          user_id: string
          vendor_id: string
          vendor_sign_token: string
          vendor_signed_at: string | null
          work_order_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          owner_signed_at?: string | null
          pdf_url?: string | null
          po_number: string
          property_id: string
          scope: string
          status?: string
          terms_and_conditions?: string | null
          updated_at?: string
          user_id: string
          vendor_id: string
          vendor_sign_token?: string
          vendor_signed_at?: string | null
          work_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          owner_signed_at?: string | null
          pdf_url?: string | null
          po_number?: string
          property_id?: string
          scope?: string
          status?: string
          terms_and_conditions?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string
          vendor_sign_token?: string
          vendor_signed_at?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          name: string
          parameters: Json | null
          pdf_url: string | null
          report_type: string
          result_data: Json | null
          row_count: number | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          name: string
          parameters?: Json | null
          pdf_url?: string | null
          report_type?: string
          result_data?: Json | null
          row_count?: number | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          name?: string
          parameters?: Json | null
          pdf_url?: string | null
          report_type?: string
          result_data?: Json | null
          row_count?: number | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          columns: Json | null
          created_at: string
          data_sources: Json
          description: string | null
          filters: Json | null
          group_by: string | null
          id: string
          include_charts: boolean | null
          is_template: boolean | null
          name: string
          report_type: string
          schedule_frequency: string | null
          schedule_recipients: Json | null
          sort_config: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          columns?: Json | null
          created_at?: string
          data_sources?: Json
          description?: string | null
          filters?: Json | null
          group_by?: string | null
          id?: string
          include_charts?: boolean | null
          is_template?: boolean | null
          name: string
          report_type?: string
          schedule_frequency?: string | null
          schedule_recipients?: Json | null
          sort_config?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          columns?: Json | null
          created_at?: string
          data_sources?: Json
          description?: string | null
          filters?: Json | null
          group_by?: string | null
          id?: string
          include_charts?: boolean | null
          is_template?: boolean | null
          name?: string
          report_type?: string
          schedule_frequency?: string | null
          schedule_recipients?: Json | null
          sort_config?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          phase: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          phase?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          phase?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_health_logs: {
        Row: {
          created_at: string | null
          endpoint_name: string
          error_message: string | null
          id: string
          property_id: string | null
          response_time_ms: number | null
          result_count: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          endpoint_name: string
          error_message?: string | null
          id?: string
          property_id?: string | null
          response_time_ms?: number | null
          result_count?: number | null
          status: string
        }
        Update: {
          created_at?: string | null
          endpoint_name?: string
          error_message?: string | null
          id?: string
          property_id?: string | null
          response_time_ms?: number | null
          result_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_health_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_exemptions: {
        Row: {
          annual_savings: number | null
          application_number: string | null
          created_at: string
          exemption_type: string
          expiration_date: string | null
          id: string
          notes: string | null
          program_name: string | null
          property_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          annual_savings?: number | null
          application_number?: string | null
          created_at?: string
          exemption_type: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          program_name?: string | null
          property_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          annual_savings?: number | null
          application_number?: string | null
          created_at?: string
          exemption_type?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          program_name?: string | null
          property_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_exemptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_installments: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          payment_status: string
          property_tax_id: string
          quarter: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string
          property_tax_id: string
          quarter: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string
          property_tax_id?: string
          quarter?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_installments_property_tax_id_fkey"
            columns: ["property_tax_id"]
            isOneToOne: false
            referencedRelation: "property_taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          direction: string
          id: string
          message_text: string | null
          telegram_message_id: number | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          telegram_message_id?: number | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          telegram_message_id?: number | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          chat_id: number
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          linked_at: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      tenant_insurance_policies: {
        Row: {
          additional_insured: boolean
          additional_insured_entity_name: string | null
          additional_insured_required: boolean
          aggregate_limit: number | null
          ai_review_notes: string | null
          ai_review_status: string | null
          ai_reviewed_at: string | null
          carrier_name: string | null
          certificate_url: string | null
          coverage_amount: number | null
          created_at: string
          deductible: number | null
          effective_date: string | null
          endorsements: string | null
          expiration_date: string | null
          id: string
          notes: string | null
          per_occurrence_limit: number | null
          policy_document_url: string | null
          policy_number: string | null
          policy_type: string
          property_id: string
          renewal_reminder_sent_at: string | null
          renewal_requested_at: string | null
          renewal_status: string | null
          required_minimum: number | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          additional_insured?: boolean
          additional_insured_entity_name?: string | null
          additional_insured_required?: boolean
          aggregate_limit?: number | null
          ai_review_notes?: string | null
          ai_review_status?: string | null
          ai_reviewed_at?: string | null
          carrier_name?: string | null
          certificate_url?: string | null
          coverage_amount?: number | null
          created_at?: string
          deductible?: number | null
          effective_date?: string | null
          endorsements?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          per_occurrence_limit?: number | null
          policy_document_url?: string | null
          policy_number?: string | null
          policy_type: string
          property_id: string
          renewal_reminder_sent_at?: string | null
          renewal_requested_at?: string | null
          renewal_status?: string | null
          required_minimum?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          additional_insured?: boolean
          additional_insured_entity_name?: string | null
          additional_insured_required?: boolean
          aggregate_limit?: number | null
          ai_review_notes?: string | null
          ai_review_status?: string | null
          ai_reviewed_at?: string | null
          carrier_name?: string | null
          certificate_url?: string | null
          coverage_amount?: number | null
          created_at?: string
          deductible?: number | null
          effective_date?: string | null
          endorsements?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          per_occurrence_limit?: number | null
          policy_document_url?: string | null
          policy_number?: string | null
          policy_type?: string
          property_id?: string
          renewal_reminder_sent_at?: string | null
          renewal_requested_at?: string | null
          renewal_status?: string | null
          required_minimum?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_insurance_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_insurance_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          annual_escalation_pct: number | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          escalation_notes: string | null
          guarantor_name: string | null
          guarantor_phone: string | null
          id: string
          lease_end: string | null
          lease_start: string | null
          lease_type: string | null
          move_in_date: string | null
          notes: string | null
          option_terms: string | null
          parking_spaces: number | null
          percentage_rent: number | null
          percentage_rent_breakpoint: number | null
          property_id: string
          renewal_option_date: string | null
          rent_amount: number | null
          security_deposit: number | null
          status: string
          tenant_sqft: number | null
          ti_allowance: number | null
          unit_number: string | null
          updated_at: string
          use_clause: string | null
        }
        Insert: {
          annual_escalation_pct?: number | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          escalation_notes?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          lease_type?: string | null
          move_in_date?: string | null
          notes?: string | null
          option_terms?: string | null
          parking_spaces?: number | null
          percentage_rent?: number | null
          percentage_rent_breakpoint?: number | null
          property_id: string
          renewal_option_date?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          status?: string
          tenant_sqft?: number | null
          ti_allowance?: number | null
          unit_number?: string | null
          updated_at?: string
          use_clause?: string | null
        }
        Update: {
          annual_escalation_pct?: number | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          escalation_notes?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          lease_type?: string | null
          move_in_date?: string | null
          notes?: string | null
          option_terms?: string | null
          parking_spaces?: number | null
          percentage_rent?: number | null
          percentage_rent_breakpoint?: number | null
          property_id?: string
          renewal_option_date?: string | null
          rent_amount?: number | null
          security_deposit?: number | null
          status?: string
          tenant_sqft?: number | null
          ti_allowance?: number | null
          unit_number?: string | null
          updated_at?: string
          use_clause?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          mobile: string | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          communication_rating: number | null
          created_at: string
          id: string
          property_id: string | null
          quality_rating: number | null
          rating: number
          review_text: string | null
          timeliness_rating: number | null
          title: string | null
          updated_at: string
          user_id: string
          value_rating: number | null
          vendor_id: string
          work_order_id: string | null
        }
        Insert: {
          communication_rating?: number | null
          created_at?: string
          id?: string
          property_id?: string | null
          quality_rating?: number | null
          rating: number
          review_text?: string | null
          timeliness_rating?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
          value_rating?: number | null
          vendor_id: string
          work_order_id?: string | null
        }
        Update: {
          communication_rating?: number | null
          created_at?: string
          id?: string
          property_id?: string | null
          quality_rating?: number | null
          rating?: number
          review_text?: string | null
          timeliness_rating?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
          value_rating?: number | null
          vendor_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          avg_rating: number | null
          coi_expiration_date: string | null
          created_at: string
          email: string | null
          id: string
          license_number: string | null
          mobile_number: string | null
          name: string
          notes: string | null
          payment_preference: string | null
          phone_number: string | null
          status: string | null
          telegram_chat_id: number | null
          total_reviews: number | null
          total_spent: number | null
          trade_type: string | null
          updated_at: string
          user_id: string
          website: string | null
          zelle_email: string | null
          zelle_phone: string | null
        }
        Insert: {
          address?: string | null
          avg_rating?: number | null
          coi_expiration_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_number?: string | null
          mobile_number?: string | null
          name: string
          notes?: string | null
          payment_preference?: string | null
          phone_number?: string | null
          status?: string | null
          telegram_chat_id?: number | null
          total_reviews?: number | null
          total_spent?: number | null
          trade_type?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          zelle_email?: string | null
          zelle_phone?: string | null
        }
        Update: {
          address?: string | null
          avg_rating?: number | null
          coi_expiration_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_number?: string | null
          mobile_number?: string | null
          name?: string
          notes?: string | null
          payment_preference?: string | null
          phone_number?: string | null
          status?: string | null
          telegram_chat_id?: number | null
          total_reviews?: number | null
          total_spent?: number | null
          trade_type?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          zelle_email?: string | null
          zelle_phone?: string | null
        }
        Relationships: []
      }
      violations: {
        Row: {
          agency: Database["public"]["Enums"]["agency_type"]
          amount_paid: number | null
          balance_due: number | null
          certification_due_date: string | null
          complaint_category: string | null
          complaint_number: string | null
          created_at: string
          cure_due_date: string | null
          daily_penalty_amount: number | null
          description_raw: string | null
          disposition_code: string | null
          disposition_comments: string | null
          hearing_date: string | null
          id: string
          is_stop_work_order: boolean | null
          is_vacate_order: boolean | null
          issued_date: string
          notes: string | null
          oath_status: string | null
          penalty_amount: number | null
          penalty_paid: boolean | null
          penalty_text: string | null
          priority: string | null
          property_id: string
          respondent_address: string | null
          respondent_name: string | null
          severity: string | null
          source: string | null
          status: Database["public"]["Enums"]["violation_status"]
          suppressed: boolean | null
          suppression_reason: string | null
          synced_at: string | null
          tenant_assigned_at: string | null
          tenant_id: string | null
          updated_at: string
          violation_category: string | null
          violation_class: string | null
          violation_number: string
          violation_type: string | null
        }
        Insert: {
          agency: Database["public"]["Enums"]["agency_type"]
          amount_paid?: number | null
          balance_due?: number | null
          certification_due_date?: string | null
          complaint_category?: string | null
          complaint_number?: string | null
          created_at?: string
          cure_due_date?: string | null
          daily_penalty_amount?: number | null
          description_raw?: string | null
          disposition_code?: string | null
          disposition_comments?: string | null
          hearing_date?: string | null
          id?: string
          is_stop_work_order?: boolean | null
          is_vacate_order?: boolean | null
          issued_date: string
          notes?: string | null
          oath_status?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          penalty_text?: string | null
          priority?: string | null
          property_id: string
          respondent_address?: string | null
          respondent_name?: string | null
          severity?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          suppressed?: boolean | null
          suppression_reason?: string | null
          synced_at?: string | null
          tenant_assigned_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          violation_category?: string | null
          violation_class?: string | null
          violation_number: string
          violation_type?: string | null
        }
        Update: {
          agency?: Database["public"]["Enums"]["agency_type"]
          amount_paid?: number | null
          balance_due?: number | null
          certification_due_date?: string | null
          complaint_category?: string | null
          complaint_number?: string | null
          created_at?: string
          cure_due_date?: string | null
          daily_penalty_amount?: number | null
          description_raw?: string | null
          disposition_code?: string | null
          disposition_comments?: string | null
          hearing_date?: string | null
          id?: string
          is_stop_work_order?: boolean | null
          is_vacate_order?: boolean | null
          issued_date?: string
          notes?: string | null
          oath_status?: string | null
          penalty_amount?: number | null
          penalty_paid?: boolean | null
          penalty_text?: string | null
          priority?: string | null
          property_id?: string
          respondent_address?: string | null
          respondent_name?: string | null
          severity?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          suppressed?: boolean | null
          suppression_reason?: string | null
          synced_at?: string | null
          tenant_assigned_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          violation_category?: string | null
          violation_class?: string | null
          violation_number?: string
          violation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "violations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          linked_at: string
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          linked_at?: string
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_order_messages: {
        Row: {
          channel: string
          created_at: string
          extracted_amount: number | null
          id: string
          message: string
          sender_name: string | null
          sender_type: string
          work_order_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          extracted_amount?: number | null
          id?: string
          message: string
          sender_name?: string | null
          sender_type?: string
          work_order_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          extracted_amount?: number | null
          id?: string
          message?: string
          sender_name?: string | null
          sender_type?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_messages_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          completion_notes: string | null
          completion_photos: Json | null
          created_at: string
          dispatched_at: string | null
          due_date: string | null
          id: string
          linked_violation_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          po_id: string | null
          priority: string
          property_id: string
          quoted_amount: number | null
          scope: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          vendor_id: string | null
          vendor_notified_via: string | null
          verified_at: string | null
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_photos?: Json | null
          created_at?: string
          dispatched_at?: string | null
          due_date?: string | null
          id?: string
          linked_violation_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          po_id?: string | null
          priority?: string
          property_id: string
          quoted_amount?: number | null
          scope: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          vendor_id?: string | null
          vendor_notified_via?: string | null
          verified_at?: string | null
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_photos?: Json | null
          created_at?: string
          dispatched_at?: string | null
          due_date?: string | null
          id?: string
          linked_violation_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          po_id?: string | null
          priority?: string
          property_id?: string
          quoted_amount?: number | null
          scope?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          vendor_id?: string | null
          vendor_notified_via?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_linked_violation_id_fkey"
            columns: ["linked_violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_compliance_score: {
        Args: { p_property_id: string }
        Returns: Json
      }
      generate_deadline_reminders: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _user_id: string }; Returns: boolean }
      is_property_member: { Args: { _property_id: string }; Returns: boolean }
      nextval_po_number: { Args: never; Returns: number }
    }
    Enums: {
      agency_type:
        | "DOB"
        | "ECB"
        | "FDNY"
        | "HPD"
        | "DEP"
        | "DOT"
        | "DSNY"
        | "LPC"
        | "DOF"
        | "DOHMH"
      app_role: "admin" | "user"
      jurisdiction_type: "NYC" | "NON_NYC"
      notification_priority: "critical" | "high" | "normal" | "low"
      violation_status: "open" | "in_progress" | "closed"
      work_order_status:
        | "open"
        | "dispatched"
        | "quoted"
        | "approved"
        | "in_progress"
        | "awaiting_docs"
        | "completed"
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
      agency_type: [
        "DOB",
        "ECB",
        "FDNY",
        "HPD",
        "DEP",
        "DOT",
        "DSNY",
        "LPC",
        "DOF",
        "DOHMH",
      ],
      app_role: ["admin", "user"],
      jurisdiction_type: ["NYC", "NON_NYC"],
      notification_priority: ["critical", "high", "normal", "low"],
      violation_status: ["open", "in_progress", "closed"],
      work_order_status: [
        "open",
        "dispatched",
        "quoted",
        "approved",
        "in_progress",
        "awaiting_docs",
        "completed",
      ],
    },
  },
} as const

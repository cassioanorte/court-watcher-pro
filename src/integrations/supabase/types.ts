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
      ai_agents: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_system: boolean
          name: string
          prompt: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          prompt: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          prompt?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tenant_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tenant_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
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
      appointments: {
        Row: {
          case_id: string | null
          client_user_id: string | null
          color: string | null
          created_at: string
          description: string | null
          end_at: string
          id: string
          lead_id: string | null
          start_at: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          client_user_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          lead_id?: string | null
          start_at: string
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          client_user_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          lead_id?: string | null
          start_at?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_collections: {
        Row: {
          amount: number
          case_id: string | null
          client_user_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          case_id?: string | null
          client_user_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          client_user_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_collections_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_collections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_activities: {
        Row: {
          action_type: string
          case_id: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          case_id: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          case_id?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_activities_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_contacts: {
        Row: {
          case_id: string
          contact_user_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          case_id: string
          contact_user_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          case_id?: string
          contact_user_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_contacts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_fulfillments: {
        Row: {
          assigned_by: string
          assigned_to: string
          assigned_to_ids: string[] | null
          case_id: string
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          notes: string | null
          priority: string
          source_id: string | null
          source_type: string | null
          started_at: string | null
          started_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          assigned_to_ids?: string[] | null
          case_id: string
          category: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          notes?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          assigned_to_ids?: string[] | null
          case_id?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_fulfillments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_fulfillments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          case_id: string
          completed: boolean
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
          text: string
        }
        Insert: {
          case_id: string
          completed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
          text: string
        }
        Update: {
          case_id?: string
          completed?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          archived: boolean
          automation_enabled: boolean | null
          case_summary: string | null
          client_user_id: string | null
          created_at: string
          id: string
          last_checked_at: string | null
          next_step: string | null
          next_step_responsible_id: string | null
          parties: string | null
          process_number: string
          responsible_user_id: string | null
          responsible_user_ids: string[] | null
          simple_status: string | null
          source: Database["public"]["Enums"]["process_source"]
          subject: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          automation_enabled?: boolean | null
          case_summary?: string | null
          client_user_id?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          next_step?: string | null
          next_step_responsible_id?: string | null
          parties?: string | null
          process_number: string
          responsible_user_id?: string | null
          responsible_user_ids?: string[] | null
          simple_status?: string | null
          source: Database["public"]["Enums"]["process_source"]
          subject?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          automation_enabled?: boolean | null
          case_summary?: string | null
          client_user_id?: string | null
          created_at?: string
          id?: string
          last_checked_at?: string | null
          next_step?: string | null
          next_step_responsible_id?: string | null
          parties?: string | null
          process_number?: string
          responsible_user_id?: string | null
          responsible_user_ids?: string[] | null
          simple_status?: string | null
          source?: Database["public"]["Enums"]["process_source"]
          subject?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          body: string | null
          client_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          sent_by: string | null
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          client_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sent_by?: string | null
          tenant_id: string
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          client_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sent_by?: string | null
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_documents: {
        Row: {
          category: string
          contact_user_id: string
          created_at: string
          file_url: string | null
          id: string
          link_url: string | null
          name: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          contact_user_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          link_url?: string | null
          name: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          contact_user_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          link_url?: string | null
          name?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          lead_id: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          lead_id: string
          tenant_id: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lead_id?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          company: string | null
          converted_client_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number | null
          id: string
          name: string
          notes: string | null
          origin: string | null
          phone: string | null
          stage: Database["public"]["Enums"]["crm_stage"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          company?: string | null
          converted_client_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          name: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          company?: string | null
          converted_client_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          name?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          lead_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          lead_id: string
          tenant_id: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          lead_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dje_publications: {
        Row: {
          ai_analyzed_at: string | null
          ai_deadlines: string | null
          ai_next_steps: string | null
          ai_summary: string | null
          case_id: string | null
          content: string | null
          created_at: string
          edition: string | null
          external_url: string | null
          id: string
          oab_number: string
          organ: string | null
          process_number: string | null
          publication_date: string
          publication_type: string | null
          read: boolean
          source: string
          tenant_id: string
          title: string
          unique_hash: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_deadlines?: string | null
          ai_next_steps?: string | null
          ai_summary?: string | null
          case_id?: string | null
          content?: string | null
          created_at?: string
          edition?: string | null
          external_url?: string | null
          id?: string
          oab_number: string
          organ?: string | null
          process_number?: string | null
          publication_date: string
          publication_type?: string | null
          read?: boolean
          source: string
          tenant_id: string
          title: string
          unique_hash: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_deadlines?: string | null
          ai_next_steps?: string | null
          ai_summary?: string | null
          case_id?: string | null
          content?: string | null
          created_at?: string
          edition?: string | null
          external_url?: string | null
          id?: string
          oab_number?: string
          organ?: string | null
          process_number?: string | null
          publication_date?: string
          publication_type?: string | null
          read?: boolean
          source?: string
          tenant_id?: string
          title?: string
          unique_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "dje_publications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dje_publications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string
          category: string | null
          created_at: string
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          category?: string | null
          created_at?: string
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          category?: string | null
          created_at?: string
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      email_credentials: {
        Row: {
          created_at: string
          id: string
          imap_host: string
          imap_password: string
          imap_port: number
          imap_user: string
          is_active: boolean
          last_polled_at: string | null
          senders: string[]
          tenant_id: string
          updated_at: string
          use_tls: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          imap_host: string
          imap_password: string
          imap_port?: number
          imap_user: string
          is_active?: boolean
          last_polled_at?: string | null
          senders?: string[]
          tenant_id: string
          updated_at?: string
          use_tls?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          imap_host?: string
          imap_password?: string
          imap_port?: number
          imap_user?: string
          is_active?: boolean
          last_polled_at?: string | null
          senders?: string[]
          tenant_id?: string
          updated_at?: string
          use_tls?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eproc_credentials: {
        Row: {
          created_at: string
          encrypted_credentials: string | null
          id: string
          mode: string
          source: Database["public"]["Enums"]["process_source"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          encrypted_credentials?: string | null
          id?: string
          mode?: string
          source: Database["public"]["Enums"]["process_source"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          encrypted_credentials?: string | null
          id?: string
          mode?: string
          source?: Database["public"]["Enums"]["process_source"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eproc_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eproc_documents: {
        Row: {
          case_id: string | null
          created_at: string
          document_name: string
          document_type: string | null
          document_url: string
          downloaded_at: string | null
          file_size: string | null
          id: string
          process_number: string
          processed_at: string | null
          processing_result: Json | null
          status: string
          sync_log_id: string | null
          tenant_id: string
          unique_hash: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          document_name: string
          document_type?: string | null
          document_url: string
          downloaded_at?: string | null
          file_size?: string | null
          id?: string
          process_number: string
          processed_at?: string | null
          processing_result?: Json | null
          status?: string
          sync_log_id?: string | null
          tenant_id: string
          unique_hash: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          document_name?: string
          document_type?: string | null
          document_url?: string
          downloaded_at?: string | null
          file_size?: string | null
          id?: string
          process_number?: string
          processed_at?: string | null
          processing_result?: Json | null
          status?: string
          sync_log_id?: string | null
          tenant_id?: string
          unique_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "eproc_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eproc_documents_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "eproc_sync_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eproc_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eproc_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          movements_synced: number | null
          processes_found: number | null
          processes_synced: number | null
          source: string
          started_at: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          movements_synced?: number | null
          processes_found?: number | null
          processes_synced?: number | null
          source: string
          started_at?: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          movements_synced?: number | null
          processes_found?: number | null
          processes_synced?: number | null
          source?: string
          started_at?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eproc_sync_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_distributions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          lawyer_name: string
          lawyer_user_id: string
          paid_at: string | null
          payment_order_id: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          lawyer_name: string
          lawyer_user_id: string
          paid_at?: string | null
          payment_order_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          lawyer_name?: string
          lawyer_user_id?: string
          paid_at?: string | null
          payment_order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_distributions_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_distributions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          case_id: string | null
          category: string
          client_user_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          recurrence: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          case_id?: string | null
          category: string
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          recurrence?: string | null
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          category?: string
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          recurrence?: string | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
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
      fulfillment_documents: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          fulfillment_id: string
          id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          fulfillment_id: string
          id?: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          fulfillment_id?: string
          id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_documents_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "case_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          content: Json
          created_at: string
          created_by: string
          id: string
          published_at: string | null
          slug: string
          status: string
          template: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by: string
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          template?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          template?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          case_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean | null
          sender_id: string
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          sender_id: string
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          case_id: string
          created_at: string
          details: string | null
          id: string
          is_manual: boolean | null
          occurred_at: string
          source_label: string | null
          source_raw: string | null
          title: string
          translation: string | null
          unique_hash: string
        }
        Insert: {
          case_id: string
          created_at?: string
          details?: string | null
          id?: string
          is_manual?: boolean | null
          occurred_at: string
          source_label?: string | null
          source_raw?: string | null
          title: string
          translation?: string | null
          unique_hash: string
        }
        Update: {
          case_id?: string
          created_at?: string
          details?: string | null
          id?: string
          is_manual?: boolean | null
          occurred_at?: string
          source_label?: string | null
          source_raw?: string | null
          title?: string
          translation?: string | null
          unique_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          case_id: string | null
          created_at: string
          id: string
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          ai_extracted: boolean | null
          ai_raw_data: Json | null
          beneficiary_cpf: string | null
          beneficiary_name: string | null
          case_id: string | null
          client_amount: number | null
          court: string | null
          court_costs: number | null
          created_at: string
          created_by: string
          document_name: string | null
          document_url: string | null
          entity: string | null
          expected_payment_date: string | null
          fee_type: string
          gross_amount: number | null
          id: string
          income_tax: number | null
          notes: string | null
          office_amount: number | null
          office_fees_percent: number | null
          ownership_type: string
          plaintiff_name: string | null
          process_number: string | null
          reference_date: string | null
          social_security: number | null
          status: string
          tax_percent: number | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          ai_extracted?: boolean | null
          ai_raw_data?: Json | null
          beneficiary_cpf?: string | null
          beneficiary_name?: string | null
          case_id?: string | null
          client_amount?: number | null
          court?: string | null
          court_costs?: number | null
          created_at?: string
          created_by: string
          document_name?: string | null
          document_url?: string | null
          entity?: string | null
          expected_payment_date?: string | null
          fee_type?: string
          gross_amount?: number | null
          id?: string
          income_tax?: number | null
          notes?: string | null
          office_amount?: number | null
          office_fees_percent?: number | null
          ownership_type?: string
          plaintiff_name?: string | null
          process_number?: string | null
          reference_date?: string | null
          social_security?: number | null
          status?: string
          tax_percent?: number | null
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          ai_extracted?: boolean | null
          ai_raw_data?: Json | null
          beneficiary_cpf?: string | null
          beneficiary_name?: string | null
          case_id?: string | null
          client_amount?: number | null
          court?: string | null
          court_costs?: number | null
          created_at?: string
          created_by?: string
          document_name?: string | null
          document_url?: string | null
          entity?: string | null
          expected_payment_date?: string | null
          fee_type?: string
          gross_amount?: number | null
          id?: string
          income_tax?: number | null
          notes?: string | null
          office_amount?: number | null
          office_fees_percent?: number | null
          ownership_type?: string
          plaintiff_name?: string | null
          process_number?: string | null
          reference_date?: string | null
          social_security?: number | null
          status?: string
          tax_percent?: number | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          agencia: string | null
          atividade_economica: string | null
          avatar_url: string | null
          banco: string | null
          birth_date: string | null
          certidao_reservista: string | null
          chave_pix: string | null
          civil_status: string | null
          cnh: string | null
          comentarios: string | null
          conta_bancaria: string | null
          contact_type: string | null
          cpf: string | null
          created_at: string
          ctps: string | null
          email: string | null
          falecido: boolean | null
          full_name: string
          id: string
          nacionalidade: string | null
          naturalidade: string | null
          nome_mae: string | null
          nome_pai: string | null
          oab_number: string | null
          origin: string | null
          passaporte: string | null
          phone: string | null
          pis: string | null
          position: string | null
          rg: string | null
          tags: string[] | null
          tenant_id: string
          titulo_eleitor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          agencia?: string | null
          atividade_economica?: string | null
          avatar_url?: string | null
          banco?: string | null
          birth_date?: string | null
          certidao_reservista?: string | null
          chave_pix?: string | null
          civil_status?: string | null
          cnh?: string | null
          comentarios?: string | null
          conta_bancaria?: string | null
          contact_type?: string | null
          cpf?: string | null
          created_at?: string
          ctps?: string | null
          email?: string | null
          falecido?: boolean | null
          full_name: string
          id?: string
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          oab_number?: string | null
          origin?: string | null
          passaporte?: string | null
          phone?: string | null
          pis?: string | null
          position?: string | null
          rg?: string | null
          tags?: string[] | null
          tenant_id: string
          titulo_eleitor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          agencia?: string | null
          atividade_economica?: string | null
          avatar_url?: string | null
          banco?: string | null
          birth_date?: string | null
          certidao_reservista?: string | null
          chave_pix?: string | null
          civil_status?: string | null
          cnh?: string | null
          comentarios?: string | null
          conta_bancaria?: string | null
          contact_type?: string | null
          cpf?: string | null
          created_at?: string
          ctps?: string | null
          email?: string | null
          falecido?: boolean | null
          full_name?: string
          id?: string
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          oab_number?: string | null
          origin?: string | null
          passaporte?: string | null
          phone?: string | null
          pis?: string | null
          position?: string | null
          rg?: string | null
          tags?: string[] | null
          tenant_id?: string
          titulo_eleitor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assigned_to: string
          case_id: string | null
          category: string
          client_user_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          tagged_user_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          assigned_to: string
          case_id?: string | null
          category?: string
          client_user_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          tagged_user_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          assigned_to?: string
          case_id?: string | null
          category?: string
          client_user_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          tagged_user_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          case_id: string | null
          channel: string
          client_user_id: string
          created_at: string
          created_by: string
          day_of_month: number
          email_override: string | null
          id: string
          is_active: boolean
          message: string
          next_send_date: string
          repeat_count: number
          sent_count: number
          start_date: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          channel?: string
          client_user_id: string
          created_at?: string
          created_by: string
          day_of_month?: number
          email_override?: string | null
          id?: string
          is_active?: boolean
          message: string
          next_send_date: string
          repeat_count?: number
          sent_count?: number
          start_date: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          channel?: string
          client_user_id?: string
          created_at?: string
          created_by?: string
          day_of_month?: number
          email_override?: string | null
          id?: string
          is_active?: boolean
          message?: string
          next_send_date?: string
          repeat_count?: number
          sent_count?: number
          start_date?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_case_access: {
        Row: {
          access_mode: Database["public"]["Enums"]["case_access_mode"]
          allowed_client_ids: string[] | null
          allowed_oab_numbers: string[] | null
          blocked_case_ids: string[] | null
          created_at: string
          extra_case_ids: string[] | null
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_mode?: Database["public"]["Enums"]["case_access_mode"]
          allowed_client_ids?: string[] | null
          allowed_oab_numbers?: string[] | null
          blocked_case_ids?: string[] | null
          created_at?: string
          extra_case_ids?: string[] | null
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_mode?: Database["public"]["Enums"]["case_access_mode"]
          allowed_client_ids?: string[] | null
          allowed_oab_numbers?: string[] | null
          blocked_case_ids?: string[] | null
          created_at?: string
          extra_case_ids?: string[] | null
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_case_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      substabelecimentos: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          document_url: string | null
          from_user_id: string
          id: string
          notes: string | null
          tenant_id: string
          to_user_id: string
          type: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          document_url?: string | null
          from_user_id: string
          id?: string
          notes?: string | null
          tenant_id: string
          to_user_id: string
          type: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          document_url?: string | null
          from_user_id?: string
          id?: string
          notes?: string | null
          tenant_id?: string
          to_user_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "substabelecimentos_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substabelecimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          case_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          parties: string | null
          process_number: string | null
          task_description: string
          tenant_id: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          case_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          parties?: string | null
          process_number?: string | null
          task_description: string
          tenant_id: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          case_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          parties?: string | null
          process_number?: string | null
          task_description?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_credits_limit: number
          ai_credits_reset_at: string | null
          ai_credits_used: number
          blocked_at: string | null
          created_at: string
          id: string
          logo_url: string | null
          monthly_fee: number | null
          name: string
          payment_due_date: string | null
          payment_status: string | null
          primary_color: string | null
          slug: string
          subscription_status: string | null
          theme_colors: Json | null
          trial_duration_days: number | null
          trial_ends_at: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          ai_credits_limit?: number
          ai_credits_reset_at?: string | null
          ai_credits_used?: number
          blocked_at?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          monthly_fee?: number | null
          name: string
          payment_due_date?: string | null
          payment_status?: string | null
          primary_color?: string | null
          slug: string
          subscription_status?: string | null
          theme_colors?: Json | null
          trial_duration_days?: number | null
          trial_ends_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          ai_credits_limit?: number
          ai_credits_reset_at?: string | null
          ai_credits_used?: number
          blocked_at?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          monthly_fee?: number | null
          name?: string
          payment_due_date?: string | null
          payment_status?: string | null
          primary_color?: string | null
          slug?: string
          subscription_status?: string | null
          theme_colors?: Json | null
          trial_duration_days?: number | null
          trial_ends_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      translation_dictionary: {
        Row: {
          created_at: string
          id: string
          original_term: string
          simplified_term: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_term: string
          simplified_term: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_term?: string
          simplified_term?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_dictionary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_task_subtasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          position: number
          task_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id: string
          tenant_id: string
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_subtasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          case_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          position: number
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          position?: number
          tenant_id: string
          title: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          position?: number
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vapid_keys: {
        Row: {
          created_at: string
          id: string
          private_key: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          private_key: string
          public_key: string
        }
        Update: {
          created_at?: string
          id?: string
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      delete_case_cascade: { Args: { _case_id: string }; Returns: undefined }
      get_email_by_cpf: { Args: { _cpf: string }; Returns: string }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      match_memories: {
        Args: {
          _tenant_id: string
          _user_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          created_at: string
          id: string
          similarity: number
          summary: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "staff" | "client" | "superadmin"
      case_access_mode: "all" | "own_only" | "own_plus_oab" | "own_plus_clients"
      crm_stage:
        | "contato_inicial"
        | "reuniao_agendada"
        | "proposta_enviada"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      process_source:
        | "TJRS_1G"
        | "TJRS_2G"
        | "TRF4_JFRS"
        | "TRF4_JFSC"
        | "TRF4_JFPR"
        | "TST"
        | "TSE"
        | "STJ"
        | "STM"
        | "TRF1"
        | "TRF2"
        | "TRF3"
        | "TRF4"
        | "TRF5"
        | "TRF6"
        | "TRT1"
        | "TRT2"
        | "TRT3"
        | "TRT4"
        | "TRT5"
        | "TRT6"
        | "TRT7"
        | "TRT8"
        | "TRT9"
        | "TRT10"
        | "TRT11"
        | "TRT12"
        | "TRT13"
        | "TRT14"
        | "TRT15"
        | "TRT16"
        | "TRT17"
        | "TRT18"
        | "TRT19"
        | "TRT20"
        | "TRT21"
        | "TRT22"
        | "TRT23"
        | "TRT24"
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
      app_role: ["owner", "staff", "client", "superadmin"],
      case_access_mode: ["all", "own_only", "own_plus_oab", "own_plus_clients"],
      crm_stage: [
        "contato_inicial",
        "reuniao_agendada",
        "proposta_enviada",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      process_source: [
        "TJRS_1G",
        "TJRS_2G",
        "TRF4_JFRS",
        "TRF4_JFSC",
        "TRF4_JFPR",
        "TST",
        "TSE",
        "STJ",
        "STM",
        "TRF1",
        "TRF2",
        "TRF3",
        "TRF4",
        "TRF5",
        "TRF6",
        "TRT1",
        "TRT2",
        "TRT3",
        "TRT4",
        "TRT5",
        "TRT6",
        "TRT7",
        "TRT8",
        "TRT9",
        "TRT10",
        "TRT11",
        "TRT12",
        "TRT13",
        "TRT14",
        "TRT15",
        "TRT16",
        "TRT17",
        "TRT18",
        "TRT19",
        "TRT20",
        "TRT21",
        "TRT22",
        "TRT23",
        "TRT24",
      ],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          role: 'admin' | 'manager' | 'agent'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          avatar_url?: string | null
          role?: 'admin' | 'manager' | 'agent'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'admin' | 'manager' | 'agent'
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          type: 'person' | 'company'
          first_name: string
          last_name: string
          middle_name: string | null
          email: string | null
          phone: string | null
          phone2: string | null
          whatsapp: string | null
          telegram: string | null
          instagram: string | null
          gender: 'male' | 'female' | 'other' | null
          date_of_birth: string | null
          nationality: string | null
          country: string | null
          city: string | null
          address: string | null
          company_name: string | null
          position: string | null
          passport_series: string | null
          passport_number: string | null
          mos_number: string | null
          pio_number: string | null
          eye_color: string | null
          height: number | null
          distinguishing_marks: string | null
          father_name: string | null
          mother_name: string | null
          assigned_to: string | null
          tags: string[] | null
          notes: string | null
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: 'person' | 'company'
          first_name: string
          last_name: string
          middle_name?: string | null
          email?: string | null
          phone?: string | null
          phone2?: string | null
          whatsapp?: string | null
          telegram?: string | null
          instagram?: string | null
          gender?: 'male' | 'female' | 'other' | null
          date_of_birth?: string | null
          nationality?: string | null
          country?: string | null
          city?: string | null
          address?: string | null
          company_name?: string | null
          position?: string | null
          passport_series?: string | null
          passport_number?: string | null
          mos_number?: string | null
          pio_number?: string | null
          eye_color?: string | null
          height?: number | null
          distinguishing_marks?: string | null
          father_name?: string | null
          mother_name?: string | null
          assigned_to?: string | null
          tags?: string[] | null
          notes?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'person' | 'company'
          first_name?: string
          last_name?: string
          middle_name?: string | null
          email?: string | null
          phone?: string | null
          phone2?: string | null
          whatsapp?: string | null
          telegram?: string | null
          instagram?: string | null
          gender?: 'male' | 'female' | 'other' | null
          date_of_birth?: string | null
          nationality?: string | null
          country?: string | null
          city?: string | null
          address?: string | null
          company_name?: string | null
          position?: string | null
          passport_series?: string | null
          passport_number?: string | null
          mos_number?: string | null
          pio_number?: string | null
          eye_color?: string | null
          height?: number | null
          distinguishing_marks?: string | null
          father_name?: string | null
          mother_name?: string | null
          assigned_to?: string | null
          tags?: string[] | null
          notes?: string | null
          source?: string | null
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          status: string
          source: string
          contact_id: string | null
          first_name: string
          last_name: string | null
          phone: string | null
          email: string | null
          service_type: string | null
          description: string | null
          assigned_to: string | null
          tags: string[] | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          status?: string
          source?: string
          contact_id?: string | null
          first_name: string
          last_name?: string | null
          phone?: string | null
          email?: string | null
          service_type?: string | null
          description?: string | null
          assigned_to?: string | null
          tags?: string[] | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          status?: string
          source?: string
          contact_id?: string | null
          first_name?: string
          last_name?: string | null
          phone?: string | null
          email?: string | null
          service_type?: string | null
          description?: string | null
          assigned_to?: string | null
          tags?: string[] | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          updated_at?: string
        }
      }
      deals: {
        Row: {
          id: string
          title: string
          pipeline: string
          stage: string
          status: 'open' | 'won' | 'lost'
          contact_id: string | null
          lead_id: string | null
          amount: number | null
          currency: string
          assigned_to: string | null
          expected_close_date: string | null
          closed_at: string | null
          description: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          pipeline: string
          stage: string
          status?: 'open' | 'won' | 'lost'
          contact_id?: string | null
          lead_id?: string | null
          amount?: number | null
          currency?: string
          assigned_to?: string | null
          expected_close_date?: string | null
          closed_at?: string | null
          description?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          pipeline?: string
          stage?: string
          status?: 'open' | 'won' | 'lost'
          contact_id?: string | null
          lead_id?: string | null
          amount?: number | null
          currency?: string
          assigned_to?: string | null
          expected_close_date?: string | null
          closed_at?: string | null
          description?: string | null
          tags?: string[] | null
          updated_at?: string
        }
      }
      legalization_cases: {
        Row: {
          id: string
          case_number: string
          service_type: string
          status: string
          contact_id: string
          deal_id: string | null
          assigned_to: string | null
          first_name_latin: string | null
          last_name_latin: string | null
          date_of_birth: string | null
          place_of_birth: string | null
          nationality: string | null
          document_type: string | null
          document_number: string | null
          document_issued_by: string | null
          document_issue_date: string | null
          document_expiry_date: string | null
          document_reminder_sent: boolean | null
          mos_number: string | null
          pio_number: string | null
          eye_color: string | null
          height: number | null
          distinguishing_marks: string | null
          father_first_name: string | null
          father_last_name: string | null
          mother_first_name: string | null
          mother_last_name: string | null
          inspector_name: string | null
          inspector_phone: string | null
          inspector_office: string | null
          application_date: string | null
          decision_date: string | null
          voivodeship: string | null
          office_address: string | null
          notes: string | null
          internal_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_number?: string
          service_type: string
          status?: string
          contact_id: string
          deal_id?: string | null
          assigned_to?: string | null
          first_name_latin?: string | null
          last_name_latin?: string | null
          date_of_birth?: string | null
          place_of_birth?: string | null
          nationality?: string | null
          document_type?: string | null
          document_number?: string | null
          document_issued_by?: string | null
          document_issue_date?: string | null
          document_expiry_date?: string | null
          document_reminder_sent?: boolean | null
          mos_number?: string | null
          pio_number?: string | null
          eye_color?: string | null
          height?: number | null
          distinguishing_marks?: string | null
          father_first_name?: string | null
          father_last_name?: string | null
          mother_first_name?: string | null
          mother_last_name?: string | null
          inspector_name?: string | null
          inspector_phone?: string | null
          inspector_office?: string | null
          application_date?: string | null
          decision_date?: string | null
          voivodeship?: string | null
          office_address?: string | null
          notes?: string | null
          internal_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_number?: string
          service_type?: string
          status?: string
          contact_id?: string
          deal_id?: string | null
          assigned_to?: string | null
          first_name_latin?: string | null
          last_name_latin?: string | null
          document_type?: string | null
          document_number?: string | null
          document_expiry_date?: string | null
          document_reminder_sent?: boolean | null
          mos_number?: string | null
          pio_number?: string | null
          inspector_name?: string | null
          inspector_phone?: string | null
          inspector_office?: string | null
          application_date?: string | null
          decision_date?: string | null
          voivodeship?: string | null
          notes?: string | null
          internal_notes?: string | null
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done' | 'cancelled'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to: string | null
          created_by: string
          contact_id: string | null
          deal_id: string | null
          lead_id: string | null
          case_id: string | null
          due_date: string | null
          completed_at: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          created_by: string
          contact_id?: string | null
          deal_id?: string | null
          lead_id?: string | null
          case_id?: string | null
          due_date?: string | null
          completed_at?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          contact_id?: string | null
          deal_id?: string | null
          lead_id?: string | null
          case_id?: string | null
          due_date?: string | null
          completed_at?: string | null
          tags?: string[] | null
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          type: string
          description: string
          user_id: string
          contact_id: string | null
          lead_id: string | null
          deal_id: string | null
          case_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          description: string
          user_id: string
          contact_id?: string | null
          lead_id?: string | null
          deal_id?: string | null
          case_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          description?: string
          metadata?: Json | null
        }
      }
      comments: {
        Row: {
          id: string
          content: string
          author_id: string
          lead_id: string | null
          deal_id: string | null
          contact_id: string | null
          case_id: string | null
          task_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content: string
          author_id: string
          lead_id?: string | null
          deal_id?: string | null
          contact_id?: string | null
          case_id?: string | null
          task_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string
          updated_at?: string
        }
      }
      document_reminders: {
        Row: {
          id: string
          case_id: string
          contact_id: string
          document_expiry_date: string
          reminder_date: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          contact_id: string
          document_expiry_date: string
          reminder_date: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          sent_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

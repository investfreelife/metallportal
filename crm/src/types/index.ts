export type ContactType = 'lead' | 'client' | 'partner' | 'supplier'
export type ContactStatus = 'new' | 'active' | 'inactive' | 'blocked'
export type DealStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type AIQueueStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'auto_executed'
export type UserRole = 'owner' | 'manager' | 'viewer'

export interface Tenant {
  id: string
  name: string
  slug: string
  industry: string
  settings: Record<string, unknown>
}

export interface CrmUser {
  id: string
  tenant_id: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  full_name: string | null
  company_name: string | null
  position: string | null
  phone: string | null
  email: string | null
  telegram: string | null
  whatsapp: string | null
  type: ContactType
  status: ContactStatus
  ai_score: number
  ai_segment: string | null
  ai_next_action: string | null
  ai_next_action_at: string | null
  source: string | null
  utm_source: string | null
  utm_campaign: string | null
  assigned_to: string | null
  tags: string[]
  notes: string | null
  last_contact_at: string | null
  created_at: string
  updated_at: string
  assigned_user?: CrmUser | null
}

export interface Deal {
  id: string
  tenant_id: string
  contact_id: string | null
  title: string
  amount: number | null
  currency: string
  stage: DealStage
  lost_reason: string | null
  ai_win_probability: number
  ai_recommendation: string | null
  expected_close_date: string | null
  closed_at: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  contact?: Contact | null
}

export interface Activity {
  id: string
  tenant_id: string
  contact_id: string | null
  deal_id: string | null
  type: string
  direction: string | null
  subject: string | null
  body: string | null
  call_duration: number | null
  call_recording_url: string | null
  call_transcript: string | null
  call_summary: string | null
  created_by: string | null
  is_ai_generated: boolean
  created_at: string
}

export interface AIQueueItem {
  id: string
  tenant_id: string
  contact_id: string | null
  deal_id: string | null
  action_type: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  subject: string | null
  content: string
  ai_reasoning: string | null
  status: AIQueueStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  edited_content: string | null
  auto_execute_at: string | null
  created_at: string
  contact?: Contact | null
  deal?: Deal | null
}

export interface DashboardMetrics {
  totalContacts: number
  hotLeads: number
  activeDeals: number
  pipelineAmount: number
}

/**
 * Flow-related TypeScript interfaces and types
 */

export interface FlowAction {
  action_type: string
  genre?: string
  content_id?: string
  content_title?: string
  commercial_count?: number
  batch_number?: number
  song_count?: number
  duration_minutes?: number
  volume_level?: number
  announcement_text?: string
  description?: string
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface FlowSchedule {
  // For recurring events
  start_time?: string
  end_time?: string
  // For one-time/multi-day events
  start_datetime?: string
  end_datetime?: string
  // Common fields
  recurrence: RecurrenceType
  days_of_week: number[]
  day_of_month?: number
  month?: number
}

export interface Flow {
  _id: string
  name: string
  name_he?: string
  description?: string
  description_he?: string
  actions: FlowAction[]
  trigger_type: 'scheduled' | 'manual' | 'event'
  schedule?: FlowSchedule
  status: 'active' | 'paused' | 'disabled' | 'running'
  priority: number
  loop: boolean
  last_run?: string
  run_count: number
  calendar_event_id?: string
}

export interface SuggestedFlow {
  id: string
  name: string
  name_he: string
  description: string
  description_he: string
  trigger_type: 'scheduled' | 'manual'
  schedule?: FlowSchedule
  actions: FlowAction[]
}

export type BuildMode = 'manual' | 'ai'
export type TriggerType = 'scheduled' | 'manual'

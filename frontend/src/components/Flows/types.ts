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
  // For play_jingle
  jingle_type?: string // "station_id", "bumper", "transition"
  // For fade_volume
  target_volume?: number
  fade_duration_seconds?: number
  // For time_check
  time_format?: string // "12h" or "24h"
  time_language?: string // "en" or "he"
  // TTS fields (for announcement, time_check, generate_jingle)
  voice_preset?: string
  tts_language?: 'he' | 'en'
  exaggeration?: number // 0.5-2.0 expressiveness
  use_tts?: boolean
  // For generate_jingle
  jingle_text?: string
  jingle_style?: 'station_id' | 'bumper' | 'transition' | 'promo'
  save_as_content?: boolean
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

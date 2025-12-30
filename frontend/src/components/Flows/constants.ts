/**
 * Flow-related constants
 */

import { SuggestedFlow, RecurrenceType } from './types'

// Suggested built-in flows
export const SUGGESTED_FLOWS: SuggestedFlow[] = [
  {
    id: 'morning_happy',
    name: 'Happy Morning Show',
    name_he: 'תוכנית בוקר שמחה',
    description: 'Play happy israeli music, then 2 commercials, then mizrahi',
    description_he: 'נגן מוזיקה ישראלית שמחה, אז 2 פרסומות, אז מזרחי',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '08:00',
      end_time: '10:00',
      recurrence: 'weekly' as RecurrenceType,
      days_of_week: [0, 1, 2, 3, 4], // Sun-Thu
    },
    actions: [
      { action_type: 'play_genre', genre: 'happy', duration_minutes: 45, description: 'Play happy music' },
      { action_type: 'play_commercials', commercial_count: 2, description: 'Play 2 commercials' },
      { action_type: 'play_genre', genre: 'mizrahi', duration_minutes: 30, description: 'Play mizrahi music' },
    ]
  },
  {
    id: 'friday_special',
    name: 'Friday Hasidi Special',
    name_he: 'מיוחד חסידי לשישי',
    description: 'Play hasidi music for Shabbat preparation',
    description_he: 'נגן מוזיקה חסידית לקראת שבת',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '14:00',
      end_time: '16:00',
      recurrence: 'weekly' as RecurrenceType,
      days_of_week: [5], // Friday
    },
    actions: [
      { action_type: 'play_genre', genre: 'hasidi', duration_minutes: 120, description: 'Play hasidi music' },
    ]
  },
  {
    id: 'commercial_break',
    name: 'Commercial Break',
    name_he: 'הפסקת פרסומות',
    description: 'Play 3 commercials',
    description_he: 'נגן 3 פרסומות',
    trigger_type: 'manual',
    actions: [
      { action_type: 'play_commercials', commercial_count: 3, description: 'Play 3 commercials' },
    ]
  },
  {
    id: 'evening_mix',
    name: 'Evening Mix',
    name_he: 'מיקס ערב',
    description: 'Play mixed israeli music, then commercials, then mediterranean',
    description_he: 'נגן מיקס ישראלי, אז פרסומות, אז ים תיכוני',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '18:00',
      end_time: '20:00',
      recurrence: 'daily' as RecurrenceType,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
    },
    actions: [
      { action_type: 'play_genre', genre: 'israeli', duration_minutes: 40, description: 'Play israeli music' },
      { action_type: 'play_commercials', commercial_count: 2, description: 'Play 2 commercials' },
      { action_type: 'play_genre', genre: 'mediterranean', duration_minutes: 40, description: 'Play mediterranean music' },
    ]
  },
]

// Available genres for flow actions
export const FLOW_GENRES = [
  'hasidi', 'mizrahi', 'happy', 'israeli', 'pop', 'rock',
  'mediterranean', 'classic', 'hebrew', 'mixed', 'all'
]

// Day names for schedule display
export const DAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
}

// Action type options for manual action creation
export const ACTION_TYPE_OPTIONS = [
  { value: 'play_genre', label: 'Play Genre', label_he: 'נגן ז\'אנר' },
  { value: 'play_commercials', label: 'Play Commercials', label_he: 'נגן פרסומות' },
  { value: 'play_content', label: 'Play Content', label_he: 'נגן תוכן' },
  { value: 'play_show', label: 'Play Show', label_he: 'נגן תוכנית' },
  { value: 'wait', label: 'Wait', label_he: 'המתן' },
  { value: 'set_volume', label: 'Set Volume', label_he: 'קבע עוצמה' },
  { value: 'announcement', label: 'Announcement', label_he: 'הכרזה' },
]

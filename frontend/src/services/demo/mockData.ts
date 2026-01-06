/**
 * Demo Mock Data - Comprehensive bilingual demo data for all pages
 *
 * This file contains all the mock data needed to demonstrate the full
 * functionality of the Israeli Radio Manager in demo mode.
 */

import {
  Track,
  Campaign,
  Flow,
  CalendarEvent,
  WeekSchedule,
  AgentDecision,
  PendingAction,
  User,
  VoicePreset,
  PlaybackHistoryItem,
  PendingUpload,
  WeeklySlot,
  FlowExecution,
  ChatMessage,
} from '../types'

// =============================================================================
// Helper Functions
// =============================================================================

const today = new Date()
const formatDate = (d: Date) => d.toISOString().split('T')[0]
const daysFromNow = (days: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d
}
const hoursFromNow = (hours: number) => {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString()
}
const daysAgo = (days: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() - days)
  return d
}

// =============================================================================
// SONGS - Israeli and International Mix
// =============================================================================

export const DEMO_SONGS: Track[] = [
  {
    _id: 'demo-song-001',
    title: 'שמש של בוקר',
    artist: 'דני סנדרסון',
    type: 'song',
    genre: 'Israeli Pop',
    duration_seconds: 234,
    play_count: 127,
    created_at: daysAgo(30).toISOString(),
  },
  {
    _id: 'demo-song-002',
    title: 'לילה טוב',
    artist: 'אריק איינשטיין',
    type: 'song',
    genre: 'Israeli Rock',
    duration_seconds: 198,
    play_count: 89,
    created_at: daysAgo(25).toISOString(),
  },
  {
    _id: 'demo-song-003',
    title: 'Dancing Queen',
    artist: 'ABBA',
    type: 'song',
    genre: 'Pop',
    duration_seconds: 231,
    play_count: 156,
    created_at: daysAgo(20).toISOString(),
  },
  {
    _id: 'demo-song-004',
    title: 'הכל עובר חביבי',
    artist: 'עומר אדם',
    type: 'song',
    genre: 'Mizrachi',
    duration_seconds: 212,
    play_count: 203,
    created_at: daysAgo(15).toISOString(),
  },
  {
    _id: 'demo-song-005',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    type: 'song',
    genre: 'Rock',
    duration_seconds: 354,
    play_count: 78,
    created_at: daysAgo(40).toISOString(),
  },
  {
    _id: 'demo-song-006',
    title: 'יום הולדת',
    artist: 'אהוד בנאי',
    type: 'song',
    genre: 'Israeli Rock',
    duration_seconds: 267,
    play_count: 92,
    created_at: daysAgo(35).toISOString(),
  },
  {
    _id: 'demo-song-007',
    title: 'שיר לשלום',
    artist: 'להקת הנח"ל',
    type: 'song',
    genre: 'Israeli Classic',
    duration_seconds: 285,
    play_count: 145,
    created_at: daysAgo(60).toISOString(),
  },
  {
    _id: 'demo-song-008',
    title: 'Hotel California',
    artist: 'Eagles',
    type: 'song',
    genre: 'Rock',
    duration_seconds: 391,
    play_count: 67,
    created_at: daysAgo(45).toISOString(),
  },
  {
    _id: 'demo-song-009',
    title: 'תן לי יד',
    artist: 'שלמה ארצי',
    type: 'song',
    genre: 'Israeli Pop',
    duration_seconds: 245,
    play_count: 178,
    created_at: daysAgo(10).toISOString(),
  },
  {
    _id: 'demo-song-010',
    title: 'Uptown Funk',
    artist: 'Bruno Mars',
    type: 'song',
    genre: 'Pop',
    duration_seconds: 269,
    play_count: 234,
    created_at: daysAgo(5).toISOString(),
  },
  {
    _id: 'demo-song-011',
    title: 'אני והיא',
    artist: 'עידן רייכל',
    type: 'song',
    genre: 'World',
    duration_seconds: 312,
    play_count: 112,
    created_at: daysAgo(22).toISOString(),
  },
  {
    _id: 'demo-song-012',
    title: 'Imagine',
    artist: 'John Lennon',
    type: 'song',
    genre: 'Classic Rock',
    duration_seconds: 187,
    play_count: 156,
    created_at: daysAgo(50).toISOString(),
  },
  {
    _id: 'demo-song-013',
    title: 'מילים',
    artist: 'יהודית רביץ',
    type: 'song',
    genre: 'Israeli Pop',
    duration_seconds: 223,
    play_count: 89,
    created_at: daysAgo(28).toISOString(),
  },
  {
    _id: 'demo-song-014',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    type: 'song',
    genre: 'Pop',
    duration_seconds: 234,
    play_count: 298,
    created_at: daysAgo(3).toISOString(),
  },
  {
    _id: 'demo-song-015',
    title: 'ירח',
    artist: 'סטטיק ובן אל תבורי',
    type: 'song',
    genre: 'Israeli Pop',
    duration_seconds: 198,
    play_count: 312,
    created_at: daysAgo(1).toISOString(),
  },
]

// =============================================================================
// SHOWS
// =============================================================================

export const DEMO_SHOWS: Track[] = [
  {
    _id: 'demo-show-001',
    title: 'תוכנית הבוקר',
    artist: 'צוות הבוקר',
    type: 'show',
    genre: 'Morning Show',
    duration_seconds: 7200, // 2 hours
    created_at: daysAgo(7).toISOString(),
  },
  {
    _id: 'demo-show-002',
    title: 'חדשות הצהריים',
    artist: 'מערכת החדשות',
    type: 'show',
    genre: 'News',
    duration_seconds: 1800, // 30 minutes
    created_at: daysAgo(1).toISOString(),
  },
  {
    _id: 'demo-show-003',
    title: 'מוזיקה ישראלית',
    artist: 'רן מנדלסון',
    type: 'show',
    genre: 'Music Show',
    duration_seconds: 3600, // 1 hour
    created_at: daysAgo(3).toISOString(),
  },
  {
    _id: 'demo-show-004',
    title: 'Weekend Special',
    artist: 'DJ Mix',
    type: 'show',
    genre: 'Party',
    duration_seconds: 5400, // 1.5 hours
    created_at: daysAgo(5).toISOString(),
  },
  {
    _id: 'demo-show-005',
    title: 'סיפורי לילה',
    artist: 'מירי מיכאלי',
    type: 'show',
    genre: 'Talk Show',
    duration_seconds: 2700, // 45 minutes
    created_at: daysAgo(2).toISOString(),
  },
]

// =============================================================================
// COMMERCIALS
// =============================================================================

export const DEMO_COMMERCIALS: Track[] = [
  {
    _id: 'demo-commercial-001',
    title: 'מבצע קיץ - סופר פארם',
    type: 'commercial',
    duration_seconds: 30,
    batch_number: 1,
    created_at: daysAgo(10).toISOString(),
  },
  {
    _id: 'demo-commercial-002',
    title: 'פיצה האט - משפחתית',
    type: 'commercial',
    duration_seconds: 25,
    batch_number: 1,
    created_at: daysAgo(8).toISOString(),
  },
  {
    _id: 'demo-commercial-003',
    title: 'בנק לאומי - משכנתא',
    type: 'commercial',
    duration_seconds: 45,
    batch_number: 2,
    created_at: daysAgo(15).toISOString(),
  },
  {
    _id: 'demo-commercial-004',
    title: 'שופרסל - מבצעי שבוע',
    type: 'commercial',
    duration_seconds: 30,
    batch_number: 2,
    created_at: daysAgo(5).toISOString(),
  },
  {
    _id: 'demo-commercial-005',
    title: 'YES - חבילת ספורט',
    type: 'commercial',
    duration_seconds: 35,
    batch_number: 3,
    created_at: daysAgo(3).toISOString(),
  },
  {
    _id: 'demo-commercial-006',
    title: 'אלקטרה - מזגנים',
    type: 'commercial',
    duration_seconds: 30,
    batch_number: 3,
    created_at: daysAgo(12).toISOString(),
  },
  {
    _id: 'demo-commercial-007',
    title: 'פלאפון - חבילת אינטרנט',
    type: 'commercial',
    duration_seconds: 25,
    batch_number: 4,
    created_at: daysAgo(7).toISOString(),
  },
  {
    _id: 'demo-commercial-008',
    title: 'קסטרו - סוף עונה',
    type: 'commercial',
    duration_seconds: 30,
    batch_number: 4,
    created_at: daysAgo(4).toISOString(),
  },
  {
    _id: 'demo-commercial-009',
    title: 'רמי לוי - מוצרי חלב',
    type: 'commercial',
    duration_seconds: 20,
    batch_number: 5,
    created_at: daysAgo(2).toISOString(),
  },
  {
    _id: 'demo-commercial-010',
    title: 'HOT - סדרות חדשות',
    type: 'commercial',
    duration_seconds: 40,
    batch_number: 5,
    created_at: daysAgo(1).toISOString(),
  },
]

// =============================================================================
// JINGLES
// =============================================================================

export const DEMO_JINGLES: Track[] = [
  {
    _id: 'demo-jingle-001',
    title: 'פתיח פרסומות - אנרגטי',
    type: 'jingle',
    duration_seconds: 5,
    created_at: daysAgo(60).toISOString(),
  },
  {
    _id: 'demo-jingle-002',
    title: 'סיום פרסומות - חזרה למוזיקה',
    type: 'jingle',
    duration_seconds: 4,
    created_at: daysAgo(60).toISOString(),
  },
  {
    _id: 'demo-jingle-003',
    title: 'זיהוי תחנה - קצר',
    type: 'jingle',
    duration_seconds: 3,
    created_at: daysAgo(90).toISOString(),
  },
  {
    _id: 'demo-jingle-004',
    title: 'זיהוי תחנה - מלא',
    type: 'jingle',
    duration_seconds: 8,
    created_at: daysAgo(90).toISOString(),
  },
  {
    _id: 'demo-jingle-005',
    title: 'מעבר חדשות',
    type: 'jingle',
    duration_seconds: 6,
    created_at: daysAgo(45).toISOString(),
  },
]

// =============================================================================
// SAMPLES & NEWSFLASHES
// =============================================================================

export const DEMO_SAMPLES: Track[] = [
  {
    _id: 'demo-sample-001',
    title: 'אפקט קהל',
    type: 'sample',
    duration_seconds: 10,
    created_at: daysAgo(30).toISOString(),
  },
  {
    _id: 'demo-sample-002',
    title: 'מחיאות כפיים',
    type: 'sample',
    duration_seconds: 5,
    created_at: daysAgo(30).toISOString(),
  },
  {
    _id: 'demo-sample-003',
    title: 'צליל התראה',
    type: 'sample',
    duration_seconds: 2,
    created_at: daysAgo(30).toISOString(),
  },
]

export const DEMO_NEWSFLASHES: Track[] = [
  {
    _id: 'demo-newsflash-001',
    title: 'עדכון מזג אוויר',
    type: 'newsflash',
    duration_seconds: 45,
    created_at: daysAgo(1).toISOString(),
  },
  {
    _id: 'demo-newsflash-002',
    title: 'עדכון תנועה',
    type: 'newsflash',
    duration_seconds: 60,
    created_at: daysAgo(1).toISOString(),
  },
  {
    _id: 'demo-newsflash-003',
    title: 'כותרות החדשות',
    type: 'newsflash',
    duration_seconds: 90,
    created_at: daysAgo(1).toISOString(),
  },
]

// =============================================================================
// ALL CONTENT (Combined)
// =============================================================================

export const DEMO_ALL_CONTENT: Track[] = [
  ...DEMO_SONGS,
  ...DEMO_SHOWS,
  ...DEMO_COMMERCIALS,
  ...DEMO_JINGLES,
  ...DEMO_SAMPLES,
  ...DEMO_NEWSFLASHES,
]

// =============================================================================
// GENRES
// =============================================================================

export const DEMO_GENRES: string[] = [
  'Israeli Pop',
  'Israeli Rock',
  'Israeli Classic',
  'Mizrachi',
  'Pop',
  'Rock',
  'Classic Rock',
  'World',
  'Morning Show',
  'News',
  'Music Show',
  'Party',
  'Talk Show',
]

// =============================================================================
// CAMPAIGNS
// =============================================================================

// Helper to generate schedule grid for a week
const generateScheduleGrid = (
  startDate: Date,
  daysCount: number,
  playCounts: number[]
): WeeklySlot[] => {
  const grid: WeeklySlot[] = []
  for (let day = 0; day < daysCount; day++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + day)
    const dateStr = formatDate(date)

    // Add slots for typical commercial hours (8-22)
    for (let hour = 8; hour < 22; hour++) {
      const slotIndex = day * 24 + hour
      const playCount = playCounts[hour % playCounts.length]
      if (playCount > 0) {
        grid.push({
          slot_date: dateStr,
          slot_index: slotIndex,
          play_count: playCount,
        })
      }
    }
  }
  return grid
}

export const DEMO_CAMPAIGNS: Campaign[] = [
  {
    _id: 'demo-campaign-001',
    name: 'Summer Sale 2024',
    name_he: 'מבצע קיץ 2024',
    campaign_type: 'commercial',
    comment: 'Main summer promotional campaign',
    start_date: formatDate(daysAgo(10)),
    end_date: formatDate(daysFromNow(20)),
    status: 'active',
    priority: 10,
    content_refs: [
      { content_id: 'demo-commercial-001' },
      { content_id: 'demo-commercial-004' },
    ],
    schedule_grid: generateScheduleGrid(daysAgo(7), 14, [2, 3, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3]),
    created_at: daysAgo(15).toISOString(),
    updated_at: daysAgo(2).toISOString(),
  },
  {
    _id: 'demo-campaign-002',
    name: 'Back to School',
    name_he: 'בחזרה ללימודים',
    campaign_type: 'commercial',
    comment: 'School supplies and backpacks',
    start_date: formatDate(daysAgo(5)),
    end_date: formatDate(daysFromNow(25)),
    status: 'active',
    priority: 8,
    content_refs: [
      { content_id: 'demo-commercial-008' },
    ],
    schedule_grid: generateScheduleGrid(daysAgo(5), 14, [1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 1]),
    created_at: daysAgo(7).toISOString(),
    updated_at: daysAgo(1).toISOString(),
  },
  {
    _id: 'demo-campaign-003',
    name: 'Holiday Special',
    name_he: 'מיוחד לחגים',
    campaign_type: 'commercial',
    comment: 'Holiday season promotions',
    start_date: formatDate(daysAgo(30)),
    end_date: formatDate(daysFromNow(5)),
    status: 'paused',
    priority: 5,
    content_refs: [
      { content_id: 'demo-commercial-003' },
      { content_id: 'demo-commercial-006' },
    ],
    schedule_grid: generateScheduleGrid(daysAgo(30), 7, [1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1]),
    created_at: daysAgo(35).toISOString(),
    updated_at: daysAgo(5).toISOString(),
  },
  {
    _id: 'demo-campaign-004',
    name: 'Winter Collection',
    name_he: 'קולקציית חורף',
    campaign_type: 'commercial',
    comment: 'Winter fashion campaign - completed',
    start_date: formatDate(daysAgo(60)),
    end_date: formatDate(daysAgo(30)),
    status: 'completed',
    priority: 7,
    content_refs: [
      { content_id: 'demo-commercial-008' },
    ],
    schedule_grid: [],
    created_at: daysAgo(65).toISOString(),
    updated_at: daysAgo(30).toISOString(),
  },
  {
    _id: 'demo-campaign-005',
    name: 'Bank Mortgage',
    name_he: 'משכנתא בנקאית',
    campaign_type: 'commercial',
    comment: 'Long-running mortgage awareness',
    start_date: formatDate(daysAgo(20)),
    end_date: formatDate(daysFromNow(40)),
    status: 'active',
    priority: 6,
    content_refs: [
      { content_id: 'demo-commercial-003' },
    ],
    schedule_grid: generateScheduleGrid(daysAgo(7), 14, [1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1]),
    created_at: daysAgo(25).toISOString(),
    updated_at: daysAgo(3).toISOString(),
  },
]

// =============================================================================
// FLOWS
// =============================================================================

export const DEMO_FLOWS: Flow[] = [
  {
    _id: 'demo-flow-001',
    name: 'Morning Show Opener',
    name_he: 'פתיח תוכנית בוקר',
    description: 'Opens the morning show with jingle and announcement',
    actions: [
      { id: 'a1', action_type: 'play_jingle', content_id: 'demo-jingle-004', description: 'Station ID' },
      { id: 'a2', action_type: 'announcement', announcement_text: 'בוקר טוב ישראל! ברוכים הבאים לתוכנית הבוקר', description: 'Morning greeting' },
      { id: 'a3', action_type: 'play_genre', genre: 'Israeli Pop', duration_minutes: 30, description: 'Play Israeli Pop for 30 min' },
    ],
    trigger_type: 'scheduled',
    schedule: {
      days_of_week: [0, 1, 2, 3, 4], // Sun-Thu
      start_time: '06:00',
    },
    priority: 10,
    status: 'active',
    created_at: daysAgo(30).toISOString(),
    updated_at: daysAgo(5).toISOString(),
  },
  {
    _id: 'demo-flow-002',
    name: 'Commercial Break',
    name_he: 'הפסקת פרסומות',
    description: 'Standard commercial break with jingles',
    actions: [
      { id: 'b1', action_type: 'play_jingle', content_id: 'demo-jingle-001', description: 'Commercial opener' },
      { id: 'b2', action_type: 'play_commercials', commercial_count: 4, description: 'Play 4 commercials' },
      { id: 'b3', action_type: 'play_jingle', content_id: 'demo-jingle-002', description: 'Back to music' },
    ],
    trigger_type: 'manual',
    priority: 5,
    status: 'active',
    created_at: daysAgo(60).toISOString(),
    updated_at: daysAgo(10).toISOString(),
  },
  {
    _id: 'demo-flow-003',
    name: 'Evening Wind Down',
    name_he: 'רוגע ערב',
    description: 'Calm evening music at lower volume',
    actions: [
      { id: 'c1', action_type: 'set_volume', volume_level: 70, description: 'Lower volume' },
      { id: 'c2', action_type: 'play_genre', genre: 'Israeli Classic', duration_minutes: 60, description: 'Play classics' },
      { id: 'c3', action_type: 'set_volume', volume_level: 100, description: 'Restore volume' },
    ],
    trigger_type: 'scheduled',
    schedule: {
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      start_time: '22:00',
    },
    priority: 3,
    status: 'active',
    created_at: daysAgo(45).toISOString(),
    updated_at: daysAgo(7).toISOString(),
  },
  {
    _id: 'demo-flow-004',
    name: 'News Update',
    name_he: 'עדכון חדשות',
    description: 'Quick news update with return to music',
    actions: [
      { id: 'd1', action_type: 'play_jingle', content_id: 'demo-jingle-005', description: 'News jingle' },
      { id: 'd2', action_type: 'play_newsflash', content_id: 'demo-newsflash-003', description: 'Headlines' },
      { id: 'd3', action_type: 'wait', duration_minutes: 1, description: 'Brief pause' },
      { id: 'd4', action_type: 'play_genre', genre: 'Pop', duration_minutes: 15, description: 'Return to music' },
    ],
    trigger_type: 'scheduled',
    schedule: {
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      start_time: '12:00',
    },
    priority: 8,
    status: 'active',
    created_at: daysAgo(20).toISOString(),
    updated_at: daysAgo(2).toISOString(),
  },
]

// =============================================================================
// CALENDAR EVENTS
// =============================================================================

const generateWeekEvents = (): CalendarEvent[] => {
  const events: CalendarEvent[] = []

  // Morning shows (weekdays)
  for (let i = 0; i < 5; i++) {
    const date = daysFromNow(i)
    if (date.getDay() >= 0 && date.getDay() <= 4) { // Sun-Thu
      events.push({
        id: `demo-event-morning-${i}`,
        summary: 'תוכנית הבוקר',
        start: { dateTime: new Date(date.setHours(6, 0, 0)).toISOString() },
        end: { dateTime: new Date(date.setHours(9, 0, 0)).toISOString() },
        description: 'Morning show with news and music',
        extendedProperties: {
          private: {
            radio_content_id: 'demo-show-001',
            radio_content_type: 'show',
            radio_managed: 'true',
          },
        },
      })
    }
  }

  // News at noon (daily)
  for (let i = 0; i < 7; i++) {
    const date = daysFromNow(i)
    events.push({
      id: `demo-event-news-${i}`,
      summary: 'חדשות הצהריים',
      start: { dateTime: new Date(date.setHours(12, 0, 0)).toISOString() },
      end: { dateTime: new Date(date.setHours(12, 30, 0)).toISOString() },
      description: 'Midday news update',
      extendedProperties: {
        private: {
          radio_content_id: 'demo-show-002',
          radio_content_type: 'show',
          radio_managed: 'true',
        },
      },
    })
  }

  // Israeli music show (Tue, Thu)
  for (let i = 0; i < 7; i++) {
    const date = daysFromNow(i)
    if (date.getDay() === 2 || date.getDay() === 4) { // Tue or Thu
      events.push({
        id: `demo-event-israeli-${i}`,
        summary: 'מוזיקה ישראלית',
        start: { dateTime: new Date(date.setHours(20, 0, 0)).toISOString() },
        end: { dateTime: new Date(date.setHours(21, 0, 0)).toISOString() },
        description: 'Israeli music special',
        extendedProperties: {
          private: {
            radio_content_id: 'demo-show-003',
            radio_content_type: 'show',
            radio_managed: 'true',
          },
        },
      })
    }
  }

  // Weekend party (Fri evening)
  const friday = daysFromNow((5 - today.getDay() + 7) % 7 || 7)
  events.push({
    id: 'demo-event-weekend',
    summary: 'Weekend Special',
    start: { dateTime: new Date(friday.setHours(21, 0, 0)).toISOString() },
    end: { dateTime: new Date(friday.setHours(23, 30, 0)).toISOString() },
    description: 'Weekend party mix',
    extendedProperties: {
      private: {
        radio_content_id: 'demo-show-004',
        radio_content_type: 'show',
        radio_managed: 'true',
      },
    },
  })

  return events
}

export const DEMO_CALENDAR_EVENTS = generateWeekEvents()

// Generate week schedule from events
export const generateDemoWeekSchedule = (startDate?: string): WeekSchedule => {
  const start = startDate ? new Date(startDate) : new Date()
  start.setDate(start.getDate() - start.getDay()) // Start from Sunday

  const schedule: WeekSchedule = {}
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayNamesHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const dateStr = formatDate(date)

    const dayEvents = DEMO_CALENDAR_EVENTS.filter(e => {
      const eventDate = e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date!)
      return formatDate(eventDate) === dateStr
    })

    schedule[dateStr] = {
      date: dateStr,
      day_name: dayNames[date.getDay()],
      day_name_he: dayNamesHe[date.getDay()],
      events: dayEvents,
    }
  }

  return schedule
}

// =============================================================================
// AGENT DATA
// =============================================================================

export const DEMO_AGENT_DECISIONS: AgentDecision[] = [
  {
    _id: 'demo-decision-001',
    action_type: 'play_song',
    reasoning: 'Selected upbeat Israeli Pop song to maintain energy during morning slot',
    created_at: hoursFromNow(-1),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-002',
    action_type: 'adjust_volume',
    reasoning: 'Lowered volume slightly during talk segment for better voice clarity',
    created_at: hoursFromNow(-2),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-003',
    action_type: 'skip_commercial',
    reasoning: 'Skipped expired commercial - campaign ended yesterday',
    created_at: hoursFromNow(-3),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-004',
    action_type: 'play_genre',
    reasoning: 'Switching to Mizrachi genre based on time of day preferences',
    created_at: hoursFromNow(-5),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-005',
    action_type: 'insert_jingle',
    reasoning: 'Added station ID jingle after 30 minutes of continuous music',
    created_at: hoursFromNow(-6),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-006',
    action_type: 'play_newsflash',
    reasoning: 'Scheduled traffic update for rush hour',
    created_at: hoursFromNow(-8),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-007',
    action_type: 'balance_genres',
    reasoning: 'Increased Rock songs to balance genre distribution',
    created_at: hoursFromNow(-10),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-008',
    action_type: 'commercial_break',
    reasoning: 'Initiated commercial break - 45 minutes since last break',
    created_at: hoursFromNow(-12),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-009',
    action_type: 'play_song',
    reasoning: 'Selected popular song based on recent play statistics',
    created_at: hoursFromNow(-14),
    approved: true,
    executed: true,
  },
  {
    _id: 'demo-decision-010',
    action_type: 'schedule_show',
    reasoning: 'Scheduled evening show based on calendar',
    created_at: hoursFromNow(-16),
    approved: true,
    executed: true,
  },
]

export const DEMO_PENDING_ACTIONS: PendingAction[] = [
  {
    _id: 'demo-pending-001',
    action_type: 'play_genre',
    description: 'Switch to Israeli Classic genre for evening slot',
    expires_at: hoursFromNow(2),
    alternatives: [
      { description: 'Play Israeli Rock instead', action_data: { genre: 'Israeli Rock' } },
      { description: 'Continue current genre', action_data: { skip: true } },
    ],
  },
  {
    _id: 'demo-pending-002',
    action_type: 'commercial_break',
    description: 'Start commercial break with 3 spots',
    expires_at: hoursFromNow(1),
    alternatives: [
      { description: 'Play 2 spots only', action_data: { count: 2 } },
      { description: 'Delay by 15 minutes', action_data: { delay: 15 } },
    ],
  },
  {
    _id: 'demo-pending-003',
    action_type: 'announcement',
    description: 'Play weather update announcement',
    expires_at: hoursFromNow(3),
  },
]

export const DEMO_CHAT_HISTORY: ChatMessage[] = [
  {
    _id: 'demo-chat-001',
    role: 'user',
    content: 'מה משמיעים עכשיו?',
    created_at: hoursFromNow(-1),
  },
  {
    _id: 'demo-chat-002',
    role: 'assistant',
    content: 'כרגע מתנגן "שמש של בוקר" של דני סנדרסון. השיר הבא בתור הוא "Dancing Queen" של ABBA.',
    created_at: hoursFromNow(-1),
  },
  {
    _id: 'demo-chat-003',
    role: 'user',
    content: 'Can you add more Israeli songs to the queue?',
    created_at: hoursFromNow(-0.5),
  },
  {
    _id: 'demo-chat-004',
    role: 'assistant',
    content: 'I\'ve added 3 Israeli songs to the queue: "לילה טוב" by אריק איינשטיין, "תן לי יד" by שלמה ארצי, and "ירח" by סטטיק ובן אל תבורי. They will play after the current queue items.',
    created_at: hoursFromNow(-0.5),
  },
]

// =============================================================================
// USERS
// =============================================================================

export const DEMO_USERS: User[] = [
  {
    _id: 'demo-user-001',
    firebase_uid: 'demo-admin-uid',
    email: 'admin@demo.radio.olorin.ai',
    role: 'admin',
    display_name: 'Demo Admin',
    is_active: true,
    preferences: {
      language: 'he',
      theme: 'light',
      notifications: { email_enabled: true, push_enabled: true, sms_enabled: false },
    },
    created_at: daysAgo(365).toISOString(),
    updated_at: daysAgo(1).toISOString(),
    last_login: hoursFromNow(-2),
  },
  {
    _id: 'demo-user-002',
    firebase_uid: 'demo-editor-uid',
    email: 'editor@demo.radio.olorin.ai',
    role: 'editor',
    display_name: 'Demo Editor',
    is_active: true,
    preferences: {
      language: 'en',
      theme: 'dark',
      notifications: { email_enabled: true, push_enabled: false, sms_enabled: false },
    },
    created_at: daysAgo(180).toISOString(),
    updated_at: daysAgo(3).toISOString(),
    last_login: hoursFromNow(-24),
  },
  {
    _id: 'demo-user-003',
    firebase_uid: 'demo-viewer-uid',
    email: 'viewer@demo.radio.olorin.ai',
    role: 'viewer',
    display_name: 'Demo Viewer',
    is_active: true,
    preferences: {
      language: 'he',
      theme: 'light',
    },
    created_at: daysAgo(30).toISOString(),
    updated_at: daysAgo(7).toISOString(),
    last_login: hoursFromNow(-1),
  },
]

export const DEMO_CURRENT_USER: User = DEMO_USERS[2] // Viewer for demo mode

// =============================================================================
// VOICE PRESETS
// =============================================================================

export const DEMO_VOICE_PRESETS: VoicePreset[] = [
  {
    _id: 'demo-voice-001',
    name: 'male_announcer',
    display_name: 'קריין גברי',
    display_name_he: 'קריין גברי',
    language: 'he-IL',
    is_default: true,
    created_at: daysAgo(90).toISOString(),
  },
  {
    _id: 'demo-voice-002',
    name: 'female_announcer',
    display_name: 'קריינית נשית',
    display_name_he: 'קריינית נשית',
    language: 'he-IL',
    is_default: false,
    created_at: daysAgo(90).toISOString(),
  },
  {
    _id: 'demo-voice-003',
    name: 'english_male',
    display_name: 'English Male',
    language: 'en-US',
    is_default: false,
    created_at: daysAgo(60).toISOString(),
  },
]

// =============================================================================
// PLAYBACK DATA
// =============================================================================

export const DEMO_PLAYBACK_HISTORY: PlaybackHistoryItem[] = [
  { _id: 'ph-001', content_id: 'demo-song-015', content_title: 'ירח', content_type: 'song', played_at: hoursFromNow(-0.1), title: 'ירח', artist: 'נועה קירל', type: 'song', started_at: hoursFromNow(-0.1), duration_seconds: 198 },
  { _id: 'ph-002', content_id: 'demo-song-014', content_title: 'Shape of You', content_type: 'song', played_at: hoursFromNow(-0.2), title: 'Shape of You', artist: 'Ed Sheeran', type: 'song', started_at: hoursFromNow(-0.2), duration_seconds: 234 },
  { _id: 'ph-003', content_id: 'demo-jingle-003', content_title: 'זיהוי תחנה - קצר', content_type: 'jingle', played_at: hoursFromNow(-0.25), title: 'זיהוי תחנה - קצר', type: 'jingle', started_at: hoursFromNow(-0.25), duration_seconds: 3 },
  { _id: 'ph-004', content_id: 'demo-song-010', content_title: 'Uptown Funk', content_type: 'song', played_at: hoursFromNow(-0.35), title: 'Uptown Funk', artist: 'Bruno Mars', type: 'song', started_at: hoursFromNow(-0.35), duration_seconds: 269 },
  { _id: 'ph-005', content_id: 'demo-song-004', content_title: 'הכל עובר חביבי', content_type: 'song', played_at: hoursFromNow(-0.5), title: 'הכל עובר חביבי', artist: 'אריק איינשטיין', type: 'song', started_at: hoursFromNow(-0.5), duration_seconds: 212 },
  { _id: 'ph-006', content_id: 'demo-commercial-001', content_title: 'מבצע קיץ - סופר פארם', content_type: 'commercial', played_at: hoursFromNow(-0.55), title: 'מבצע קיץ - סופר פארם', type: 'commercial', started_at: hoursFromNow(-0.55), duration_seconds: 30 },
  { _id: 'ph-007', content_id: 'demo-commercial-002', content_title: 'פיצה האט - משפחתית', content_type: 'commercial', played_at: hoursFromNow(-0.6), title: 'פיצה האט - משפחתית', type: 'commercial', started_at: hoursFromNow(-0.6), duration_seconds: 25 },
  { _id: 'ph-008', content_id: 'demo-jingle-001', content_title: 'פתיח פרסומות - אנרגטי', content_type: 'jingle', played_at: hoursFromNow(-0.62), title: 'פתיח פרסומות - אנרגטי', type: 'jingle', started_at: hoursFromNow(-0.62), duration_seconds: 5 },
  { _id: 'ph-009', content_id: 'demo-song-001', content_title: 'שמש של בוקר', content_type: 'song', played_at: hoursFromNow(-0.75), title: 'שמש של בוקר', artist: 'דני סנדרסון', type: 'song', started_at: hoursFromNow(-0.75), duration_seconds: 234 },
  { _id: 'ph-010', content_id: 'demo-song-003', content_title: 'Dancing Queen', content_type: 'song', played_at: hoursFromNow(-0.9), title: 'Dancing Queen', artist: 'ABBA', type: 'song', started_at: hoursFromNow(-0.9), duration_seconds: 231 },
  { _id: 'ph-011', content_id: 'demo-song-009', content_title: 'תן לי יד', content_type: 'song', played_at: hoursFromNow(-1.05), title: 'תן לי יד', artist: 'שלמה ארצי', type: 'song', started_at: hoursFromNow(-1.05), duration_seconds: 245 },
  { _id: 'ph-012', content_id: 'demo-song-007', content_title: 'שיר לשלום', content_type: 'song', played_at: hoursFromNow(-1.2), title: 'שיר לשלום', artist: 'להקת הנח"ל', type: 'song', started_at: hoursFromNow(-1.2), duration_seconds: 285 },
  { _id: 'ph-013', content_id: 'demo-newsflash-002', content_title: 'עדכון תנועה', content_type: 'newsflash', played_at: hoursFromNow(-1.25), title: 'עדכון תנועה', type: 'newsflash', started_at: hoursFromNow(-1.25), duration_seconds: 60 },
  { _id: 'ph-014', content_id: 'demo-song-006', content_title: 'יום הולדת', content_type: 'song', played_at: hoursFromNow(-1.4), title: 'יום הולדת', artist: 'אריק לביא', type: 'song', started_at: hoursFromNow(-1.4), duration_seconds: 267 },
  { _id: 'ph-015', content_id: 'demo-song-002', content_title: 'לילה טוב', content_type: 'song', played_at: hoursFromNow(-1.55), title: 'לילה טוב', artist: 'עברי לידר', type: 'song', started_at: hoursFromNow(-1.55), duration_seconds: 198 },
  { _id: 'ph-016', content_id: 'demo-song-011', content_title: 'אני והיא', content_type: 'song', played_at: hoursFromNow(-1.7), title: 'אני והיא', artist: 'עברי לידר', type: 'song', started_at: hoursFromNow(-1.7), duration_seconds: 312 },
  { _id: 'ph-017', content_id: 'demo-song-005', content_title: 'Bohemian Rhapsody', content_type: 'song', played_at: hoursFromNow(-1.9), title: 'Bohemian Rhapsody', artist: 'Queen', type: 'song', started_at: hoursFromNow(-1.9), duration_seconds: 354 },
  { _id: 'ph-018', content_id: 'demo-song-008', content_title: 'Hotel California', content_type: 'song', played_at: hoursFromNow(-2.1), title: 'Hotel California', artist: 'Eagles', type: 'song', started_at: hoursFromNow(-2.1), duration_seconds: 391 },
  { _id: 'ph-019', content_id: 'demo-song-012', content_title: 'Imagine', content_type: 'song', played_at: hoursFromNow(-2.25), title: 'Imagine', artist: 'John Lennon', type: 'song', started_at: hoursFromNow(-2.25), duration_seconds: 187 },
  { _id: 'ph-020', content_id: 'demo-song-013', content_title: 'מילים', content_type: 'song', played_at: hoursFromNow(-2.4), title: 'מילים', artist: 'שלומי שבת', type: 'song', started_at: hoursFromNow(-2.4), duration_seconds: 223 },
]

export const DEMO_NOW_PLAYING: Track = DEMO_SONGS[0] // שמש של בוקר

export const DEMO_QUEUE: Track[] = [
  DEMO_SONGS[2], // Dancing Queen
  DEMO_SONGS[3], // הכל עובר חביבי
  DEMO_SONGS[9], // Uptown Funk
  DEMO_SONGS[14], // ירח
]

// =============================================================================
// PENDING UPLOADS (for demo, show empty or minimal)
// =============================================================================

export const DEMO_PENDING_UPLOADS: PendingUpload[] = [
  {
    _id: 'demo-upload-001',
    filename: 'new_summer_hit.mp3',
    metadata: {
      title: 'Summer Hit 2024',
      duration_seconds: 215,
    },
    suggested_type: 'song',
    suggested_genre: 'Pop',
    status: 'pending_review',
    created_at: hoursFromNow(-2),
  },
]

// =============================================================================
// FLOW EXECUTIONS
// =============================================================================

export const DEMO_FLOW_EXECUTIONS: FlowExecution[] = [
  {
    _id: 'demo-exec-001',
    flow_id: 'demo-flow-001',
    started_at: hoursFromNow(-6),
    completed_at: hoursFromNow(-5.5),
    status: 'completed',
    actions_completed: 3,
    total_actions: 3,
  },
  {
    _id: 'demo-exec-002',
    flow_id: 'demo-flow-002',
    started_at: hoursFromNow(-4),
    completed_at: hoursFromNow(-3.9),
    status: 'completed',
    actions_completed: 3,
    total_actions: 3,
  },
  {
    _id: 'demo-exec-003',
    flow_id: 'demo-flow-004',
    started_at: hoursFromNow(-2),
    completed_at: hoursFromNow(-1.8),
    status: 'completed',
    actions_completed: 4,
    total_actions: 4,
  },
]

// =============================================================================
// PLAYBACK STATS
// =============================================================================

export const DEMO_PLAYBACK_STATS = {
  today: {
    songs_played: 127,
    shows_aired: 4,
    commercials_played: 45,
  },
}

// =============================================================================
// ADMIN STATS
// =============================================================================

export const DEMO_STORAGE_STATS = {
  total_files: DEMO_ALL_CONTENT.length,
  total_size_bytes: 2_500_000_000, // ~2.5GB
  by_type: {
    song: { count: DEMO_SONGS.length, size_bytes: 1_800_000_000 },
    show: { count: DEMO_SHOWS.length, size_bytes: 500_000_000 },
    commercial: { count: DEMO_COMMERCIALS.length, size_bytes: 100_000_000 },
    jingle: { count: DEMO_JINGLES.length, size_bytes: 50_000_000 },
    sample: { count: DEMO_SAMPLES.length, size_bytes: 30_000_000 },
    newsflash: { count: DEMO_NEWSFLASHES.length, size_bytes: 20_000_000 },
  },
  cache_size_bytes: 150_000_000,
}

export const DEMO_CONTENT_STATS = {
  total: DEMO_ALL_CONTENT.length,
  by_type: {
    song: DEMO_SONGS.length,
    show: DEMO_SHOWS.length,
    commercial: DEMO_COMMERCIALS.length,
    jingle: DEMO_JINGLES.length,
    sample: DEMO_SAMPLES.length,
    newsflash: DEMO_NEWSFLASHES.length,
  },
  by_genre: DEMO_GENRES.map(genre => ({
    _id: genre,
    count: DEMO_SONGS.filter(s => s.genre === genre).length,
  })),
  total_duration_seconds: DEMO_ALL_CONTENT.reduce((sum, t) => sum + (t.duration_seconds || 0), 0),
  avg_play_count: 12,
}

export const DEMO_SERVER_HEALTH = {
  status: 'healthy' as const,
  uptime_seconds: 86400 * 7, // 7 days
  memory_usage_percent: 45,
  cpu_usage_percent: 12,
}

export const DEMO_USER_STATS = {
  total: DEMO_USERS.length,
  by_role: {
    admin: 1,
    editor: 1,
    viewer: 1,
  },
  active: 3,
  inactive: 0,
}

// =============================================================================
// SETTINGS
// =============================================================================

export const DEMO_SETTINGS = {
  notifications: {
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
  },
  admin_contact: {
    email: 'admin@demo.radio.olorin.ai',
    phone: null,
  },
  vapid_public_key: 'demo-vapid-key',
}

export const DEMO_JINGLE_SETTINGS = {
  use_opening_jingle: true,
  opening_jingle_id: 'demo-jingle-001',
  use_closing_jingle: true,
  closing_jingle_id: 'demo-jingle-002',
}

// =============================================================================
// SYNC STATUS
// =============================================================================

export const DEMO_SYNC_STATUS = {
  is_syncing: false,
  last_sync: hoursFromNow(-1),
  files_synced: DEMO_ALL_CONTENT.length,
  errors: [],
}

export const DEMO_SYNC_PROGRESS = {
  status: 'idle' as const,
  files_processed: DEMO_ALL_CONTENT.length,
  total_files: DEMO_ALL_CONTENT.length,
  errors: [],
}

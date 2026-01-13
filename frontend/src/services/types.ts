/**
 * Service Types - Shared interfaces for production and demo services
 *
 * Both the production API and demo service must implement the RadioService interface.
 * This ensures type safety and prevents mixing of real/demo data.
 */

// =============================================================================
// Content Types
// =============================================================================

export interface Track {
  _id: string
  title: string
  artist?: string
  type: 'song' | 'show' | 'commercial' | 'jingle' | 'sample' | 'newsflash'
  duration_seconds?: number
  genre?: string
  play_count?: number
  created_at?: string
  updated_at?: string
  batch_number?: number // For commercials
  cover_url?: string
}

export interface PendingUpload {
  _id: string
  filename: string
  metadata: {
    title?: string
    artist?: string
    genre?: string
    duration_seconds?: number
  }
  suggested_type: Track['type']
  suggested_genre?: string
  status: string
  created_at: string
}

// =============================================================================
// Playback Types
// =============================================================================

export interface PlaybackStatus {
  is_playing: boolean
  current_track: Track | null
  queue_length: number
  volume: number
  position_seconds?: number
}

export interface PlaybackStats {
  today: {
    songs_played: number
    shows_aired: number
    commercials_played: number
  }
}

export interface PlaybackHistoryItem {
  _id: string
  content_id?: string
  content_title?: string
  content_type?: string
  played_at?: string
  // Alternative field names used by some widgets
  title: string
  artist?: string
  type: string
  started_at: string
  duration_seconds?: number
}

// =============================================================================
// Campaign Types
// =============================================================================

export interface WeeklySlot {
  slot_date: string // YYYY-MM-DD
  slot_index: number // 0-167 (7 days * 24 hours)
  play_count: number
}

export interface ContentRef {
  content_id?: string
  file_local_path?: string
  file_title?: string
  file_duration_seconds?: number
}

export interface Campaign {
  _id: string
  name: string
  name_he?: string
  campaign_type?: string
  comment?: string
  start_date: string
  end_date: string
  status: 'active' | 'paused' | 'deleted' | 'completed'
  priority: number
  content_refs: ContentRef[]
  schedule_grid: WeeklySlot[]
  monthly_budget?: number
  contract_value?: number
  price_per_slot?: number
  created_at: string
  updated_at: string
}

export interface SlotExecutionStatus {
  slot_date: string
  slot_index: number
  scheduled: number
  played: number
  status: 'success' | 'partial' | 'failed' | 'none'
  // Legacy fields for backward compatibility
  executed?: boolean
  execution_time?: string
}

export interface DailySlotCommercial {
  campaign_id: string
  name: string
  priority: number
  play_count: number
}

export interface DailySlot {
  slot_index: number
  time: string
  commercials: DailySlotCommercial[]
}

export interface CampaignDailyPreview {
  slots: DailySlot[]
}

export interface JingleSettings {
  use_opening_jingle: boolean
  opening_jingle_id?: string
  use_closing_jingle: boolean
  closing_jingle_id?: string
}

// =============================================================================
// Flow/Actions Types
// =============================================================================

export type FlowActionType =
  | 'play_genre'
  | 'play_content'
  | 'play_show'
  | 'play_commercials'
  | 'play_jingle'
  | 'play_sample'
  | 'play_newsflash'
  | 'wait'
  | 'set_volume'
  | 'announcement'
  | 'loop_start'
  | 'loop_end'

export interface FlowAction {
  id?: string
  action_type: FlowActionType
  genre?: string
  content_id?: string
  commercial_count?: number
  duration_minutes?: number
  volume_level?: number
  description?: string
  announcement_text?: string
}

export interface Flow {
  _id: string
  name: string
  name_he?: string
  description?: string
  actions: FlowAction[]
  trigger_type?: 'scheduled' | 'manual' | 'event'
  schedule?: {
    days_of_week: number[]
    start_time: string
    end_time?: string
  }
  priority?: number
  loop?: boolean
  status?: 'active' | 'inactive'
  created_at: string
  updated_at: string
  run_count?: number
  last_run?: string
}

export interface FlowExecution {
  _id: string
  flow_id: string
  started_at: string
  completed_at?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  actions_completed: number
  total_actions: number
  error?: string
}

// =============================================================================
// Calendar Types
// =============================================================================

export interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
  htmlLink?: string
  recurrence?: string[]
  extendedProperties?: {
    private?: {
      radio_content_id?: string
      radio_content_type?: string
      radio_managed?: string
    }
  }
}

export interface DaySchedule {
  date: string
  day_name: string
  day_name_he: string
  events: CalendarEvent[]
}

export interface WeekSchedule {
  [date: string]: DaySchedule
}

// =============================================================================
// Agent Types
// =============================================================================

export interface AgentConfig {
  mode: 'full_automation' | 'prompt'
  notification_level?: string
  automation_rules?: {
    commercial_interval_minutes?: number
    max_song_repeat_hours?: number
    auto_categorize_threshold?: number
  }
}

export interface AgentStatus {
  active: boolean
  mode: string
  pending_actions: number
  decisions_today?: number
}

export interface PendingAction {
  _id: string
  action_type: string
  description: string
  expires_at: string
  alternatives?: Array<{
    description: string
    action_data: any
  }>
}

export interface AgentDecision {
  _id: string
  action_type: string
  reasoning: string
  created_at: string
  approved?: boolean
  executed?: boolean
}

export interface ChatMessage {
  _id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface LLMConfig {
  model: string
  has_custom_api_key: boolean
  has_env_api_key: boolean
  api_key_source: 'custom' | 'environment' | 'none'
  available_models: Array<{
    id: string
    name: string
    tier: string
  }>
}

// =============================================================================
// User Types
// =============================================================================

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface User {
  _id: string
  firebase_uid: string
  email: string
  role: UserRole
  display_name: string
  photo_url?: string
  is_active: boolean
  preferences?: {
    language?: string
    theme?: string
    notifications?: {
      email_enabled?: boolean
      push_enabled?: boolean
      sms_enabled?: boolean
    }
  }
  created_at: string
  updated_at: string
  last_login?: string
}

export interface UserStats {
  total: number
  by_role: {
    admin: number
    editor: number
    viewer: number
  }
  active: number
  inactive: number
}

// =============================================================================
// Settings Types
// =============================================================================

export interface Settings {
  notifications: {
    email_enabled: boolean
    push_enabled: boolean
    sms_enabled: boolean
  }
  admin_contact: {
    email: string | null
    phone: string | null
  }
  vapid_public_key: string | null
}

// =============================================================================
// Voice/TTS Types
// =============================================================================

export interface VoicePreset {
  _id: string
  name: string
  display_name: string
  display_name_he?: string
  language: string
  is_default: boolean
  created_at: string
}

export interface TTSStatus {
  available: boolean
  model?: string
  device?: string
  voice_presets_count?: number
  reason?: string
}

// =============================================================================
// Admin Types
// =============================================================================

export interface StorageStats {
  total_files: number
  total_size_bytes: number
  by_type: Record<string, { count: number; size_bytes: number }>
  cache_size_bytes: number
}

export interface QualityIssues {
  missing_metadata?: Array<{ title: string; artist?: string; genre?: string }>
  low_quality?: Array<{ title: string; bitrate: number }>
  short_duration?: Array<{ title: string; duration: number }>
  duplicates?: Array<{ _id: { title: string; artist: string }; count: number }>
}

export interface ContentStats {
  total: number
  by_type: Record<string, number>
  by_genre: Array<{ _id: string; count: number }>
  total_duration_seconds: number
  avg_play_count?: number
}

export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'warning' | 'critical'
  uptime_seconds?: number
  memory_usage_percent?: number
  cpu_usage_percent?: number
  last_error?: string
  uptime?: { hours: number }
  cpu?: { percent: number; count: number }
  memory?: { percent: number; used_gb: number; total_gb: number }
  disk?: { percent: number; used_gb: number; total_gb: number }
  system?: {
    platform: string
    architecture: string
    python_version: string
    hostname: string
    platform_version: string
  }
}

// =============================================================================
// Sync Types
// =============================================================================

export interface SyncStatus {
  is_syncing: boolean
  last_sync?: string
  files_synced?: number
  errors?: string[]
}

export interface SyncProgress {
  status: 'idle' | 'running' | 'completed' | 'failed'
  current_file?: string
  files_processed: number
  total_files: number
  errors: string[]
}

// =============================================================================
// Schedule Types
// =============================================================================

export interface ScheduleSlot {
  _id: string
  start_time: string
  end_time: string
  content_id?: string
  flow_id?: string
  recurrence?: string
}

// =============================================================================
// RadioService Interface - The contract both implementations must follow
// =============================================================================

export interface RadioService {
  // Health
  health(): Promise<{ status: string; mode?: string }>

  // Content - Read
  getContent(type?: string, genre?: string): Promise<Track[]>
  getSongs(genre?: string): Promise<Track[]>
  getShows(): Promise<Track[]>
  getCommercials(): Promise<Track[]>
  getJingles(): Promise<Track[]>
  getSamples(): Promise<Track[]>
  getNewsflashes(): Promise<Track[]>
  getGenres(): Promise<string[]>
  getContentById(id: string): Promise<Track>

  // Content - Write
  updateContent(id: string, data: Partial<Track>): Promise<Track>
  deleteContent(id: string): Promise<void>
  batchDeleteContent(ids: string[]): Promise<{ deleted: number }>

  // Schedule
  getSchedule(): Promise<ScheduleSlot[]>
  getCurrentSlot(): Promise<ScheduleSlot | null>
  getUpcomingSchedule(hours?: number): Promise<ScheduleSlot[]>
  createSlot(data: Partial<ScheduleSlot>): Promise<ScheduleSlot>
  updateSlot(id: string, data: Partial<ScheduleSlot>): Promise<ScheduleSlot>
  deleteSlot(id: string): Promise<void>

  // Playback - Read
  getPlaybackStatus(): Promise<PlaybackStatus>
  getNowPlaying(): Promise<Track | null>
  getQueue(): Promise<Track[]>
  getPlaybackHistory(limit?: number): Promise<PlaybackHistoryItem[]>
  getPlaybackStats(): Promise<PlaybackStats>

  // Playback - Write
  addToQueue(contentId: string, priority?: number): Promise<{ position: number }>
  removeFromQueue(position: number): Promise<void>
  reorderQueue(fromIndex: number, toIndex: number): Promise<void>
  clearQueue(): Promise<void>
  play(contentId?: string): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  skip(): Promise<void>
  getNextTrack(): Promise<Track | null>
  setVolume(level: number): Promise<void>
  logPlayStart(contentId: string): Promise<void>

  // Playback - URLs (these return strings, not promises)
  getStreamUrl(contentId: string): string
  getStreamUrlLegacy?(contentId: string): string
  getSignedStreamUrl?(contentId: string): Promise<string>
  getCoverUrl(contentId: string): string

  // Emergency
  getEmergencyPlaylist(): Promise<Track[]>
  generateEmergencyPlaylist(count?: number): Promise<Track[]>
  getEmergencyStreamUrl(relativeUrl: string): string
  reportEmergencyMode(): Promise<void>

  // Upload
  uploadFile(file: File, data?: Record<string, string | boolean>): Promise<Track>
  getPendingUploads(): Promise<PendingUpload[]>
  confirmUpload(id: string, data: { content_type: string; genre?: string; title?: string; artist?: string }): Promise<Track>
  cancelPendingUpload(id: string): Promise<void>

  // Agent
  getAgentConfig(): Promise<AgentConfig>
  updateAgentConfig(config: Partial<AgentConfig>): Promise<AgentConfig>
  setAgentMode(mode: 'full_automation' | 'prompt'): Promise<AgentConfig>
  getAgentStatus(): Promise<AgentStatus>
  getPendingActions(): Promise<PendingAction[]>
  approveAction(id: string, useAlternative?: number): Promise<void>
  rejectAction(id: string, reason?: string): Promise<void>
  getDecisions(limit?: number): Promise<AgentDecision[]>

  // Chat
  sendChatMessage(message: string): Promise<ChatMessage>
  getChatHistory(limit?: number): Promise<ChatMessage[]>
  clearChatHistory(): Promise<void>

  // LLM Config
  getLLMConfig(): Promise<LLMConfig>
  updateLLMConfig(config: { model?: string; api_key?: string }): Promise<LLMConfig>
  clearCustomApiKey(): Promise<void>

  // Calendar
  getCalendarEvents(days?: number, contentType?: string): Promise<CalendarEvent[]>
  getTodaySchedule(): Promise<DaySchedule>
  getDaySchedule(date: string): Promise<DaySchedule>
  getWeekSchedule(startDate?: string): Promise<WeekSchedule>
  getCalendarEvent(eventId: string): Promise<CalendarEvent>
  createCalendarEvent(data: {
    content_id: string
    start_time: string
    end_time?: string
    description?: string
    recurrence?: string
    recurrence_count?: number
    recurrence_days?: string[]
    recurrence_interval?: number
    reminder_minutes?: number
    reminder_method?: string
    all_day?: boolean
  }): Promise<CalendarEvent>
  updateCalendarEvent(eventId: string, data: {
    summary?: string
    description?: string
    start_time?: string
    end_time?: string
    all_day?: boolean
  }): Promise<CalendarEvent>
  deleteCalendarEvent(eventId: string): Promise<void>

  // Flows
  getFlows(status?: string): Promise<Flow[]>
  getActiveFlows(): Promise<Flow[]>
  getFlow(flowId: string): Promise<Flow>
  createFlow(data: {
    name: string
    name_he?: string
    description?: string
    actions: FlowAction[]
    trigger_type?: 'scheduled' | 'manual' | 'event'
    schedule?: {
      days_of_week: number[]
      start_time: string
      end_time?: string
    }
    priority?: number
    loop?: boolean
  }): Promise<Flow>
  updateFlow(flowId: string, data: Partial<Flow>): Promise<Flow>
  deleteFlow(flowId: string): Promise<void>
  toggleFlow(flowId: string): Promise<Flow>
  runFlow(flowId: string): Promise<{ message: string }>
  resetFlow(flowId: string): Promise<Flow>
  resyncFlowsCalendar(): Promise<{ synced: number }>
  getFlowExecutions(flowId: string, limit?: number): Promise<FlowExecution[]>
  parseNaturalFlow(text: string): Promise<{ actions: FlowAction[] }>

  // Settings
  getSettings(): Promise<Settings>
  updateSettings(data: {
    notifications?: {
      email_enabled: boolean
      push_enabled: boolean
      sms_enabled: boolean
    }
    admin_contact?: {
      email: string | null
      phone: string | null
    }
  }): Promise<Settings>
  testNotification(channel: 'email' | 'push' | 'sms'): Promise<{ success: boolean }>
  subscribeToPush(subscription: PushSubscriptionJSON): Promise<void>
  unsubscribeFromPush(endpoint: string): Promise<void>

  // Users - Current User
  getCurrentUser(): Promise<User>
  updateCurrentUser(data: { display_name?: string; photo_url?: string }): Promise<User>
  updateUserPreferences(preferences: {
    language?: string
    theme?: string
    notifications?: { email_enabled?: boolean; push_enabled?: boolean; sms_enabled?: boolean }
  }): Promise<User>

  // Users - Admin Management
  listUsers(params?: { skip?: number; limit?: number; role?: string; include_inactive?: boolean }): Promise<{ users: User[]; total?: number }>
  getUserStats(): Promise<UserStats>
  createUser(data: { email: string; role: UserRole; display_name?: string }): Promise<User>
  getUser(firebaseUid: string): Promise<User>
  updateUser(firebaseUid: string, data: { display_name?: string; photo_url?: string }): Promise<User>
  setUserRole(firebaseUid: string, role: UserRole): Promise<User>
  deactivateUser(firebaseUid: string): Promise<void>
  reactivateUser(firebaseUid: string): Promise<void>

  // Campaigns
  getCampaigns(status?: string): Promise<Campaign[]>
  getCampaign(campaignId: string): Promise<Campaign>
  createCampaign(data: {
    name: string
    name_he?: string
    campaign_type?: string
    comment?: string
    start_date: string
    end_date: string
    priority?: number
    content_refs?: ContentRef[]
    schedule_grid?: WeeklySlot[]
  }): Promise<Campaign>
  updateCampaign(campaignId: string, data: Partial<Campaign>): Promise<Campaign>
  deleteCampaign(campaignId: string, hardDelete?: boolean): Promise<void>
  toggleCampaignStatus(campaignId: string): Promise<Campaign>
  updateCampaignGrid(campaignId: string, grid: WeeklySlot[]): Promise<Campaign>
  updateCampaignSlot(campaignId: string, slotDate: string, slotIndex: number, playCount: number): Promise<Campaign>
  addCampaignContent(campaignId: string, contentRef: ContentRef): Promise<Campaign>
  removeCampaignContent(campaignId: string, contentIndex: number): Promise<Campaign>
  getCampaignDailyPreview(date?: string): Promise<CampaignDailyPreview>
  syncCampaignToCalendar(campaignId: string): Promise<void>
  syncAllCampaignsToCalendar(): Promise<{ synced: number }>
  getCampaignStats(campaignId: string): Promise<any>
  runSlotNow(
    slotDate: string,
    slotIndex: number,
    useOpeningJingle?: boolean,
    openingJingleId?: string,
    useClosingJingle?: boolean,
    closingJingleId?: string
  ): Promise<{ success: boolean; queued: number }>
  cloneCampaign(campaignId: string): Promise<Campaign>
  getSlotExecutionStatus(startDate: string, endDate: string): Promise<{ slots: SlotExecutionStatus[] }>

  // Jingle Settings
  getJingleSettings(): Promise<JingleSettings>
  saveJingleSettings(
    useOpeningJingle: boolean,
    openingJingleId?: string,
    useClosingJingle?: boolean,
    closingJingleId?: string
  ): Promise<JingleSettings>

  // Admin - System Configuration
  getAdminEnvConfig(): Promise<Record<string, string>>
  updateAdminEnvConfig(updates: Record<string, string>): Promise<void>
  getAdminSensitiveKeys(): Promise<string[]>

  // Admin - Storage Management (return any for flexibility with component local types)
  getAdminStorageStats(): Promise<any>
  clearAdminCache(keepRecentDays?: number): Promise<{ files_deleted: number; bytes_freed: number }>
  getAdminOrphanedFiles(): Promise<any>

  // Admin - Content Quality & Statistics (return any for flexibility)
  getAdminQualityIssues(): Promise<any>
  getAdminContentStats(): Promise<any>

  // Admin - Batch Operations
  adminBatchDeleteContent(contentIds: string[]): Promise<{ deleted: number }>
  adminBatchUpdateMetadata(contentIds: string[], updates: Partial<Track>): Promise<{ updated: number }>
  adminBatchReassignGenre(contentIds: string[], newGenre: string): Promise<{ updated: number }>

  // Admin - Server Health & Management (return any for flexibility)
  getServerHealth(): Promise<any>
  restartServer(): Promise<void>
  clearCache(keepRecentDays?: number, includeLogs?: boolean): Promise<any>

  // Voice/TTS (Admin only)
  getTTSStatus?(): Promise<TTSStatus>
  getVoicePresets?(): Promise<VoicePreset[]>
  createVoicePreset?(data: { name: string; display_name: string; reference_audio: File }): Promise<VoicePreset>
  deleteVoicePreset?(id: string): Promise<void>
  setDefaultVoice?(id: string): Promise<VoicePreset>
  generateVoicePreview?(text: string, voiceId?: string): Promise<Blob>
}

/**
 * Demo Service - Mock implementation of RadioService for demo mode
 *
 * IMPORTANT: In demo mode, this service is the ONLY data source.
 * No real API calls are made. All data comes from mockData.ts.
 */

import type {
  RadioService,
  Track,
  Campaign,
  Flow,
  CalendarEvent,
  PlaybackStatus,
  PlaybackStats,
  AgentConfig,
  AgentStatus,
  PendingAction,
  ChatMessage,
  LLMConfig,
  User,
  UserStats,
  Settings,
  VoicePreset,
  TTSStatus,
  SyncStatus,
  ScheduleSlot,
  FlowAction,
  WeeklySlot,
  ContentRef,
  JingleSettings,
  StorageStats,
  ContentStats,
  ServerHealth,
  SlotExecutionStatus,
} from '../types'

import {
  DEMO_SONGS,
  DEMO_SHOWS,
  DEMO_COMMERCIALS,
  DEMO_JINGLES,
  DEMO_SAMPLES,
  DEMO_NEWSFLASHES,
  DEMO_ALL_CONTENT,
  DEMO_GENRES,
  DEMO_CAMPAIGNS,
  DEMO_FLOWS,
  DEMO_CALENDAR_EVENTS,
  generateDemoWeekSchedule,
  DEMO_AGENT_DECISIONS,
  DEMO_PENDING_ACTIONS,
  DEMO_CHAT_HISTORY,
  DEMO_USERS,
  DEMO_CURRENT_USER,
  DEMO_VOICE_PRESETS,
  DEMO_PLAYBACK_HISTORY,
  DEMO_NOW_PLAYING,
  DEMO_QUEUE,
  DEMO_PENDING_UPLOADS,
  DEMO_FLOW_EXECUTIONS,
  DEMO_PLAYBACK_STATS,
  DEMO_STORAGE_STATS,
  DEMO_CONTENT_STATS,
  DEMO_SERVER_HEALTH,
  DEMO_USER_STATS,
  DEMO_SETTINGS,
  DEMO_JINGLE_SETTINGS,
  DEMO_SYNC_STATUS,
  DEMO_SYNC_PROGRESS,
} from './mockData'

// =============================================================================
// Helper Functions
// =============================================================================

/** Simulate network delay for realistic UX */
const delay = (ms: number = 150) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Generate a random demo ID */
const generateId = () => `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// =============================================================================
// Local Demo State (persisted in memory for session)
// =============================================================================

interface DemoState {
  queue: Track[]
  currentTrack: Track | null
  isPlaying: boolean
  volume: number
  campaigns: Campaign[]
  flows: Flow[]
  chatHistory: ChatMessage[]
  agentMode: 'full_automation' | 'prompt'
  pendingActions: PendingAction[]
}

let demoState: DemoState = {
  queue: [...DEMO_QUEUE],
  currentTrack: DEMO_NOW_PLAYING,
  isPlaying: true,
  volume: 85,
  campaigns: [...DEMO_CAMPAIGNS],
  flows: [...DEMO_FLOWS],
  chatHistory: [...DEMO_CHAT_HISTORY],
  agentMode: 'full_automation',
  pendingActions: [...DEMO_PENDING_ACTIONS],
}

// =============================================================================
// Demo Service Implementation
// =============================================================================

export const demoService: RadioService = {
  // ===========================================================================
  // Health
  // ===========================================================================

  async health() {
    await delay(50)
    return { status: 'healthy', mode: 'demo' }
  },

  // ===========================================================================
  // Content - Read
  // ===========================================================================

  async getContent(type?: string, genre?: string) {
    await delay()
    let result = [...DEMO_ALL_CONTENT]
    if (type) result = result.filter(t => t.type === type)
    if (genre) result = result.filter(t => t.genre === genre)
    return result
  },

  async getSongs(genre?: string) {
    await delay()
    if (genre) return DEMO_SONGS.filter(s => s.genre === genre)
    return [...DEMO_SONGS]
  },

  async getShows() {
    await delay()
    return [...DEMO_SHOWS]
  },

  async getCommercials() {
    await delay()
    return [...DEMO_COMMERCIALS]
  },

  async getJingles() {
    await delay()
    return [...DEMO_JINGLES]
  },

  async getSamples() {
    await delay()
    return [...DEMO_SAMPLES]
  },

  async getNewsflashes() {
    await delay()
    return [...DEMO_NEWSFLASHES]
  },

  async getGenres() {
    await delay()
    return [...DEMO_GENRES]
  },

  async getContentById(id: string) {
    await delay()
    const content = DEMO_ALL_CONTENT.find(c => c._id === id)
    if (!content) throw new Error(`Content not found: ${id}`)
    return content
  },

  // ===========================================================================
  // Content - Write (simulated, updates local state)
  // ===========================================================================

  async updateContent(contentId: string, data: Partial<Track>) {
    await delay(200)
    const content = DEMO_ALL_CONTENT.find(c => c._id === contentId)
    if (!content) throw new Error(`Content not found: ${contentId}`)
    // Return merged data (doesn't persist across page loads)
    return { ...content, ...data, updated_at: new Date().toISOString() }
  },

  async deleteContent(_id: string) {
    await delay(200)
    // Simulated - doesn't actually delete
  },

  async batchDeleteContent(ids: string[]) {
    await delay(300)
    return { deleted: ids.length }
  },

  // ===========================================================================
  // Sync (simulated)
  // ===========================================================================

  async getSyncStatus() {
    await delay()
    return DEMO_SYNC_STATUS as SyncStatus
  },

  async startSync(_downloadFiles?: boolean) {
    await delay(300)
    return { message: 'Demo mode - sync simulated' }
  },

  async refreshMetadata() {
    await delay(500)
    return { updated: DEMO_ALL_CONTENT.length }
  },

  async getSyncSchedulerStatus() {
    await delay()
    return DEMO_SYNC_PROGRESS
  },

  async getSyncProgress() {
    await delay()
    return DEMO_SYNC_PROGRESS
  },

  async triggerGcsSync() {
    await delay(200)
    return { message: 'Demo mode - GCS sync simulated' }
  },

  // ===========================================================================
  // Schedule
  // ===========================================================================

  async getSchedule() {
    await delay()
    return [] // Simplified - calendar events handle scheduling
  },

  async getCurrentSlot() {
    await delay()
    return null
  },

  async getUpcomingSchedule(_hours?: number) {
    await delay()
    return []
  },

  async createSlot(data: Partial<ScheduleSlot>) {
    await delay(200)
    return { _id: generateId(), ...data } as ScheduleSlot
  },

  async updateSlot(id: string, data: Partial<ScheduleSlot>) {
    await delay(200)
    return { _id: id, ...data } as ScheduleSlot
  },

  async deleteSlot(_id: string) {
    await delay(200)
  },

  // ===========================================================================
  // Playback - Read
  // ===========================================================================

  async getPlaybackStatus() {
    await delay()
    return {
      is_playing: demoState.isPlaying,
      current_track: demoState.currentTrack,
      queue_length: demoState.queue.length,
      volume: demoState.volume,
      position_seconds: 45,
    } as PlaybackStatus
  },

  async getNowPlaying() {
    await delay()
    return demoState.currentTrack
  },

  async getQueue() {
    await delay()
    return [...demoState.queue]
  },

  async getPlaybackHistory(limit: number = 20) {
    await delay()
    return DEMO_PLAYBACK_HISTORY.slice(0, limit)
  },

  async getPlaybackStats() {
    await delay()
    return DEMO_PLAYBACK_STATS as PlaybackStats
  },

  // ===========================================================================
  // Playback - Write (updates local demo state)
  // ===========================================================================

  async addToQueue(contentId: string, _priority?: number) {
    await delay(100)
    const track = DEMO_ALL_CONTENT.find(c => c._id === contentId)
    if (track) {
      demoState.queue.push(track)
    }
    return { position: demoState.queue.length }
  },

  async removeFromQueue(position: number) {
    await delay(100)
    demoState.queue.splice(position, 1)
  },

  async reorderQueue(fromIndex: number, toIndex: number) {
    await delay(100)
    const [item] = demoState.queue.splice(fromIndex, 1)
    demoState.queue.splice(toIndex, 0, item)
  },

  async clearQueue() {
    await delay(100)
    demoState.queue = []
  },

  async play(contentId?: string) {
    await delay(100)
    if (contentId) {
      const track = DEMO_ALL_CONTENT.find(c => c._id === contentId)
      if (track) demoState.currentTrack = track
    }
    demoState.isPlaying = true
  },

  async pause() {
    await delay(50)
    demoState.isPlaying = false
  },

  async stop() {
    await delay(50)
    demoState.isPlaying = false
    demoState.currentTrack = null
  },

  async skip() {
    await delay(100)
    if (demoState.queue.length > 0) {
      demoState.currentTrack = demoState.queue.shift()!
    }
  },

  async getNextTrack() {
    await delay(100)
    if (demoState.queue.length > 0) {
      const next = demoState.queue.shift()!
      demoState.currentTrack = next
      return next
    }
    return null
  },

  async setVolume(level: number) {
    await delay(50)
    demoState.volume = level
  },

  async logPlayStart(_contentId: string) {
    await delay(50)
  },

  // ===========================================================================
  // Playback - URLs
  // ===========================================================================

  getStreamUrl(_contentId: string) {
    // Return a silent audio file or demo audio URL
    return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
  },

  getCoverUrl(_contentId: string) {
    // Return a placeholder image
    return 'https://placehold.co/300x300/1a1a2e/ffffff?text=Demo'
  },

  // ===========================================================================
  // Emergency
  // ===========================================================================

  async getEmergencyPlaylist() {
    await delay()
    return DEMO_SONGS.slice(0, 10)
  },

  async generateEmergencyPlaylist(count: number = 20) {
    await delay(300)
    return DEMO_SONGS.slice(0, count)
  },

  getEmergencyStreamUrl(_relativeUrl: string) {
    return this.getStreamUrl('')
  },

  async reportEmergencyMode() {
    await delay(100)
  },

  // ===========================================================================
  // Upload (simulated)
  // ===========================================================================

  async uploadFile(_file: File, _data?: Record<string, string>) {
    await delay(500)
    return {
      _id: generateId(),
      title: 'Demo Upload',
      type: 'song' as const,
      created_at: new Date().toISOString(),
    } as Track
  },

  async getPendingUploads() {
    await delay()
    return [...DEMO_PENDING_UPLOADS]
  },

  async confirmUpload(id: string, data: { content_type: string; genre?: string; title?: string; artist?: string }) {
    await delay(200)
    return {
      _id: id,
      title: data.title || 'Confirmed Upload',
      artist: data.artist,
      type: data.content_type as Track['type'],
      genre: data.genre,
      created_at: new Date().toISOString(),
    } as Track
  },

  async cancelPendingUpload(_id: string) {
    await delay(100)
  },

  // ===========================================================================
  // Agent
  // ===========================================================================

  async getAgentConfig() {
    await delay()
    return { mode: demoState.agentMode } as AgentConfig
  },

  async updateAgentConfig(config: Partial<AgentConfig>) {
    await delay(100)
    if (config.mode) demoState.agentMode = config.mode
    return { mode: demoState.agentMode } as AgentConfig
  },

  async setAgentMode(mode: 'full_automation' | 'prompt') {
    await delay(100)
    demoState.agentMode = mode
    return { mode } as AgentConfig
  },

  async getAgentStatus() {
    await delay()
    return {
      active: true,
      mode: demoState.agentMode,
      pending_actions: demoState.pendingActions.length,
      decisions_today: 15,
    } as AgentStatus
  },

  async getPendingActions() {
    await delay()
    return [...demoState.pendingActions]
  },

  async approveAction(id: string, _useAlternative?: number) {
    await delay(200)
    demoState.pendingActions = demoState.pendingActions.filter(a => a._id !== id)
  },

  async rejectAction(id: string, _reason?: string) {
    await delay(200)
    demoState.pendingActions = demoState.pendingActions.filter(a => a._id !== id)
  },

  async getDecisions(limit: number = 20) {
    await delay()
    return DEMO_AGENT_DECISIONS.slice(0, limit)
  },

  // ===========================================================================
  // Chat
  // ===========================================================================

  async sendChatMessage(message: string) {
    await delay(500)
    const userMsg: ChatMessage = {
      _id: generateId(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    demoState.chatHistory.push(userMsg)

    const assistantMsg: ChatMessage = {
      _id: generateId(),
      role: 'assistant',
      content: 'This is a demo response. In production, the AI agent would respond to your message.',
      created_at: new Date().toISOString(),
    }
    demoState.chatHistory.push(assistantMsg)

    return assistantMsg
  },

  async getChatHistory(limit: number = 50) {
    await delay()
    return demoState.chatHistory.slice(-limit)
  },

  async clearChatHistory() {
    await delay(100)
    demoState.chatHistory = []
  },

  // ===========================================================================
  // LLM Config
  // ===========================================================================

  async getLLMConfig() {
    await delay()
    return { model: 'claude-3-sonnet', has_custom_api_key: false } as LLMConfig
  },

  async updateLLMConfig(config: { model?: string; api_key?: string }) {
    await delay(200)
    return { model: config.model || 'claude-3-sonnet', has_custom_api_key: !!config.api_key } as LLMConfig
  },

  async clearCustomApiKey() {
    await delay(100)
  },

  // ===========================================================================
  // Calendar
  // ===========================================================================

  async getCalendarEvents(_days?: number, contentType?: string) {
    await delay()
    let events = [...DEMO_CALENDAR_EVENTS]
    if (contentType) {
      events = events.filter(e =>
        e.extendedProperties?.private?.radio_content_type === contentType
      )
    }
    return events
  },

  async getTodaySchedule() {
    await delay()
    const today = new Date().toISOString().split('T')[0]
    const weekSchedule = generateDemoWeekSchedule()
    return weekSchedule[today] || {
      date: today,
      day_name: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      day_name_he: new Date().toLocaleDateString('he-IL', { weekday: 'long' }),
      events: [],
    }
  },

  async getDaySchedule(date: string) {
    await delay()
    const weekSchedule = generateDemoWeekSchedule(date)
    return weekSchedule[date] || {
      date,
      day_name: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
      day_name_he: new Date(date).toLocaleDateString('he-IL', { weekday: 'long' }),
      events: [],
    }
  },

  async getWeekSchedule(startDate?: string) {
    await delay()
    return generateDemoWeekSchedule(startDate)
  },

  async getCalendarEvent(eventId: string) {
    await delay()
    const event = DEMO_CALENDAR_EVENTS.find(e => e.id === eventId)
    if (!event) throw new Error(`Event not found: ${eventId}`)
    return event
  },

  async createCalendarEvent(data: {
    content_id: string
    start_time: string
    end_time?: string
    description?: string
  }) {
    await delay(200)
    const content = DEMO_ALL_CONTENT.find(c => c._id === data.content_id)
    return {
      id: generateId(),
      summary: content?.title || 'New Event',
      start: { dateTime: data.start_time },
      end: { dateTime: data.end_time || data.start_time },
      description: data.description,
      extendedProperties: {
        private: {
          radio_content_id: data.content_id,
          radio_content_type: content?.type,
          radio_managed: 'true',
        },
      },
    } as CalendarEvent
  },

  async updateCalendarEvent(eventId: string, data: any) {
    await delay(200)
    const event = DEMO_CALENDAR_EVENTS.find(e => e.id === eventId)
    if (!event) throw new Error(`Event not found: ${eventId}`)
    return { ...event, ...data }
  },

  async deleteCalendarEvent(_eventId: string) {
    await delay(200)
  },

  // ===========================================================================
  // Flows
  // ===========================================================================

  async getFlows(status?: string) {
    await delay()
    if (status) {
      return demoState.flows.filter(f => f.status === status)
    }
    return [...demoState.flows]
  },

  async getActiveFlows() {
    await delay()
    return demoState.flows.filter(f => f.status === 'active')
  },

  async getFlow(flowId: string) {
    await delay()
    const flow = demoState.flows.find(f => f._id === flowId)
    if (!flow) throw new Error(`Flow not found: ${flowId}`)
    return flow
  },

  async createFlow(data: {
    name: string
    name_he?: string
    description?: string
    actions: FlowAction[]
    trigger_type?: 'scheduled' | 'manual' | 'event'
    schedule?: { days_of_week: number[]; start_time: string; end_time?: string }
    priority?: number
    loop?: boolean
  }) {
    await delay(300)
    const newFlow: Flow = {
      _id: generateId(),
      ...data,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    demoState.flows.push(newFlow)
    return newFlow
  },

  async updateFlow(flowId: string, data: Partial<Flow>) {
    await delay(200)
    const index = demoState.flows.findIndex(f => f._id === flowId)
    if (index === -1) throw new Error(`Flow not found: ${flowId}`)
    demoState.flows[index] = {
      ...demoState.flows[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    return demoState.flows[index]
  },

  async deleteFlow(flowId: string) {
    await delay(200)
    demoState.flows = demoState.flows.filter(f => f._id !== flowId)
  },

  async toggleFlow(flowId: string) {
    await delay(100)
    const flow = demoState.flows.find(f => f._id === flowId)
    if (!flow) throw new Error(`Flow not found: ${flowId}`)
    flow.status = flow.status === 'active' ? 'inactive' : 'active'
    return flow
  },

  async runFlow(_flowId: string) {
    await delay(300)
    return { message: 'Demo mode - flow execution simulated' }
  },

  async resetFlow(flowId: string) {
    await delay(200)
    const flow = demoState.flows.find(f => f._id === flowId)
    if (!flow) throw new Error(`Flow not found: ${flowId}`)
    return flow
  },

  async resyncFlowsCalendar() {
    await delay(300)
    return { synced: demoState.flows.length }
  },

  async getFlowExecutions(_flowId: string, limit: number = 10) {
    await delay()
    return DEMO_FLOW_EXECUTIONS.slice(0, limit)
  },

  async parseNaturalFlow(text: string) {
    await delay(500)
    // Simulated parsing - return a simple flow
    return {
      actions: [
        { id: '1', action_type: 'play_genre' as const, genre: 'Israeli Pop', duration_minutes: 30, description: `Parsed from: ${text.slice(0, 30)}...` },
      ] as FlowAction[]
    }
  },

  // ===========================================================================
  // Settings
  // ===========================================================================

  async getSettings() {
    await delay()
    return DEMO_SETTINGS as Settings
  },

  async updateSettings(data: any) {
    await delay(200)
    return { ...DEMO_SETTINGS, ...data } as Settings
  },

  async testNotification(_channel: 'email' | 'push' | 'sms') {
    await delay(300)
    return { success: true }
  },

  async subscribeToPush(_subscription: PushSubscriptionJSON) {
    await delay(200)
  },

  async unsubscribeFromPush(_endpoint: string) {
    await delay(200)
  },

  // ===========================================================================
  // Users
  // ===========================================================================

  async getCurrentUser() {
    await delay()
    return DEMO_CURRENT_USER
  },

  async updateCurrentUser(data: { display_name?: string; photo_url?: string }) {
    await delay(200)
    return { ...DEMO_CURRENT_USER, ...data }
  },

  async updateUserPreferences(preferences: any) {
    await delay(200)
    return {
      ...DEMO_CURRENT_USER,
      preferences: { ...DEMO_CURRENT_USER.preferences, ...preferences },
    }
  },

  async listUsers(params?: { skip?: number; limit?: number; role?: string; include_inactive?: boolean }) {
    await delay()
    let users = [...DEMO_USERS]
    if (params?.role) {
      users = users.filter(u => u.role === params.role)
    }
    const total = users.length
    if (params?.skip) {
      users = users.slice(params.skip)
    }
    if (params?.limit) {
      users = users.slice(0, params.limit)
    }
    return { users, total }
  },

  async getUserStats() {
    await delay()
    return DEMO_USER_STATS as UserStats
  },

  async createUser(data: { email: string; role: any; display_name?: string }) {
    await delay(300)
    return {
      _id: generateId(),
      firebase_uid: generateId(),
      email: data.email,
      role: data.role,
      display_name: data.display_name,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as User
  },

  async getUser(firebaseUid: string) {
    await delay()
    const user = DEMO_USERS.find(u => u.firebase_uid === firebaseUid)
    if (!user) throw new Error(`User not found: ${firebaseUid}`)
    return user
  },

  async updateUser(firebaseUid: string, data: { display_name?: string; photo_url?: string }) {
    await delay(200)
    const user = DEMO_USERS.find(u => u.firebase_uid === firebaseUid)
    if (!user) throw new Error(`User not found: ${firebaseUid}`)
    return { ...user, ...data }
  },

  async setUserRole(firebaseUid: string, role: any) {
    await delay(200)
    const user = DEMO_USERS.find(u => u.firebase_uid === firebaseUid)
    if (!user) throw new Error(`User not found: ${firebaseUid}`)
    return { ...user, role }
  },

  async deactivateUser(_firebaseUid: string) {
    await delay(200)
  },

  async reactivateUser(_firebaseUid: string) {
    await delay(200)
  },

  // ===========================================================================
  // Campaigns
  // ===========================================================================

  async getCampaigns(status?: string) {
    await delay()
    if (status) {
      return demoState.campaigns.filter(c => c.status === status)
    }
    return [...demoState.campaigns]
  },

  async getCampaign(campaignId: string) {
    await delay()
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
    return campaign
  },

  async createCampaign(data: {
    name: string
    name_he?: string
    campaign_type?: string
    comment?: string
    start_date: string
    end_date: string
    priority?: number
    content_refs?: ContentRef[]
    schedule_grid?: WeeklySlot[]
  }) {
    await delay(300)
    const newCampaign: Campaign = {
      _id: generateId(),
      ...data,
      status: 'active',
      priority: data.priority || 5,
      content_refs: data.content_refs || [],
      schedule_grid: data.schedule_grid || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    demoState.campaigns.push(newCampaign)
    return newCampaign
  },

  async updateCampaign(campaignId: string, data: Partial<Campaign>) {
    await delay(200)
    const index = demoState.campaigns.findIndex(c => c._id === campaignId)
    if (index === -1) throw new Error(`Campaign not found: ${campaignId}`)
    demoState.campaigns[index] = {
      ...demoState.campaigns[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    return demoState.campaigns[index]
  },

  async deleteCampaign(campaignId: string, _hardDelete?: boolean) {
    await delay(200)
    demoState.campaigns = demoState.campaigns.filter(c => c._id !== campaignId)
  },

  async toggleCampaignStatus(campaignId: string) {
    await delay(100)
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
    campaign.status = campaign.status === 'active' ? 'paused' : 'active'
    return campaign
  },

  async updateCampaignGrid(campaignId: string, grid: WeeklySlot[]) {
    await delay(200)
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
    campaign.schedule_grid = grid
    campaign.updated_at = new Date().toISOString()
    return campaign
  },

  async updateCampaignSlot(campaignId: string, slotDate: string, slotIndex: number, playCount: number) {
    await delay(100)
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)

    const existingSlot = campaign.schedule_grid.find(
      s => s.slot_date === slotDate && s.slot_index === slotIndex
    )
    if (existingSlot) {
      existingSlot.play_count = playCount
    } else {
      campaign.schedule_grid.push({ slot_date: slotDate, slot_index: slotIndex, play_count: playCount })
    }
    return campaign
  },

  async addCampaignContent(campaignId: string, contentRef: ContentRef) {
    await delay(100)
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
    campaign.content_refs.push(contentRef)
    return campaign
  },

  async removeCampaignContent(campaignId: string, contentIndex: number) {
    await delay(100)
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)
    campaign.content_refs.splice(contentIndex, 1)
    return campaign
  },

  async getCampaignDailyPreview(_date?: string) {
    await delay()
    return {
      date: _date || new Date().toISOString().split('T')[0],
      slots: [],
    }
  },

  async syncCampaignToCalendar(_campaignId: string) {
    await delay(300)
  },

  async syncAllCampaignsToCalendar() {
    await delay(500)
    return { synced: demoState.campaigns.length }
  },

  async getCampaignStats(_campaignId: string) {
    await delay()
    return {
      total_plays: 150,
      plays_today: 12,
      completion_rate: 0.85,
    }
  },

  async runSlotNow(
    _slotDate: string,
    _slotIndex: number,
    _useOpeningJingle?: boolean,
    _openingJingleId?: string,
    _useClosingJingle?: boolean,
    _closingJingleId?: string
  ) {
    await delay(300)
    return { success: true, queued: 3 }
  },

  async cloneCampaign(campaignId: string) {
    await delay(300)
    const campaign = demoState.campaigns.find(c => c._id === campaignId)
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)

    const cloned: Campaign = {
      ...campaign,
      _id: generateId(),
      name: `${campaign.name} (Copy)`,
      name_he: campaign.name_he ? `${campaign.name_he} (העתק)` : undefined,
      status: 'paused',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    demoState.campaigns.push(cloned)
    return cloned
  },

  async getSlotExecutionStatus(_startDate: string, _endDate: string) {
    await delay()
    return { slots: [] as SlotExecutionStatus[] }
  },

  // ===========================================================================
  // Jingle Settings
  // ===========================================================================

  async getJingleSettings() {
    await delay()
    return DEMO_JINGLE_SETTINGS as JingleSettings
  },

  async saveJingleSettings(
    useOpeningJingle: boolean,
    openingJingleId?: string,
    useClosingJingle?: boolean,
    closingJingleId?: string
  ) {
    await delay(200)
    return {
      use_opening_jingle: useOpeningJingle,
      opening_jingle_id: openingJingleId,
      use_closing_jingle: useClosingJingle || false,
      closing_jingle_id: closingJingleId,
    } as JingleSettings
  },

  // ===========================================================================
  // Admin
  // ===========================================================================

  async getAdminEnvConfig() {
    await delay()
    return {
      ENVIRONMENT: 'demo',
      LOG_LEVEL: 'info',
      GOOGLE_CLOUD_PROJECT: 'demo-project',
    }
  },

  async updateAdminEnvConfig(_updates: Record<string, string>) {
    await delay(200)
  },

  async getAdminSensitiveKeys() {
    await delay()
    return ['API_KEY', 'DATABASE_URL', 'SECRET_KEY']
  },

  async getAdminStorageStats() {
    await delay()
    return DEMO_STORAGE_STATS as StorageStats
  },

  async clearAdminCache(_keepRecentDays?: number) {
    await delay(300)
    return { files_deleted: 150, bytes_freed: 1024 * 1024 * 50 } // 50MB freed
  },

  async getAdminOrphanedFiles() {
    await delay()
    return []
  },

  async getAdminQualityIssues() {
    await delay()
    return []
  },

  async getAdminContentStats() {
    await delay()
    return DEMO_CONTENT_STATS as ContentStats
  },

  async adminBatchDeleteContent(contentIds: string[]) {
    await delay(300)
    return { deleted: contentIds.length }
  },

  async adminBatchUpdateMetadata(contentIds: string[], _updates: Partial<Track>) {
    await delay(300)
    return { updated: contentIds.length }
  },

  async adminBatchReassignGenre(contentIds: string[], _newGenre: string) {
    await delay(300)
    return { updated: contentIds.length }
  },

  async getServerHealth() {
    await delay()
    return DEMO_SERVER_HEALTH as ServerHealth
  },

  async restartServer() {
    await delay(500)
  },

  async clearCache(_keepRecentDays?: number, _includeLogs?: boolean) {
    await delay(300)
    return { cleared: 100 }
  },

  // ===========================================================================
  // Voice/TTS (Optional methods)
  // ===========================================================================

  async getTTSStatus() {
    await delay()
    return {
      available: true,
      model: 'demo-tts',
      device: 'cpu',
      voice_presets_count: DEMO_VOICE_PRESETS.length,
    } as TTSStatus
  },

  async getVoicePresets() {
    await delay()
    return [...DEMO_VOICE_PRESETS]
  },

  async createVoicePreset(data: { name: string; display_name: string; reference_audio: File }) {
    await delay(500)
    return {
      _id: generateId(),
      name: data.name,
      display_name: data.display_name,
      language: 'he-IL',
      is_default: false,
      created_at: new Date().toISOString(),
    } as VoicePreset
  },

  async deleteVoicePreset(_id: string) {
    await delay(200)
  },

  async setDefaultVoice(id: string) {
    await delay(200)
    const preset = DEMO_VOICE_PRESETS.find(p => p._id === id)
    if (!preset) throw new Error(`Voice preset not found: ${id}`)
    return { ...preset, is_default: true }
  },

  async generateVoicePreview(_text: string, _voiceId?: string) {
    await delay(500)
    // Return a minimal WAV blob
    return new Blob([], { type: 'audio/wav' })
  },
}

export default demoService

import axios from 'axios'
import { getIdToken } from '../lib/firebase'

// Use Cloud Run backend in production, local proxy in development
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API_BASE_URL = isLocalDev
  ? '/api'
  : 'https://israeli-radio-manager-534446777606.us-east1.run.app/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Firebase ID token to all requests
client.interceptors.request.use(async (config) => {
  const token = await getIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const api = {
  // Health check
  health: () => client.get('/health').then((r) => r.data),

  // Content
  getContent: (type?: string, genre?: string) =>
    client.get('/content/', { params: { content_type: type, genre } }).then((r) => r.data),
  getSongs: (genre?: string) =>
    client.get('/content/songs', { params: { genre } }).then((r) => r.data),
  getShows: () => client.get('/content/shows').then((r) => r.data),
  getCommercials: () => client.get('/content/commercials').then((r) => r.data),
  getGenres: () => client.get('/content/genres').then((r) => r.data),
  getContentById: (id: string) => client.get(`/content/${id}`).then((r) => r.data),
  updateContent: (id: string, data: any) =>
    client.patch(`/content/${id}`, data).then((r) => r.data),
  deleteContent: (id: string) => client.delete(`/content/${id}`).then((r) => r.data),

  // Sync
  getSyncStatus: () => client.get('/content/sync/status').then((r) => r.data),
  startSync: (downloadFiles?: boolean) =>
    client.post('/content/sync/start', null, { params: { download_files: downloadFiles } }).then((r) => r.data),
  refreshMetadata: () => client.post('/content/sync/refresh-metadata').then((r) => r.data),
  getSyncSchedulerStatus: () => client.get('/content/sync/scheduler/status').then((r) => r.data),
  triggerGcsSync: () => client.post('/content/sync/scheduler/trigger').then((r) => r.data),

  // Schedule
  getSchedule: () => client.get('/schedule/').then((r) => r.data),
  getCurrentSlot: () => client.get('/schedule/current').then((r) => r.data),
  getUpcomingSchedule: (hours?: number) =>
    client.get('/schedule/upcoming', { params: { hours } }).then((r) => r.data),
  createSlot: (data: any) => client.post('/schedule/slots', data).then((r) => r.data),
  updateSlot: (id: string, data: any) =>
    client.put(`/schedule/slots/${id}`, data).then((r) => r.data),
  deleteSlot: (id: string) => client.delete(`/schedule/slots/${id}`).then((r) => r.data),

  // Playback
  getPlaybackStatus: () => client.get('/playback/status').then((r) => r.data),
  getNowPlaying: () => client.get('/playback/now-playing').then((r) => r.data),
  getQueue: () => client.get('/playback/queue').then((r) => r.data),
  addToQueue: (contentId: string, priority?: number) =>
    client.post('/playback/queue', { content_id: contentId, priority: priority || 0 }).then((r) => r.data),
  removeFromQueue: (position: number) =>
    client.delete(`/playback/queue/${position}`).then((r) => r.data),
  reorderQueue: (fromIndex: number, toIndex: number) =>
    client.post('/playback/queue/reorder', { from_index: fromIndex, to_index: toIndex }).then((r) => r.data),
  clearQueue: () => client.post('/playback/queue/clear').then((r) => r.data),
  play: (contentId?: string) =>
    client.post('/playback/play', null, { params: { content_id: contentId } }).then((r) => r.data),
  pause: () => client.post('/playback/pause').then((r) => r.data),
  stop: () => client.post('/playback/stop').then((r) => r.data),
  skip: () => client.post('/playback/skip').then((r) => r.data),
  setVolume: (level: number) =>
    client.post('/playback/volume', { level }).then((r) => r.data),
  getPlaybackHistory: (limit?: number) =>
    client.get('/playback/history', { params: { limit } }).then((r) => r.data),
  getPlaybackStats: () => client.get('/playback/stats').then((r) => r.data),
  // Streaming URLs - prefer GCS for reliability
  getStreamUrl: (contentId: string) => `${API_BASE_URL}/playback/stream/gcs/${contentId}`,
  getStreamUrlLegacy: (contentId: string) => `${API_BASE_URL}/playback/stream/${contentId}`,
  getSignedStreamUrl: (contentId: string) =>
    client.get(`/playback/stream/signed/${contentId}`).then((r) => r.data),
  getCoverUrl: (contentId: string) => `${API_BASE_URL}/playback/cover/${contentId}`,

  // Emergency playlist
  getEmergencyPlaylist: () => client.get('/playback/emergency-playlist').then((r) => r.data),
  generateEmergencyPlaylist: (count?: number) =>
    client.post('/playback/emergency-playlist/generate', null, { params: { count } }).then((r) => r.data),
  // Convert relative emergency URL to absolute
  getEmergencyStreamUrl: (relativeUrl: string) => {
    // relativeUrl is like /api/playback/stream/emergency/filename.mp3
    // We need to prepend the backend base URL
    const backendBase = isLocalDev ? '' : 'https://israeli-radio-manager-534446777606.us-east1.run.app'
    return `${backendBase}${relativeUrl}`
  },
  logPlayStart: (contentId: string) =>
    client.post(`/playback/log-play/${contentId}`).then((r) => r.data),

  // Upload
  uploadFile: (file: File, data?: any) => {
    const formData = new FormData()
    formData.append('file', file)
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }
    return client.post('/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
  getPendingUploads: () => client.get('/upload/pending').then((r) => r.data),
  confirmUpload: (id: string, data: any) =>
    client.post(`/upload/pending/${id}/confirm`, data).then((r) => r.data),

  // Agent
  getAgentConfig: () => client.get('/agent/config').then((r) => r.data),
  updateAgentConfig: (config: any) =>
    client.put('/agent/config', config).then((r) => r.data),
  setAgentMode: (mode: 'full_automation' | 'prompt') =>
    client.post(`/agent/mode/${mode}`).then((r) => r.data),
  getAgentStatus: () => client.get('/agent/status').then((r) => r.data),
  getPendingActions: () => client.get('/agent/pending').then((r) => r.data),
  approveAction: (id: string, useAlternative?: number) =>
    client.post(`/agent/pending/${id}/approve`, null, {
      params: { use_alternative: useAlternative },
    }).then((r) => r.data),
  rejectAction: (id: string, reason?: string) =>
    client.post(`/agent/pending/${id}/reject`, null, { params: { reason } }).then((r) => r.data),
  getDecisions: (limit?: number) =>
    client.get('/agent/decisions', { params: { limit } }).then((r) => r.data),

  // Chat
  sendChatMessage: (message: string) =>
    client.post('/agent/chat', { message }).then((r) => r.data),
  getChatHistory: (limit?: number) =>
    client.get('/agent/chat/history', { params: { limit } }).then((r) => r.data),
  clearChatHistory: () => client.delete('/agent/chat/history').then((r) => r.data),

  // Calendar
  getCalendarEvents: (days?: number, contentType?: string) =>
    client.get('/calendar/events', { params: { days, content_type: contentType } }).then((r) => r.data),
  getTodaySchedule: () => client.get('/calendar/events/today').then((r) => r.data),
  getDaySchedule: (date: string) => client.get(`/calendar/events/day/${date}`).then((r) => r.data),
  getWeekSchedule: (startDate?: string) =>
    client.get('/calendar/week', { params: { start_date: startDate } }).then((r) => r.data),
  getCalendarEvent: (eventId: string) => client.get(`/calendar/events/${eventId}`).then((r) => r.data),
  createCalendarEvent: (data: {
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
  }) => client.post('/calendar/events', data).then((r) => r.data),
  updateCalendarEvent: (eventId: string, data: {
    summary?: string
    description?: string
    start_time?: string
    end_time?: string
    all_day?: boolean
  }) => client.put(`/calendar/events/${eventId}`, data).then((r) => r.data),
  deleteCalendarEvent: (eventId: string) =>
    client.delete(`/calendar/events/${eventId}`).then((r) => r.data),

  // Flows
  getFlows: (status?: string) =>
    client.get('/flows/', { params: { status } }).then((r) => r.data),
  getActiveFlows: () =>
    client.get('/flows/active').then((r) => r.data),
  getFlow: (flowId: string) =>
    client.get(`/flows/${flowId}`).then((r) => r.data),
  createFlow: (data: {
    name: string
    name_he?: string
    description?: string
    actions: Array<{
      action_type: string
      genre?: string
      content_id?: string
      commercial_count?: number
      duration_minutes?: number
      volume_level?: number
      description?: string
    }>
    trigger_type?: 'scheduled' | 'manual' | 'event'
    schedule?: {
      days_of_week: number[]
      start_time: string
      end_time?: string
    }
    priority?: number
    loop?: boolean
  }) => client.post('/flows/', data).then((r) => r.data),
  updateFlow: (flowId: string, data: any) =>
    client.put(`/flows/${flowId}`, data).then((r) => r.data),
  deleteFlow: (flowId: string) =>
    client.delete(`/flows/${flowId}`).then((r) => r.data),
  toggleFlow: (flowId: string) =>
    client.post(`/flows/${flowId}/toggle`).then((r) => r.data),
  runFlow: (flowId: string) =>
    client.post(`/flows/${flowId}/run`).then((r) => r.data),
  resetFlow: (flowId: string) =>
    client.post(`/flows/${flowId}/reset`).then((r) => r.data),
  resyncFlowsCalendar: () =>
    client.post('/flows/resync-calendar').then((r) => r.data),
  getFlowExecutions: (flowId: string, limit?: number) =>
    client.get(`/flows/${flowId}/executions`, { params: { limit } }).then((r) => r.data),
  parseNaturalFlow: (text: string) =>
    client.post('/flows/parse-natural', null, { params: { text } }).then((r) => r.data),

  // Settings & Notifications
  getSettings: () => client.get('/settings/').then((r) => r.data),
  updateSettings: (data: {
    notifications?: {
      email_enabled: boolean
      push_enabled: boolean
      sms_enabled: boolean
    }
    admin_contact?: {
      email: string | null
      phone: string | null
    }
  }) => client.put('/settings/', data).then((r) => r.data),
  testNotification: (channel: 'email' | 'push' | 'sms') =>
    client.post('/settings/test-notification', null, { params: { channel } }).then((r) => r.data),
  subscribeToPush: (subscription: PushSubscriptionJSON) =>
    client.post('/settings/push-subscription', subscription).then((r) => r.data),
  unsubscribeFromPush: (endpoint: string) =>
    client.delete('/settings/push-subscription', { params: { endpoint } }).then((r) => r.data),

  // Emergency mode reporting
  reportEmergencyMode: () =>
    client.post('/playback/emergency-mode-activated').then((r) => r.data),

  // Admin - System Configuration
  getAdminEnvConfig: () =>
    client.get('/admin/config/env').then((r) => r.data),
  updateAdminEnvConfig: (updates: Record<string, string>) =>
    client.put('/admin/config/env', { updates }).then((r) => r.data),
  getAdminSensitiveKeys: () =>
    client.get('/admin/config/sensitive-keys').then((r) => r.data),

  // Admin - Storage Management
  getAdminStorageStats: () =>
    client.get('/admin/storage/stats').then((r) => r.data),
  clearAdminCache: (keepRecentDays?: number) =>
    client.post('/admin/storage/cache/clear', null, { params: { keep_recent_days: keepRecentDays } }).then((r) => r.data),
  getAdminOrphanedFiles: () =>
    client.get('/admin/storage/orphaned').then((r) => r.data),

  // Admin - Content Quality & Statistics
  getAdminQualityIssues: () =>
    client.get('/admin/content/quality-issues').then((r) => r.data),
  getAdminContentStats: () =>
    client.get('/admin/content/stats').then((r) => r.data),

  // Admin - Batch Operations
  adminBatchDeleteContent: (contentIds: string[]) =>
    client.post('/admin/content/batch/delete', { content_ids: contentIds }).then((r) => r.data),
  adminBatchUpdateMetadata: (contentIds: string[], updates: any) =>
    client.patch('/admin/content/batch/metadata', { content_ids: contentIds, updates }).then((r) => r.data),
  adminBatchReassignGenre: (contentIds: string[], newGenre: string) =>
    client.post('/admin/content/batch/reassign-genre', { content_ids: contentIds, new_genre: newGenre }).then((r) => r.data),

  // Admin - Server Health & Management
  getServerHealth: () =>
    client.get('/admin/server/health').then((r) => r.data),
  restartServer: () =>
    client.post('/admin/server/restart').then((r) => r.data),
  clearCache: (keepRecentDays?: number, includeLogs?: boolean) =>
    client.post('/admin/storage/cache/clear', null, { params: { keep_recent_days: keepRecentDays, include_logs: includeLogs } }).then((r) => r.data),

  // Users - Current User
  getCurrentUser: () =>
    client.get('/users/me').then((r) => r.data),
  updateCurrentUser: (data: { display_name?: string; photo_url?: string }) =>
    client.patch('/users/me', data).then((r) => r.data),
  updateUserPreferences: (preferences: {
    language?: string;
    theme?: string;
    notifications?: { email_enabled?: boolean; push_enabled?: boolean; sms_enabled?: boolean };
  }) =>
    client.patch('/users/me/preferences', preferences).then((r) => r.data),

  // Users - Admin Management
  listUsers: (params?: { skip?: number; limit?: number; role?: string; include_inactive?: boolean }) =>
    client.get('/users/', { params }).then((r) => r.data),
  getUserStats: () =>
    client.get('/users/stats').then((r) => r.data),
  getUser: (firebaseUid: string) =>
    client.get(`/users/${firebaseUid}`).then((r) => r.data),
  updateUser: (firebaseUid: string, data: { display_name?: string; photo_url?: string }) =>
    client.patch(`/users/${firebaseUid}`, data).then((r) => r.data),
  setUserRole: (firebaseUid: string, role: 'admin' | 'editor' | 'viewer') =>
    client.patch(`/users/${firebaseUid}/role`, { role }).then((r) => r.data),
  deactivateUser: (firebaseUid: string) =>
    client.delete(`/users/${firebaseUid}`).then((r) => r.data),
  reactivateUser: (firebaseUid: string) =>
    client.post(`/users/${firebaseUid}/reactivate`).then((r) => r.data),
}

export default api

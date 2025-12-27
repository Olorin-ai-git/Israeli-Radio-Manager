import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
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
  play: (contentId?: string) =>
    client.post('/playback/play', null, { params: { content_id: contentId } }).then((r) => r.data),
  pause: () => client.post('/playback/pause').then((r) => r.data),
  stop: () => client.post('/playback/stop').then((r) => r.data),
  skip: () => client.post('/playback/skip').then((r) => r.data),
  setVolume: (level: number) =>
    client.post('/playback/volume', { level }).then((r) => r.data),
  getPlaybackHistory: (limit?: number) =>
    client.get('/playback/history', { params: { limit } }).then((r) => r.data),

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
}

export default api

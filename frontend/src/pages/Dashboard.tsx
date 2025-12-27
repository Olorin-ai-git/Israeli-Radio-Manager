import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Music, Radio, Megaphone, Clock, Calendar } from 'lucide-react'
import { api } from '../services/api'
import { usePlayerStore } from '../store/playerStore'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  // Browser-based player state (primary)
  const { currentTrack, isPlaying: browserIsPlaying } = usePlayerStore()

  // Server-side playback status (for VLC backend playback - fallback)
  const { data: playbackStatus } = useQuery({
    queryKey: ['playbackStatus'],
    queryFn: api.getPlaybackStatus,
    refetchInterval: 5000,
  })

  const { data: agentStatus } = useQuery({
    queryKey: ['agentStatus'],
    queryFn: api.getAgentStatus,
    refetchInterval: 10000,
  })

  // Use Google Calendar events for upcoming schedule
  const { data: calendarEvents } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => api.getCalendarEvents(7),
    refetchInterval: 30000,
  })

  // Get recent playback history
  const { data: playbackHistory } = useQuery({
    queryKey: ['playbackHistory'],
    queryFn: () => api.getPlaybackHistory(10),
    refetchInterval: 15000,
  })

  // Filter to only show upcoming events (not past)
  const upcomingEvents = calendarEvents?.filter((event: any) => {
    const startTime = new Date(event.start?.dateTime || event.start?.date)
    return startTime > new Date()
  }) || []

  // Use browser player state, fallback to backend VLC status
  const isPlaying = browserIsPlaying || playbackStatus?.state === 'playing'
  const displayTrack = currentTrack || playbackStatus?.current_track

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Now Playing Card */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500/30 to-primary-600/20 p-6 border-b border-white/5">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.nowPlaying')}</h2>

            <div className="flex items-center gap-4">
              {/* Album art placeholder */}
              <div className="w-24 h-24 bg-dark-700/50 rounded-xl flex items-center justify-center border border-white/10 glow-animate">
                {isPlaying ? (
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-1.5 bg-primary-400 audio-bar h-4 rounded-full"></div>
                    <div className="w-1.5 bg-primary-400 audio-bar h-6 rounded-full"></div>
                    <div className="w-1.5 bg-primary-400 audio-bar h-8 rounded-full"></div>
                    <div className="w-1.5 bg-primary-400 audio-bar h-5 rounded-full"></div>
                  </div>
                ) : (
                  <Music size={40} className="text-dark-500" />
                )}
              </div>

              <div className="flex-1">
                {displayTrack ? (
                  <>
                    <h3 className="text-xl font-bold text-dark-100" dir="auto">{displayTrack.title}</h3>
                    {displayTrack.artist && (
                      <p className="text-dark-300 text-lg">{displayTrack.artist}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {displayTrack.type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          displayTrack.type === 'song' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                          displayTrack.type === 'commercial' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                          displayTrack.type === 'show' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                          'bg-dark-500/20 text-dark-400 border-dark-500/30'
                        }`}>
                          {displayTrack.type}
                        </span>
                      )}
                      {displayTrack.genre && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                          {displayTrack.genre}
                        </span>
                      )}
                      {displayTrack.duration_seconds && (
                        <span className="text-xs text-dark-400">
                          {Math.floor(displayTrack.duration_seconds / 60)}:{String(displayTrack.duration_seconds % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-dark-400">{t('dashboard.noTrack')}</p>
                    <p className="text-xs text-dark-500 mt-1">
                      {isRTL ? 'בחר שיר מהספרייה כדי לנגן' : 'Select a song from the library to play'}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Quick Stats */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.quickStats')}</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center border border-sky-500/30">
                <Music size={20} className="text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-100">0</p>
                <p className="text-sm text-dark-400">{t('dashboard.songsPlayed')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                <Radio size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-100">0</p>
                <p className="text-sm text-dark-400">{t('dashboard.showsAired')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <Megaphone size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-100">0</p>
                <p className="text-sm text-dark-400">{t('dashboard.commercials')}</p>
              </div>
            </div>
          </div>

          {/* Agent Status */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-400">{t('agent.status')}</span>
              <span className={`badge ${
                agentStatus?.active
                  ? 'badge-success'
                  : 'bg-dark-600/50 text-dark-400 border border-dark-500/30'
              }`}>
                {agentStatus?.active ? t('agent.active') : t('agent.inactive')}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-dark-400">{t('agent.mode')}</span>
              <span className="text-sm font-medium text-dark-200">
                {agentStatus?.mode === 'full_automation' ? t('agent.fullAuto') : t('agent.promptMode')}
              </span>
            </div>
            {agentStatus?.pending_actions > 0 && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-sm text-amber-400">
                  {agentStatus.pending_actions} {t('agent.pendingActions').toLowerCase()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Schedule */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-primary-400" />
            {t('dashboard.upcoming')}
          </h2>

          <div className="space-y-3">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.slice(0, 5).map((event: any) => {
                const startTime = new Date(event.start?.dateTime || event.start?.date)
                const contentType = event.extendedProperties?.private?.radio_content_type || 'content'
                const typeColors: Record<string, string> = {
                  song: 'bg-sky-500/20 border-sky-500/30 text-sky-400',
                  commercial: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
                  show: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
                  content: 'bg-primary-500/20 border-primary-500/30 text-primary-400',
                }
                const TypeIcon = contentType === 'song' ? Music
                  : contentType === 'commercial' ? Megaphone
                  : contentType === 'show' ? Radio
                  : Clock

                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 bg-dark-700/30 rounded-xl border border-white/5 hover:border-primary-500/30 transition-all"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${typeColors[contentType] || typeColors.content}`}>
                      <TypeIcon size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-dark-100" dir="auto">
                        {event.summary}
                      </p>
                      <p className="text-sm text-dark-400">
                        {startTime.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' '}
                        {startTime.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${typeColors[contentType] || typeColors.content}`}>
                      {contentType}
                    </span>
                  </div>
                )
              })
            ) : (
              <p className="text-dark-400 text-center py-4">
                {isRTL ? 'אין אירועים מתוכננים' : 'No upcoming events'}
              </p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {playbackHistory && playbackHistory.length > 0 ? (
              playbackHistory.slice(0, 8).map((item: any) => {
                const playedAt = new Date(item.started_at)
                const typeColors: Record<string, string> = {
                  song: 'text-sky-400',
                  commercial: 'text-orange-400',
                  show: 'text-purple-400',
                }
                const TypeIcon = item.type === 'song' ? Music
                  : item.type === 'commercial' ? Megaphone
                  : item.type === 'show' ? Radio
                  : Music

                return (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 p-2 bg-dark-700/30 rounded-lg"
                  >
                    <TypeIcon size={16} className={typeColors[item.type] || 'text-dark-400'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-200 truncate" dir="auto">
                        {item.title}
                      </p>
                      <p className="text-xs text-dark-500">
                        {playedAt.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-dark-500 text-center py-8">
                <Clock size={40} className="mx-auto mb-2 text-dark-600" />
                <p className="text-sm">{isRTL ? 'אין פעילות אחרונה' : 'No recent activity'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

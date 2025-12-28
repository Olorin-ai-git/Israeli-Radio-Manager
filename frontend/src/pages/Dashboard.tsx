import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Music, Radio, Megaphone, Clock, Calendar, BarChart2, RefreshCw, Bot } from 'lucide-react'
import { api } from '../services/api'
import { usePlayerStore } from '../store/playerStore'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState(false)

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
  const { data: calendarEvents, refetch: refetchCalendar, isRefetching: isRefetchingCalendar } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => api.getCalendarEvents(7),
    refetchInterval: 30000,
    refetchOnMount: true,
  })

  // Get recent playback history
  const { data: playbackHistory } = useQuery({
    queryKey: ['playbackHistory'],
    queryFn: () => api.getPlaybackHistory(10),
    refetchInterval: 15000,
  })

  // Get playback stats
  const { data: playbackStats } = useQuery({
    queryKey: ['playbackStats'],
    queryFn: api.getPlaybackStats,
    refetchInterval: 30000,
  })

  // Filter to only show upcoming events (not past)
  const upcomingEvents = calendarEvents?.filter((event: any) => {
    const startTime = new Date(event.start?.dateTime || event.start?.date)
    return startTime > new Date()
  }) || []

  // Use browser player state, fallback to backend VLC status
  const isPlaying = browserIsPlaying || playbackStatus?.state === 'playing'
  const displayTrack = currentTrack || playbackStatus?.current_track

  // Load album cover when track changes
  useEffect(() => {
    if (displayTrack?._id) {
      setCoverUrl(api.getCoverUrl(displayTrack._id))
      setCoverError(false)
    } else {
      setCoverUrl(null)
      setCoverError(false)
    }
  }, [displayTrack?._id])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Now Playing Card */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500/30 to-primary-600/20 p-6 border-b border-white/5">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.nowPlaying')}</h2>

            <div className="flex items-center gap-4">
              {/* Album art */}
              <div className={`w-24 h-24 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden bg-dark-700/50 flex-shrink-0 ${isPlaying ? 'glow-animate' : ''}`}>
                {coverUrl && !coverError ? (
                  <img
                    src={coverUrl}
                    alt="Album cover"
                    className="w-full h-full object-cover"
                    onError={() => setCoverError(true)}
                  />
                ) : isPlaying ? (
                  <div className="flex items-end gap-1 h-8 is-playing">
                    <div className="w-1.5 bg-primary-400 audio-bar h-4 rounded-full"></div>
                    <div className="w-1.5 bg-primary-400 audio-bar h-6 rounded-full"></div>
                    <div className="w-1.5 bg-primary-400 audio-bar h-8 rounded-full"></div>
                    <div className="w-1.5 bg-primary-400 audio-bar h-5 rounded-full"></div>
                  </div>
                ) : (
                  <Music size={40} className="text-dark-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {displayTrack ? (
                  <>
                    {/* Title */}
                    <h3 className="text-xl font-bold text-dark-100 truncate" dir="auto">
                      {displayTrack.title}
                    </h3>

                    {/* Artist */}
                    <p className="text-dark-300 text-lg truncate" dir="auto">
                      {displayTrack.artist || (isRTL ? 'אמן לא ידוע' : 'Unknown Artist')}
                    </p>

                    {/* Tags Row */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {/* Type Badge */}
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        displayTrack.type === 'song' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                        displayTrack.type === 'commercial' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        displayTrack.type === 'show' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                        'bg-dark-500/20 text-dark-400 border-dark-500/30'
                      }`}>
                        {displayTrack.type === 'song' ? (isRTL ? 'שיר' : 'Song') :
                         displayTrack.type === 'commercial' ? (isRTL ? 'פרסומת' : 'Commercial') :
                         displayTrack.type === 'show' ? (isRTL ? 'תוכנית' : 'Show') : displayTrack.type}
                      </span>

                      {/* Genre */}
                      {displayTrack.genre && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                          {displayTrack.genre}
                        </span>
                      )}

                      {/* Language */}
                      {displayTrack.metadata?.language && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {displayTrack.metadata.language === 'hebrew' ? (isRTL ? 'עברית' : 'Hebrew') : displayTrack.metadata.language}
                        </span>
                      )}

                      {/* Album */}
                      {displayTrack.metadata?.album && (
                        <span className="text-xs text-dark-400">
                          💿 {displayTrack.metadata.album}
                        </span>
                      )}

                      {/* Year */}
                      {displayTrack.metadata?.year && (
                        <span className="text-xs text-dark-400">
                          📅 {displayTrack.metadata.year}
                        </span>
                      )}
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-dark-500">
                      {/* Duration */}
                      {displayTrack.duration_seconds ? (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {Math.floor(displayTrack.duration_seconds / 60)}:{String(Math.floor(displayTrack.duration_seconds % 60)).padStart(2, '0')}
                        </span>
                      ) : null}

                      {/* Play Count */}
                      {displayTrack.play_count !== undefined && (
                        <span className="flex items-center gap-1">
                          <BarChart2 size={12} />
                          {displayTrack.play_count} {isRTL ? 'השמעות' : 'plays'}
                        </span>
                      )}

                      {/* File Name */}
                      {displayTrack.google_drive_path && (
                        <span className="hidden md:inline text-dark-600 truncate max-w-[200px]" title={displayTrack.google_drive_path}>
                          📁 {displayTrack.google_drive_path}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-dark-400 text-lg">{t('dashboard.noTrack')}</p>
                    <p className="text-sm text-dark-500 mt-1">
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
                <p className="text-2xl font-bold text-dark-100">{playbackStats?.today?.songs_played || 0}</p>
                <p className="text-sm text-dark-400">{t('dashboard.songsPlayed')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                <Radio size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-100">{playbackStats?.today?.shows_aired || 0}</p>
                <p className="text-sm text-dark-400">{t('dashboard.showsAired')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <Megaphone size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dark-100">{playbackStats?.today?.commercials_played || 0}</p>
                <p className="text-sm text-dark-400">{t('dashboard.commercials')}</p>
              </div>
            </div>
          </div>

          {/* Orchestrator AI Agent Status */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={16} className="text-primary-400" />
              <span className="text-sm font-medium text-dark-200">
                {isRTL ? 'סוכן AI מתזמר' : 'Orchestrator AI Agent'}
              </span>
            </div>
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
            {/* Mode explanation */}
            <p className="text-xs text-dark-500 mt-2">
              {agentStatus?.mode === 'full_automation'
                ? (isRTL
                    ? 'הסוכן מבצע פעולות אוטומטית ללא אישור'
                    : 'Agent executes actions automatically without approval')
                : (isRTL
                    ? 'הסוכן מבקש אישור לפני ביצוע פעולות'
                    : 'Agent requests approval before executing actions')
              }
            </p>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
              <Calendar size={20} className="text-primary-400" />
              {t('dashboard.upcoming')}
            </h2>
            <button
              onClick={() => refetchCalendar()}
              disabled={isRefetchingCalendar}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-dark-400 hover:text-dark-200 disabled:opacity-50"
              title={isRTL ? 'רענן' : 'Refresh'}
            >
              <RefreshCw size={16} className={isRefetchingCalendar ? 'animate-spin' : ''} />
            </button>
          </div>

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
        <div className="glass-card p-6 flex flex-col max-h-[600px]">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="space-y-2 flex-1 overflow-y-auto pr-2">
            {playbackHistory && playbackHistory.length > 0 ? (
              playbackHistory.map((item: any) => {
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
              <div className="flex-1 flex flex-col items-center justify-center text-dark-500">
                <Clock size={40} className="mb-2 text-dark-600" />
                <p className="text-sm">{isRTL ? 'אין פעילות אחרונה' : 'No recent activity'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

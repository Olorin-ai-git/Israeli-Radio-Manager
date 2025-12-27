import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Play, Pause, SkipForward, Volume2, Music, Radio, Megaphone, Clock } from 'lucide-react'
import { api } from '../services/api'

export default function Dashboard() {
  const { t } = useTranslation()

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

  const { data: upcomingSchedule } = useQuery({
    queryKey: ['upcomingSchedule'],
    queryFn: () => api.getUpcomingSchedule(24),
  })

  const isPlaying = playbackStatus?.state === 'playing'

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
                {playbackStatus?.current_track ? (
                  <>
                    <h3 className="text-xl font-bold text-dark-100">{playbackStatus.current_track.title}</h3>
                    <p className="text-dark-400">{playbackStatus.current_track.artist}</p>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="h-1.5 bg-dark-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all shadow-glow"
                          style={{
                            width: `${(playbackStatus.position_seconds / playbackStatus.duration_seconds) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-dark-400 mt-1">
                        <span>{formatTime(playbackStatus.position_seconds)}</span>
                        <span>{formatTime(playbackStatus.duration_seconds)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-dark-400">{t('dashboard.noTrack')}</p>
                )}
              </div>
            </div>

            {/* Player controls */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => isPlaying ? api.pause() : api.play()}
                className="w-14 h-14 glass-button-primary rounded-full flex items-center justify-center shadow-glow"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>
              <button
                onClick={() => api.skip()}
                className="w-12 h-12 glass-button rounded-full flex items-center justify-center"
              >
                <SkipForward size={20} />
              </button>
              <div className="flex items-center gap-2 ml-4">
                <Volume2 size={20} className="text-dark-400" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playbackStatus?.volume || 80}
                  onChange={(e) => api.setVolume(Number(e.target.value))}
                  className="w-24 accent-primary-500"
                />
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
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.upcoming')}</h2>

          <div className="space-y-3">
            {upcomingSchedule && upcomingSchedule.length > 0 ? (
              upcomingSchedule.slice(0, 5).map((slot: any, index: number) => (
                <div
                  key={slot._id || index}
                  className="flex items-center gap-4 p-3 bg-dark-700/30 rounded-xl border border-white/5 hover:border-primary-500/30 transition-all"
                >
                  <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/30">
                    <Clock size={20} className="text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-dark-100">
                      {slot.content_type === 'song' && slot.genre
                        ? `${slot.genre} Songs`
                        : slot.content_type}
                    </p>
                    <p className="text-sm text-dark-400">
                      {slot.start_time} - {slot.end_time}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-dark-400 text-center py-4">No upcoming schedule</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="text-dark-500 text-center py-8">
            <Clock size={40} className="mx-auto mb-2 text-dark-600" />
            <p className="text-sm">No recent activity</p>
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

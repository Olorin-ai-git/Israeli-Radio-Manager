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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Now Playing Card */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white">
            <h2 className="text-lg font-semibold mb-4">{t('dashboard.nowPlaying')}</h2>

            <div className="flex items-center gap-4">
              {/* Album art placeholder */}
              <div className="w-24 h-24 bg-white/20 rounded-lg flex items-center justify-center">
                {isPlaying ? (
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-1.5 bg-white audio-bar h-4"></div>
                    <div className="w-1.5 bg-white audio-bar h-6"></div>
                    <div className="w-1.5 bg-white audio-bar h-8"></div>
                    <div className="w-1.5 bg-white audio-bar h-5"></div>
                  </div>
                ) : (
                  <Music size={40} className="text-white/60" />
                )}
              </div>

              <div className="flex-1">
                {playbackStatus?.current_track ? (
                  <>
                    <h3 className="text-xl font-bold">{playbackStatus.current_track.title}</h3>
                    <p className="text-primary-100">{playbackStatus.current_track.artist}</p>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all"
                          style={{
                            width: `${(playbackStatus.position_seconds / playbackStatus.duration_seconds) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-primary-100 mt-1">
                        <span>{formatTime(playbackStatus.position_seconds)}</span>
                        <span>{formatTime(playbackStatus.duration_seconds)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-primary-100">{t('dashboard.noTrack')}</p>
                )}
              </div>
            </div>

            {/* Player controls */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => isPlaying ? api.pause() : api.play()}
                className="w-12 h-12 bg-white text-primary-500 rounded-full flex items-center justify-center hover:bg-primary-50 transition-colors"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>
              <button
                onClick={() => api.skip()}
                className="w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <SkipForward size={20} />
              </button>
              <div className="flex items-center gap-2 ml-4">
                <Volume2 size={20} className="text-primary-100" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playbackStatus?.volume || 80}
                  onChange={(e) => api.setVolume(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quickStats')}</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Music size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-500">{t('dashboard.songsPlayed')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Radio size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-500">{t('dashboard.showsAired')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Megaphone size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-500">{t('dashboard.commercials')}</p>
              </div>
            </div>
          </div>

          {/* Agent Status */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('agent.status')}</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                agentStatus?.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {agentStatus?.active ? t('agent.active') : t('agent.inactive')}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500">{t('agent.mode')}</span>
              <span className="text-sm font-medium text-gray-900">
                {agentStatus?.mode === 'full_automation' ? t('agent.fullAuto') : t('agent.promptMode')}
              </span>
            </div>
            {agentStatus?.pending_actions > 0 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  {agentStatus.pending_actions} {t('agent.pendingActions').toLowerCase()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Schedule */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.upcoming')}</h2>

          <div className="space-y-3">
            {upcomingSchedule && upcomingSchedule.length > 0 ? (
              upcomingSchedule.slice(0, 5).map((slot: any, index: number) => (
                <div
                  key={slot._id || index}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Clock size={20} className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {slot.content_type === 'song' && slot.genre
                        ? `${slot.genre} Songs`
                        : slot.content_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      {slot.start_time} - {slot.end_time}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No upcoming schedule</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="text-gray-500 text-center py-8">
            <Clock size={40} className="mx-auto mb-2 text-gray-300" />
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

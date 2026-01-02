import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock, Music, Radio, Megaphone, ChevronRight, ChevronLeft } from 'lucide-react'
import { api } from '../../services/api'

interface PlaybackHistoryItem {
  _id: string
  title: string
  artist?: string
  type: string
  started_at: string
}

export default function RecentActivityWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const navigate = useNavigate()

  const { data: playbackHistory = [] } = useQuery<PlaybackHistoryItem[]>({
    queryKey: ['playbackHistory'],
    queryFn: () => api.getPlaybackHistory(8),
    refetchInterval: 15000,
  })

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'song':
        return { icon: Music, color: 'text-sky-400' }
      case 'commercial':
        return { icon: Megaphone, color: 'text-orange-400' }
      case 'show':
        return { icon: Radio, color: 'text-purple-400' }
      default:
        return { icon: Music, color: 'text-dark-400' }
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="glass-card p-4 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <Clock size={16} className="text-primary-400" />
          {isRTL ? 'פעילות אחרונה' : 'Recent Activity'}
        </h3>
        <button
          onClick={() => navigate('/library')}
          className="text-[10px] text-dark-400 hover:text-primary-400 transition-colors flex items-center gap-0.5"
        >
          {isRTL ? 'היסטוריה' : 'History'}
          <ChevronIcon size={12} />
        </button>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1" style={{ maxHeight: '280px' }}>
        {playbackHistory.length > 0 ? (
          playbackHistory.map((item) => {
            const config = getTypeConfig(item.type)
            const TypeIcon = config.icon

            return (
              <div
                key={item._id}
                className="flex items-center gap-2 p-2 bg-dark-700/30 rounded-lg hover:bg-dark-600/30 transition-colors group"
              >
                <TypeIcon size={14} className={config.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-dark-200 truncate" dir="auto">
                    {item.title}
                  </p>
                  {item.artist && (
                    <p className="text-[10px] text-dark-500 truncate" dir="auto">
                      {item.artist}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-dark-500 tabular-nums flex-shrink-0">
                  {formatTime(item.started_at)}
                </span>
              </div>
            )
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-500 py-8">
            <Clock size={32} className="mb-2 opacity-40" />
            <p className="text-xs">{isRTL ? 'אין פעילות אחרונה' : 'No recent activity'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

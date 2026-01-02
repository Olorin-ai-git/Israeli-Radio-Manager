import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Music, Radio, Megaphone, Bot } from 'lucide-react'
import { api } from '../../services/api'

interface PlaybackStats {
  today: {
    songs_played: number
    shows_aired: number
    commercials_played: number
  }
}

export default function QuickStatsWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  const { data: playbackStats } = useQuery<PlaybackStats>({
    queryKey: ['playbackStats'],
    queryFn: api.getPlaybackStats,
    refetchInterval: 30000,
  })

  const { data: agentStatus } = useQuery({
    queryKey: ['agentStatus'],
    queryFn: api.getAgentStatus,
    refetchInterval: 10000,
  })

  const stats = [
    {
      icon: Music,
      value: playbackStats?.today?.songs_played || 0,
      label: isRTL ? 'שירים' : 'Songs',
      color: 'sky',
    },
    {
      icon: Megaphone,
      value: playbackStats?.today?.commercials_played || 0,
      label: isRTL ? 'פרסומות' : 'Ads',
      color: 'orange',
    },
    {
      icon: Radio,
      value: playbackStats?.today?.shows_aired || 0,
      label: isRTL ? 'תוכניות' : 'Shows',
      color: 'purple',
    },
    {
      icon: Bot,
      value: agentStatus?.active ? (agentStatus?.mode === 'full_automation' ? (isRTL ? 'אוטו' : 'Auto') : (isRTL ? 'ידני' : 'Manual')) : (isRTL ? 'כבוי' : 'Off'),
      label: isRTL ? 'סוכן' : 'Agent',
      color: agentStatus?.active ? 'emerald' : 'dark',
      isStatus: true,
    },
  ]

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'sky':
        return { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400' }
      case 'orange':
        return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' }
      case 'purple':
        return { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' }
      case 'emerald':
        return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' }
      default:
        return { bg: 'bg-dark-600/50', border: 'border-dark-500/30', text: 'text-dark-400' }
    }
  }

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-dark-100 mb-3">
        {isRTL ? 'סטטיסטיקות היום' : "Today's Stats"}
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat, idx) => {
          const colors = getColorClasses(stat.color)
          return (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center gap-2">
                <stat.icon size={14} className={colors.text} />
                <span className="text-[10px] text-dark-400">{stat.label}</span>
              </div>
              <p className={`text-lg font-bold mt-1 ${stat.isStatus ? colors.text : 'text-dark-100'}`}>
                {stat.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Pending Actions Alert */}
      {agentStatus?.pending_actions > 0 && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
            {agentStatus.pending_actions} {isRTL ? 'פעולות ממתינות' : 'pending actions'}
          </p>
        </div>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Calendar, Music, Radio, Megaphone, Clock, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react'
import { api } from '../../services/api'

interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  extendedProperties?: {
    private?: {
      radio_content_type?: string
    }
  }
}

export default function UpcomingScheduleWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const navigate = useNavigate()

  const { data: calendarEvents, refetch, isRefetching } = useQuery<CalendarEvent[]>({
    queryKey: ['calendarEvents'],
    queryFn: () => api.getCalendarEvents(7),
    refetchInterval: 30000,
  })

  // Filter to only show upcoming events
  const upcomingEvents = useMemo(() => {
    return (Array.isArray(calendarEvents) ? calendarEvents : [])
      .filter((event: CalendarEvent) => {
        const startTime = new Date(event.start?.dateTime || event.start?.date || '')
        return startTime > new Date()
      })
      .slice(0, 5)
  }, [calendarEvents])

  // Calculate time until next event
  const nextEventCountdown = useMemo(() => {
    if (upcomingEvents.length === 0) return null

    const nextEvent = upcomingEvents[0]
    const startTime = new Date(nextEvent.start?.dateTime || nextEvent.start?.date || '')
    const now = new Date()
    const diffMs = startTime.getTime() - now.getTime()

    if (diffMs <= 0) return null

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }, [upcomingEvents])

  const getTypeConfig = (contentType?: string) => {
    switch (contentType) {
      case 'song':
        return { icon: Music, bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400' }
      case 'commercial':
        return { icon: Megaphone, bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' }
      case 'show':
        return { icon: Radio, bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' }
      default:
        return { icon: Clock, bg: 'bg-primary-500/20', border: 'border-primary-500/30', text: 'text-primary-400' }
    }
  }

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <Calendar size={16} className="text-primary-400" />
          {isRTL ? 'לוח זמנים' : 'Upcoming Schedule'}
          {nextEventCountdown && (
            <span className="px-1.5 py-0.5 text-[10px] bg-primary-500/20 text-primary-400 rounded-full border border-primary-500/30">
              {isRTL ? 'בעוד ' : 'in '}{nextEventCountdown}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-dark-400 hover:text-dark-200 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="text-[10px] text-dark-400 hover:text-primary-400 transition-colors flex items-center gap-0.5"
          >
            {isRTL ? 'ליומן' : 'Calendar'}
            <ChevronIcon size={12} />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto">
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map((event: CalendarEvent) => {
            const startTime = new Date(event.start?.dateTime || event.start?.date || '')
            const contentType = event.extendedProperties?.private?.radio_content_type || 'content'
            const config = getTypeConfig(contentType)
            const TypeIcon = config.icon

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 p-2.5 bg-dark-700/30 rounded-lg border border-white/5 hover:border-primary-500/30 transition-all group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${config.bg} ${config.border}`}>
                  <TypeIcon size={14} className={config.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-dark-100 truncate" dir="auto">
                    {event.summary}
                  </p>
                  <p className="text-[10px] text-dark-400">
                    {startTime.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' '}
                    {startTime.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${config.bg} ${config.border} ${config.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  {contentType}
                </span>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-dark-500">
            <Calendar size={28} className="mb-2 opacity-40" />
            <p className="text-xs">{isRTL ? 'אין אירועים מתוכננים' : 'No upcoming events'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

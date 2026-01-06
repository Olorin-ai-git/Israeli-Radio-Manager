import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Loader2, Clock } from 'lucide-react'
import { useService } from '../../services'

interface DailyPreviewTimelineProps {
  initialDate?: string // YYYY-MM-DD format
  onDateChange?: (date: string) => void
}

interface SlotCommercial {
  campaign_id: string
  name: string
  campaign_type: string
  priority: number
  play_count: number
  content_count: number
}

interface PreviewSlot {
  slot_index: number
  time: string
  commercials: SlotCommercial[]
}

interface DailyPreviewResponse {
  date: string
  day_of_week: number
  slots: PreviewSlot[]
}

// Priority color mapping
const getPriorityColor = (priority: number): string => {
  if (priority >= 8) return 'bg-red-500'
  if (priority >= 6) return 'bg-orange-500'
  if (priority >= 4) return 'bg-amber-500'
  return 'bg-green-500'
}

// Get color with lower opacity for background
const getPriorityBgColor = (priority: number): string => {
  if (priority >= 8) return 'bg-red-500/30'
  if (priority >= 6) return 'bg-orange-500/30'
  if (priority >= 4) return 'bg-amber-500/30'
  return 'bg-green-500/30'
}

export default function DailyPreviewTimeline({
  initialDate,
  onDateChange,
}: DailyPreviewTimelineProps) {
  const { i18n } = useTranslation()
  const service = useService()
  const isRTL = i18n.language === 'he'

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper to parse YYYY-MM-DD as local date
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Date state
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) return initialDate
    return formatLocalDate(new Date())
  })

  // Fetch daily preview
  const { data: preview, isLoading, refetch } = useQuery<DailyPreviewResponse>({
    queryKey: ['campaignDailyPreview', selectedDate],
    queryFn: () => service.getCampaignDailyPreview(selectedDate) as Promise<DailyPreviewResponse>,
  })

  // Navigation helpers
  const goToDate = (offset: number) => {
    const date = parseLocalDate(selectedDate)
    date.setDate(date.getDate() + offset)
    const newDate = formatLocalDate(date)
    setSelectedDate(newDate)
    onDateChange?.(newDate)
  }

  const goToToday = () => {
    const today = formatLocalDate(new Date())
    setSelectedDate(today)
    onDateChange?.(today)
  }

  // Format display date (uses browser's locale)
  const displayDate = useMemo(() => {
    const date = parseLocalDate(selectedDate)
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [selectedDate])

  // Create a map of slot_index -> slot data for easy lookup
  const slotsMap = useMemo(() => {
    if (!preview) return new Map<number, PreviewSlot>()
    return new Map(preview.slots.map(slot => [slot.slot_index, slot]))
  }, [preview])

  // Calculate total commercials for the day
  const totalCommercials = useMemo(() => {
    if (!preview) return 0
    return preview.slots.reduce((sum, slot) => {
      return sum + slot.commercials.reduce((s, c) => s + c.play_count, 0)
    }, 0)
  }, [preview])

  // Check if selected date is today
  const isToday = selectedDate === formatLocalDate(new Date())

  // Current time slot highlight
  const currentSlotIndex = useMemo(() => {
    if (!isToday) return -1
    const now = new Date()
    return now.getHours() * 2 + Math.floor(now.getMinutes() / 30)
  }, [isToday])

  return (
    <div className="glass-card p-4 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-primary-400" />
          <h3 className="font-medium text-dark-100">
            {isRTL ? 'תצוגה מקדימה יומית' : 'Daily Preview'}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-1.5 glass-button"
            title={isRTL ? 'רענן' : 'Refresh'}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Today button */}
          {!isToday && (
            <button
              onClick={goToToday}
              className="px-2 py-1 text-xs glass-button"
            >
              {isRTL ? 'היום' : 'Today'}
            </button>
          )}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-4 bg-dark-800/30 rounded-lg p-2">
        <button
          onClick={() => goToDate(-1)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="text-center">
          <p className="text-sm font-medium text-dark-100">{displayDate}</p>
          {preview && (
            <p className="text-xs text-dark-400">
              {totalCommercials} {isRTL ? 'השמעות מתוכננות' : 'scheduled plays'}
            </p>
          )}
        </div>

        <button
          onClick={() => goToDate(1)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary-400" />
        </div>
      ) : (
        <div className="relative">
          {/* Hour labels */}
          <div className="flex text-[10px] text-dark-500 mb-1">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="flex-1 text-center">
                {i.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Timeline bar */}
          <div className="relative h-16 bg-dark-800/50 rounded-lg overflow-hidden">
            {/* Hour grid lines */}
            <div className="absolute inset-0 flex">
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-white/5 last:border-r-0"
                />
              ))}
            </div>

            {/* Scheduled slots */}
            {Array.from({ length: 48 }, (_, slotIndex) => {
              const slot = slotsMap.get(slotIndex)
              if (!slot || slot.commercials.length === 0) {
                // Check if this is current time slot
                if (slotIndex === currentSlotIndex) {
                  return (
                    <div
                      key={slotIndex}
                      className="absolute top-0 bottom-0 w-[2.083%] bg-primary-500/20"
                      style={{ left: `${(slotIndex / 48) * 100}%` }}
                    />
                  )
                }
                return null
              }

              const totalPlays = slot.commercials.reduce((s, c) => s + c.play_count, 0)
              const highestPriority = Math.max(...slot.commercials.map(c => c.priority))
              const isCurrentSlot = slotIndex === currentSlotIndex

              return (
                <div
                  key={slotIndex}
                  className={`
                    absolute top-1 bottom-1 w-[2.083%] rounded
                    ${getPriorityBgColor(highestPriority)}
                    ${isCurrentSlot ? 'ring-2 ring-primary-400' : ''}
                    group cursor-pointer hover:opacity-80 transition-opacity
                  `}
                  style={{ left: `${(slotIndex / 48) * 100}%` }}
                >
                  {/* Intensity indicator based on play count */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 ${getPriorityColor(highestPriority)} rounded-b transition-all`}
                    style={{ height: `${Math.min(100, totalPlays * 25)}%` }}
                  />

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                    <div className="glass-card p-2 rounded-lg shadow-lg text-xs whitespace-nowrap">
                      <p className="font-medium text-dark-100 mb-1">{slot.time}</p>
                      {slot.commercials.map((commercial, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-dark-300">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(commercial.priority)}`} />
                          <span>{commercial.name}</span>
                          <span className="text-dark-500">×{commercial.play_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Current time indicator */}
            {isToday && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary-500 z-10"
                style={{
                  left: `${((new Date().getHours() * 60 + new Date().getMinutes()) / 1440) * 100}%`,
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary-500 rounded-full" />
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-dark-400">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500/50" />
              <span>{isRTL ? 'עדיפות 8-9' : 'Priority 8-9'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500/50" />
              <span>{isRTL ? 'עדיפות 6-7' : 'Priority 6-7'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500/50" />
              <span>{isRTL ? 'עדיפות 4-5' : 'Priority 4-5'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500/50" />
              <span>{isRTL ? 'עדיפות 1-3' : 'Priority 1-3'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && preview && preview.slots.length === 0 && (
        <div className="text-center py-6 text-dark-400">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {isRTL ? 'אין פרסומות מתוזמנות ליום זה' : 'No commercials scheduled for this day'}
          </p>
        </div>
      )}
    </div>
  )
}

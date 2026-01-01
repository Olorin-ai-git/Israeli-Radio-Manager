import { useMemo, useCallback, useState, useRef, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { WeeklySlot, getSlotPlayCount, slotIndexToTime, formatSlotDate } from '../../store/campaignStore'
import { toast } from '../../store/toastStore'

export interface CampaignSlotInfo {
  campaignId: string
  campaignName: string
  playCount: number
  priority: number
}

interface ScheduleHeatmapProps {
  grid: WeeklySlot[] // Aggregated grid showing all campaigns
  selectedCampaignGrid?: WeeklySlot[] // Grid for selected campaign (for editing)
  selectedCampaignId?: string | null // ID of currently selected campaign
  selectedCampaignStartDate?: string | null // Start date of selected campaign (YYYY-MM-DD)
  selectedCampaignEndDate?: string | null // End date of selected campaign (YYYY-MM-DD)
  // Function to get per-campaign breakdown for a slot
  getCampaignBreakdown?: (slotDate: string, slotIndex: number) => CampaignSlotInfo[]
  onIncrement?: (slotDate: string, slotIndex: number) => void
  onDecrement?: (slotDate: string, slotIndex: number) => void
  readOnly?: boolean
  highlightCurrentSlot?: boolean
  baseDate?: Date // Start of week for showing dates in headers
  onRowClick?: (slotIndex: number) => void // Click on row header to filter
  activeRowFilter?: number | null // Currently filtered row index
  onPlaySlot?: (slotDate: string, slotIndex: number) => void // Play preview for slot
  isPlayingSlot?: { slotDate: string; slotIndex: number } | null // Currently playing slot
  onWeekChange?: (direction: 'prev' | 'next') => void // Navigate between weeks
  initialScrollTop?: number // Initial scroll position to restore
  onScrollChange?: (scrollTop: number) => void // Report scroll position changes
}

// Day labels
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_HE = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\'']

// Get heatmap color based on play count
const getHeatmapColor = (count: number): string => {
  if (count === 0) return 'bg-dark-700/30 hover:bg-dark-600/40'
  if (count === 1) return 'bg-primary-500/30 hover:bg-primary-500/40'
  if (count === 2) return 'bg-primary-500/50 hover:bg-primary-500/60'
  if (count === 3) return 'bg-primary-500/70 hover:bg-primary-500/80'
  if (count === 4) return 'bg-primary-500/85 hover:bg-primary-500/90'
  return 'bg-primary-500 hover:bg-primary-400' // 5+
}

// Get text color based on count
const getTextColor = (count: number): string => {
  if (count === 0) return 'text-dark-500'
  if (count <= 2) return 'text-dark-100'
  return 'text-white'
}

// Get the Sunday of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function ScheduleHeatmap({
  grid,
  selectedCampaignGrid,
  selectedCampaignId,
  selectedCampaignStartDate,
  selectedCampaignEndDate,
  getCampaignBreakdown,
  onIncrement,
  onDecrement,
  readOnly = false,
  highlightCurrentSlot = false,
  baseDate,
  onRowClick,
  activeRowFilter,
  onPlaySlot,
  isPlayingSlot,
  onWeekChange,
  initialScrollTop,
  onScrollChange,
}: ScheduleHeatmapProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const dayLabels = isRTL ? DAY_LABELS_HE : DAY_LABELS_EN

  // Track hovered cell for showing +/- controls
  const [hoveredCell, setHoveredCell] = useState<{ day: number; slot: number } | null>(null)
  // Track hovered row for highlighting
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  // Track last toast time to avoid spamming
  const lastToastTime = useRef<number>(0)
  // Scroll container ref for preserving scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Restore scroll position on mount
  useLayoutEffect(() => {
    if (scrollContainerRef.current && initialScrollTop !== undefined) {
      scrollContainerRef.current.scrollTop = initialScrollTop
    }
  }, []) // Only run on mount

  // Report scroll changes to parent
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && onScrollChange) {
      onScrollChange(scrollContainerRef.current.scrollTop)
    }
  }, [onScrollChange])

  // Calculate week dates for headers
  const weekDates = useMemo(() => {
    const start = baseDate ? getWeekStart(baseDate) : getWeekStart(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [baseDate])

  // Calculate which days are within the selected campaign's date range
  // Returns { startDayIndex, endDayIndex, isBeforeStart, isAfterEnd } for each day
  const campaignDateBoundaries = useMemo(() => {
    if (!selectedCampaignStartDate || !selectedCampaignEndDate) {
      return null
    }

    // Parse campaign dates (YYYY-MM-DD format)
    const [startYear, startMonth, startDay] = selectedCampaignStartDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = selectedCampaignEndDate.split('-').map(Number)
    const campaignStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0)
    const campaignEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)

    // For each day of the week, determine if it's within the campaign range
    const dayStatuses = weekDates.map((date, dayIndex) => {
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)

      const isBeforeStart = dayEnd < campaignStart
      const isAfterEnd = dayStart > campaignEnd
      const isStartDay = dayStart.getTime() === campaignStart.getTime()
      const isEndDay = dayStart.toDateString() === campaignEnd.toDateString()

      return {
        dayIndex,
        isBeforeStart,
        isAfterEnd,
        isWithinRange: !isBeforeStart && !isAfterEnd,
        isStartDay,
        isEndDay,
      }
    })

    return dayStatuses
  }, [selectedCampaignStartDate, selectedCampaignEndDate, weekDates])

  // Format date for header (uses browser's locale)
  const formatHeaderDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'numeric',
    })
  }

  // Generate time slot labels (48 slots: 00:00 to 23:30)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let i = 0; i < 48; i++) {
      slots.push({
        index: i,
        label: slotIndexToTime(i),
      })
    }
    return slots
  }, [])

  // Get current slot for highlighting
  const currentSlot = useMemo(() => {
    if (!highlightCurrentSlot) return null
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sunday
    const hour = now.getHours()
    const minute = now.getMinutes()
    const slotIndex = hour * 2 + (minute >= 30 ? 1 : 0)
    return { dayOfWeek, slotIndex }
  }, [highlightCurrentSlot])

  // Check if a specific slot is in the past (for blocking edits on past slots)
  const isSlotInPast = useCallback((dayOfWeek: number, slotIndex: number): boolean => {
    const now = new Date()
    const slotDate = weekDates[dayOfWeek]
    if (!slotDate) return false

    // Create a date for this slot
    const slotDateTime = new Date(slotDate)
    const hours = Math.floor(slotIndex / 2)
    const minutes = (slotIndex % 2) * 30
    slotDateTime.setHours(hours, minutes, 0, 0)

    return slotDateTime < now
  }, [weekDates])

  // Handle cell click - toggle behavior for SELECTED campaign (0 -> 1, >0 -> 0)
  const handleCellClick = useCallback(
    (dayIndex: number, slotIndex: number) => {
      if (readOnly) return

      const slotDate = formatSlotDate(weekDates[dayIndex])

      // Check if the slot is in the past
      if (isSlotInPast(dayIndex, slotIndex)) {
        const now = Date.now()
        if (now - lastToastTime.current > 3000) {
          lastToastTime.current = now
          toast.warning(
            isRTL
              ? 'לא ניתן לתזמן משבצות בעבר'
              : 'Cannot schedule slots in the past'
          )
        }
        return // Block the action
      }

      // Check if the day is outside the campaign date range
      if (campaignDateBoundaries) {
        const dayStatus = campaignDateBoundaries[dayIndex]
        if (dayStatus && (dayStatus.isBeforeStart || dayStatus.isAfterEnd)) {
          // Show toast warning (rate-limited)
          const now = Date.now()
          if (now - lastToastTime.current > 3000) {
            lastToastTime.current = now
            if (dayStatus.isBeforeStart) {
              toast.warning(
                isRTL
                  ? 'לא ניתן לתזמן לפני תאריך תחילת הקמפיין'
                  : 'Cannot schedule before campaign start date'
              )
            } else {
              toast.warning(
                isRTL
                  ? 'לא ניתן לתזמן אחרי תאריך סיום הקמפיין'
                  : 'Cannot schedule after campaign end date'
              )
            }
          }
          return // Block the action
        }
      }

      // Use selectedCampaignGrid for toggle logic (not aggregated grid)
      const gridToCheck = selectedCampaignGrid || grid
      const count = getSlotPlayCount(gridToCheck, slotDate, slotIndex)
      if (count === 0) {
        onIncrement?.(slotDate, slotIndex)
      } else {
        onDecrement?.(slotDate, slotIndex)
      }
    },
    [readOnly, onIncrement, onDecrement, grid, selectedCampaignGrid, campaignDateBoundaries, isRTL, isSlotInPast, weekDates]
  )

  // Prevent context menu on right click
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
    },
    []
  )

  // Get total plays per day (for the current week)
  const dailyTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    weekDates.forEach((date, dayIndex) => {
      const dateStr = formatSlotDate(date)
      grid.forEach(slot => {
        if (slot.slot_date === dateStr) {
          totals[dayIndex] += slot.play_count
        }
      })
    })
    return totals
  }, [grid, weekDates])

  // Check if a row is actively filtered
  const isRowFiltered = (slotIndex: number) => {
    return activeRowFilter === slotIndex
  }

  // Format week range for display (uses browser's locale)
  const weekRangeLabel = useMemo(() => {
    const startDate = weekDates[0]
    const endDate = weekDates[6]
    const formatDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }, [weekDates])

  return (
    <div className="relative">
      {/* Week navigation and Legend */}
      <div className="flex items-center justify-between mb-3">
        {/* Week navigation */}
        {onWeekChange && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onWeekChange('prev')}
              className="p-1.5 rounded hover:bg-white/10 text-dark-400 hover:text-dark-200 transition-colors"
              title={isRTL ? 'שבוע קודם' : 'Previous week'}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-dark-300 font-medium min-w-[80px] text-center">
              {weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => onWeekChange('next')}
              className="p-1.5 rounded hover:bg-white/10 text-dark-400 hover:text-dark-200 transition-colors"
              title={isRTL ? 'שבוע הבא' : 'Next week'}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <span>{isRTL ? 'פחות' : 'Less'}</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-dark-700/30" />
            <div className="w-4 h-4 rounded bg-primary-500/30" />
            <div className="w-4 h-4 rounded bg-primary-500/50" />
            <div className="w-4 h-4 rounded bg-primary-500/70" />
            <div className="w-4 h-4 rounded bg-primary-500" />
          </div>
          <span>{isRTL ? 'יותר' : 'More'}</span>
        </div>
      </div>

      {/* Grid container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-auto max-h-[600px] scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-dark-800"
      >
        <table className="w-full border-collapse text-xs">
          {/* Header row - days */}
          <thead className="sticky top-0 z-10 bg-dark-900">
            <tr>
              <th className="w-16 p-1 text-dark-400 font-medium text-center bg-dark-900 sticky left-0 z-20">
                {isRTL ? 'שעה' : 'Time'}
              </th>
              {dayLabels.map((day, idx) => (
                <th
                  key={idx}
                  className="p-1 text-dark-200 font-medium text-center bg-dark-900 min-w-[60px]"
                >
                  <div>{day}</div>
                  <div className="text-[10px] text-dark-400 font-normal">
                    {formatHeaderDate(weekDates[idx])}
                  </div>
                  <div className="text-[10px] text-dark-500 mt-0.5">
                    {dailyTotals[idx] > 0 && `(${dailyTotals[idx]})`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body - time slots */}
          <tbody>
            {timeSlots.map(slot => {
              const isRowHovered = hoveredRow === slot.index
              const isFiltered = isRowFiltered(slot.index)

              return (
                <tr
                  key={slot.index}
                  className={`
                    border-t border-dark-700/30 transition-colors
                    ${isRowHovered ? 'bg-dark-700/20' : ''}
                    ${isFiltered ? 'bg-primary-500/10' : ''}
                  `}
                  onMouseEnter={() => setHoveredRow(slot.index)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Time label - clickable to filter schedule panel */}
                  <td
                    className={`
                      p-1 text-dark-400 text-center font-mono whitespace-nowrap sticky left-0 z-[5]
                      ${isFiltered ? 'bg-primary-500/20 text-primary-300' : 'bg-dark-900'}
                      ${onRowClick ? 'cursor-pointer hover:text-primary-400 hover:bg-dark-800' : ''}
                      transition-colors
                    `}
                    onClick={() => onRowClick?.(slot.index)}
                    title={isRTL ? 'לחץ לסנן לפי שעה זו' : 'Click to filter by this time'}
                  >
                    {slot.label}
                  </td>

                  {/* Day cells */}
                  {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                    const slotDate = formatSlotDate(weekDates[dayIndex])
                    // Aggregated count (all campaigns)
                    const totalCount = getSlotPlayCount(grid, slotDate, slot.index)
                    // Selected campaign's count (for editing)
                    const selectedCount = selectedCampaignGrid
                      ? getSlotPlayCount(selectedCampaignGrid, slotDate, slot.index)
                      : 0
                    const hasSelectedCampaignSlot = selectedCount > 0
                    const isCurrentSlot =
                      currentSlot?.dayOfWeek === dayIndex &&
                      currentSlot?.slotIndex === slot.index
                    const isHovered = hoveredCell?.day === dayIndex && hoveredCell?.slot === slot.index

                    // Get per-campaign breakdown for tooltip
                    const campaignBreakdown = getCampaignBreakdown?.(slotDate, slot.index) || []

                    // Check if this day is outside the selected campaign's date range
                    const dayBoundary = campaignDateBoundaries?.[dayIndex]
                    const isOutsideCampaignRange = dayBoundary && (dayBoundary.isBeforeStart || dayBoundary.isAfterEnd)
                    const isEndDay = dayBoundary?.isEndDay
                    const isStartDay = dayBoundary?.isStartDay

                    // Check if slot is in the past
                    const isPastSlot = isSlotInPast(dayIndex, slot.index)
                    const isDisabledSlot = isOutsideCampaignRange || isPastSlot

                    return (
                      <td key={dayIndex} className="p-0.5 relative">
                        <div
                          className="relative tooltip-trigger"
                          onMouseEnter={() => setHoveredCell({ day: dayIndex, slot: slot.index })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => {
                            if (readOnly) {
                              // Show toast only once every 3 seconds to avoid spam
                              const now = Date.now()
                              if (now - lastToastTime.current > 3000) {
                                lastToastTime.current = now
                                toast.info(
                                  isRTL
                                    ? 'יש לבחור קמפיין מהרשימה כדי לערוך את לוח הזמנים'
                                    : 'Select a campaign from the list to edit its schedule'
                                )
                              }
                            } else {
                              handleCellClick(dayIndex, slot.index)
                            }
                          }}
                          onContextMenu={handleContextMenu}
                        >
                          {/* Main cell display */}
                          <div
                            className={`
                              w-full h-7 rounded transition-all
                              ${isDisabledSlot
                                ? 'bg-dark-800/50 text-dark-600 cursor-not-allowed'
                                : `${getHeatmapColor(totalCount)} ${getTextColor(totalCount)}`
                              }
                              ${isCurrentSlot ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-dark-900' : ''}
                              ${hasSelectedCampaignSlot && !isDisabledSlot ? 'ring-1 ring-white/40' : ''}
                              ${!readOnly && !isDisabledSlot ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                              flex items-center justify-center text-[11px] font-semibold
                            `}
                          >
                            {totalCount > 0 ? totalCount : ''}
                          </div>

                          {/* Vertical line indicator for campaign end day */}
                          {isEndDay && (
                            <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-orange-500/80 z-10" />
                          )}

                          {/* Vertical line indicator for campaign start day */}
                          {isStartDay && (
                            <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-green-500/80 z-10" />
                          )}

                          {/* Selected campaign indicator dot - only show when not disabled */}
                          {hasSelectedCampaignSlot && !isDisabledSlot && (
                            <div className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-white shadow-sm" />
                          )}

                          {/* Custom tooltip with per-campaign breakdown */}
                          <div className="tooltip tooltip-top !whitespace-normal !w-48">
                            <div className="font-medium mb-1">
                              {dayLabels[dayIndex]} {formatHeaderDate(weekDates[dayIndex])} {slot.label}
                            </div>
                            {campaignBreakdown.length > 0 ? (
                              <div className="space-y-1">
                                {campaignBreakdown.map((info, idx) => (
                                  <div
                                    key={idx}
                                    className={`flex items-center justify-between text-[10px] ${
                                      info.campaignId === selectedCampaignId
                                        ? 'text-primary-300 font-medium'
                                        : 'text-dark-300'
                                    }`}
                                  >
                                    <span className="truncate mr-2" dir="auto">
                                      {info.campaignName}
                                    </span>
                                    <span className="flex-shrink-0">×{info.playCount}</span>
                                  </div>
                                ))}
                                <div className="border-t border-white/10 pt-1 mt-1 flex justify-between text-[10px] font-medium">
                                  <span>{isRTL ? 'סה"כ' : 'Total'}</span>
                                  <span>{totalCount}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-dark-400">
                                {isRTL ? 'אין פרסומות' : 'No commercials'}
                              </div>
                            )}
                          </div>

                          {/* Increment/Decrement controls on hover - only show if not disabled */}
                          {!readOnly && isHovered && !isDisabledSlot && (
                            <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  onIncrement?.(slotDate, slot.index)
                                }}
                                className="w-4 h-4 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-lg"
                              >
                                <Plus size={10} className="text-white" />
                              </button>
                              {selectedCount > 0 && (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation()
                                    onDecrement?.(slotDate, slot.index)
                                  }}
                                  className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg"
                                >
                                  <Minus size={10} className="text-white" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Play preview button on hover (only in readOnly mode to not interfere with editing) */}
                          {readOnly && isHovered && totalCount > 0 && onPlaySlot && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                onPlaySlot(slotDate, slot.index)
                              }}
                              className={`
                                absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg z-20
                                ${isPlayingSlot?.slotDate === slotDate && isPlayingSlot?.slotIndex === slot.index
                                  ? 'bg-yellow-500 animate-pulse'
                                  : 'bg-blue-500 hover:bg-blue-400'
                                }
                              `}
                              title={isRTL ? 'נגן תצוגה מקדימה' : 'Play preview'}
                            >
                              <Play size={10} className="text-white ml-0.5" />
                            </button>
                          )}

                          {/* Playing indicator (when not hovering but currently playing, only in readOnly mode) */}
                          {readOnly && !isHovered && isPlayingSlot?.slotDate === slotDate && isPlayingSlot?.slotIndex === slot.index && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg z-20 animate-pulse">
                              <Play size={10} className="text-white ml-0.5" />
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Instructions */}
      {!readOnly && (
        <div className="mt-2 text-xs text-dark-500 text-center">
          {isRTL
            ? 'לחץ למתג הפעלה/כיבוי | השתמש ב +/- לשינוי כמות | לחץ על שעה לפרטים'
            : 'Click to toggle on/off | Use +/- for count | Click time for details'}
        </div>
      )}

      {/* Summary */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-dark-400">
          {isRTL ? 'סה"כ בשבוע:' : 'Weekly total:'}{' '}
          <span className="font-semibold text-dark-200">
            {grid.reduce((sum, slot) => sum + slot.play_count, 0)}
          </span>
        </div>
        <div className="text-dark-400">
          {isRTL ? 'משבצות פעילות:' : 'Active slots:'}{' '}
          <span className="font-semibold text-dark-200">
            {grid.filter(s => s.play_count > 0).length}
          </span>
        </div>
      </div>
    </div>
  )
}

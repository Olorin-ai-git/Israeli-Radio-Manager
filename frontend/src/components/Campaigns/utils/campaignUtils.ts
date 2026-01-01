import { Campaign, WeeklySlot, formatSlotDate } from '../../../store/campaignStore'

export const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LABELS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// Get the Sunday (start) of the week containing the given date
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get the Saturday (end) of the week containing the given date
export function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

// Check if a campaign is active during a specific week
export function isCampaignActiveInWeek(campaign: Campaign, weekStart: Date, weekEnd: Date): boolean {
  const [startYear, startMonth, startDay] = campaign.start_date.split('-').map(Number)
  const [endYear, endMonth, endDay] = campaign.end_date.split('-').map(Number)

  const campaignStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0)
  const campaignEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)

  return campaignStart <= weekEnd && campaignEnd >= weekStart
}

// Get week dates array (7 dates for Sun-Sat)
export function getWeekDates(displayedWeekDate: Date): string[] {
  const weekStart = getWeekStart(displayedWeekDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return formatSlotDate(d)
  })
}

// Calculate aggregated grid from all campaigns for a specific week
export function calculateAggregatedGrid(
  campaigns: Campaign[],
  selectedCampaignId: string | null,
  editingGrid: WeeklySlot[],
  editingGrids: Map<string, WeeklySlot[]>,
  displayedWeekDate: Date
): WeeklySlot[] {
  const weekStart = getWeekStart(displayedWeekDate)
  const weekEnd = getWeekEnd(displayedWeekDate)
  const weekDates = getWeekDates(displayedWeekDate)

  const aggregated = new Map<string, number>()

  campaigns.forEach(campaign => {
    if (campaign.status !== 'active') return
    if (!isCampaignActiveInWeek(campaign, weekStart, weekEnd)) return

    let gridToUse: WeeklySlot[]
    if (campaign._id === selectedCampaignId) {
      gridToUse = editingGrid
    } else {
      const pendingGrid = editingGrids.get(campaign._id)
      gridToUse = pendingGrid !== undefined ? pendingGrid : campaign.schedule_grid
    }

    gridToUse.forEach(slot => {
      if (weekDates.includes(slot.slot_date)) {
        const key = `${slot.slot_date}_${slot.slot_index}`
        aggregated.set(key, (aggregated.get(key) || 0) + slot.play_count)
      }
    })
  })

  const result: WeeklySlot[] = []
  aggregated.forEach((count, key) => {
    const [date, slot] = key.split('_')
    if (count > 0) {
      result.push({ slot_date: date, slot_index: parseInt(slot), play_count: count })
    }
  })

  return result
}

// Helper to create a unique key for a slot
export function getSlotKey(slotDate: string, slotIndex: number): string {
  return `${slotDate}_${slotIndex}`
}

// Get scheduled slots for a campaign filtered by week and optionally by slot index
export function getScheduledSlotsForCampaign(
  editingGrid: WeeklySlot[],
  heatmapBaseDate: Date,
  filterSlotIndex: number | null,
  dayLabels: string[]
): Array<{
  slotDate: string
  slotIndex: number
  playCount: number
  timeLabel: string
  dayLabel: string
}> {
  const weekDates = getWeekDates(heatmapBaseDate)
  const slots: Array<{
    slotDate: string
    slotIndex: number
    playCount: number
    timeLabel: string
    dayLabel: string
  }> = []

  // Import slotIndexToTime dynamically to avoid circular deps
  const slotIndexToTime = (index: number): string => {
    const hours = Math.floor(index / 2)
    const minutes = (index % 2) * 30
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  editingGrid.forEach(slot => {
    if (slot.play_count <= 0) return
    if (!weekDates.includes(slot.slot_date)) return
    if (filterSlotIndex !== null && slot.slot_index !== filterSlotIndex) return

    const [year, month, day] = slot.slot_date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()

    slots.push({
      slotDate: slot.slot_date,
      slotIndex: slot.slot_index,
      playCount: slot.play_count,
      timeLabel: slotIndexToTime(slot.slot_index),
      dayLabel: dayLabels[dayOfWeek],
    })
  })

  return slots.sort((a, b) => {
    if (a.slotDate !== b.slotDate) return a.slotDate.localeCompare(b.slotDate)
    return a.slotIndex - b.slotIndex
  })
}

// Get slot overview for all campaigns at a specific time
export function getSlotOverviewForTime(
  campaigns: Campaign[],
  selectedCampaignId: string | null,
  editingGrid: WeeklySlot[],
  editingGrids: Map<string, WeeklySlot[]>,
  filterSlotIndex: number,
  filterSlotDate: string | null,
  heatmapBaseDate: Date,
  dayLabels: string[]
): Array<{
  campaign: Campaign
  slotDate: string
  dayLabel: string
  playCount: number
}> {
  const weekStart = getWeekStart(heatmapBaseDate)
  const weekEnd = getWeekEnd(heatmapBaseDate)
  const weekDates = getWeekDates(heatmapBaseDate)

  const overview: Array<{
    campaign: Campaign
    slotDate: string
    dayLabel: string
    playCount: number
  }> = []

  campaigns.forEach(campaign => {
    if (!isCampaignActiveInWeek(campaign, weekStart, weekEnd)) return

    let gridToUse: WeeklySlot[]
    if (campaign._id === selectedCampaignId) {
      gridToUse = editingGrid
    } else {
      const pendingGrid = editingGrids.get(campaign._id)
      gridToUse = pendingGrid !== undefined ? pendingGrid : campaign.schedule_grid
    }

    gridToUse.forEach(slot => {
      if (slot.slot_index !== filterSlotIndex || slot.play_count <= 0) return
      if (!weekDates.includes(slot.slot_date)) return
      if (filterSlotDate && slot.slot_date !== filterSlotDate) return

      const [year, month, day] = slot.slot_date.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()

      overview.push({
        campaign,
        slotDate: slot.slot_date,
        dayLabel: dayLabels[dayOfWeek],
        playCount: slot.play_count,
      })
    })
  })

  return overview.sort((a, b) => {
    if (a.slotDate !== b.slotDate) return a.slotDate.localeCompare(b.slotDate)
    return b.campaign.priority - a.campaign.priority
  })
}

// Filter future slots only
export function filterFutureSlots(
  slots: Array<{ slotDate: string; slotIndex: number; playCount: number; timeLabel: string; dayLabel: string }>
): typeof slots {
  const now = new Date()
  const todayStr = formatSlotDate(now)
  const currentSlotIndex = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30)

  return slots.filter(slot => {
    if (slot.slotDate > todayStr) return true
    if (slot.slotDate === todayStr && slot.slotIndex > currentSlotIndex) return true
    return false
  })
}

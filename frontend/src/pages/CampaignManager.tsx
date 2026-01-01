import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Clock,
  FileAudio,
  Copy,
  ChevronDown,
  AlertTriangle,
  Square,
} from 'lucide-react'
import {
  useCampaignStore,
  Campaign,
  CampaignCreate,
  CampaignStatus,
  WeeklySlot,
  getSlotPlayCount,
  slotIndexToTime,
  formatSlotDate,
} from '../store/campaignStore'
import { api } from '../services/api'
import CampaignCard from '../components/Campaigns/CampaignCard'
import CampaignFormModal from '../components/Campaigns/CampaignFormModal'
import ScheduleHeatmap, { CampaignSlotInfo } from '../components/Campaigns/ScheduleHeatmap'

const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// Get the Sunday (start) of the week containing the given date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get the Saturday (end) of the week containing the given date
function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

// Check if a campaign is active during a specific week
function isCampaignActiveInWeek(campaign: Campaign, weekStart: Date, weekEnd: Date): boolean {
  // Parse dates carefully - campaign dates are in YYYY-MM-DD format
  const [startYear, startMonth, startDay] = campaign.start_date.split('-').map(Number)
  const [endYear, endMonth, endDay] = campaign.end_date.split('-').map(Number)

  const campaignStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0)
  const campaignEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)

  // Campaign overlaps with week if: campaign starts before week ends AND campaign ends after week starts
  return campaignStart <= weekEnd && campaignEnd >= weekStart
}

// Get week dates array (7 dates for Sun-Sat)
function getWeekDates(displayedWeekDate: Date): string[] {
  const weekStart = getWeekStart(displayedWeekDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return formatSlotDate(d)
  })
}

// Calculate aggregated grid from all campaigns for a specific week
function calculateAggregatedGrid(
  campaigns: Campaign[],
  selectedCampaignId: string | null,
  editingGrid: WeeklySlot[],
  editingGrids: Map<string, WeeklySlot[]>,
  displayedWeekDate: Date
): WeeklySlot[] {
  const weekStart = getWeekStart(displayedWeekDate)
  const weekEnd = getWeekEnd(displayedWeekDate)
  const weekDates = getWeekDates(displayedWeekDate)

  // Create a map for quick lookup: "date_slot" -> total count
  const aggregated = new Map<string, number>()

  // Add all campaigns' schedules (only if active during displayed week)
  campaigns.forEach(campaign => {
    // Skip campaigns not active during this week
    if (!isCampaignActiveInWeek(campaign, weekStart, weekEnd)) {
      return
    }

    // Priority: selected campaign uses editingGrid, others check editingGrids map, fallback to schedule_grid
    let gridToUse: WeeklySlot[]
    if (campaign._id === selectedCampaignId) {
      gridToUse = editingGrid
    } else {
      // Check if there are pending changes in editingGrids map
      const pendingGrid = editingGrids.get(campaign._id)
      gridToUse = pendingGrid !== undefined ? pendingGrid : campaign.schedule_grid
    }

    gridToUse.forEach(slot => {
      // Only include slots that fall within this week
      if (weekDates.includes(slot.slot_date)) {
        const key = `${slot.slot_date}_${slot.slot_index}`
        aggregated.set(key, (aggregated.get(key) || 0) + slot.play_count)
      }
    })
  })

  // Convert back to WeeklySlot array
  const result: WeeklySlot[] = []
  aggregated.forEach((count, key) => {
    const [date, slot] = key.split('_')
    if (count > 0) {
      result.push({ slot_date: date, slot_index: parseInt(slot), play_count: count })
    }
  })

  return result
}

export default function CampaignManager() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  // Store state
  const {
    campaigns,
    selectedCampaign,
    editingGrid,
    editingGrids,
    isDirty,
    isLoading,
    isSaving,
    error,
    fetchCampaigns,
    selectCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaignStatus,
    incrementSlot,
    decrementSlot,
    setEditingGrid,
    saveAllGrids,
    resetGrid,
    syncToCalendar,
    clearError,
    hasAnyUnsavedChanges,
    getUnsavedCampaignIds,
    dirtyGrids,
  } = useCampaignStore()

  // Local state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showCopyDropdown, setShowCopyDropdown] = useState(false)

  // Audio preview state
  const [playingSlot, setPlayingSlot] = useState<{ slotDate: string; slotIndex: number } | null>(null)
  const [playQueue, setPlayQueue] = useState<string[]>([]) // Queue of content IDs to play
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [rightPanelWidth, setRightPanelWidth] = useState(288) // 72 * 4 = 288 (w-72)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)

  // Week navigation state (offset from current week)
  const [weekOffset, setWeekOffset] = useState(0)

  // Heatmap scroll position (preserved across week changes)
  const heatmapScrollTop = useRef(0)

  // Left panel collapsed state
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)

  // Draggable splitter state
  const isDraggingLeft = useRef(false)
  const isDraggingRight = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const heatmapContainerRef = useRef<HTMLDivElement>(null)

  // Get user role
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  })
  const isAdmin = currentUser?.role === 'admin'

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyUnsavedChanges()) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasAnyUnsavedChanges])

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (statusFilter === 'all') return true
    return c.status === statusFilter
  })

  // Handle campaign creation
  const handleCreateCampaign = useCallback(
    async (data: CampaignCreate) => {
      const campaign = await createCampaign(data)
      if (campaign) {
        setShowFormModal(false)
        selectCampaign(campaign)
      }
    },
    [createCampaign, selectCampaign]
  )

  // Handle campaign update
  const handleUpdateCampaign = useCallback(
    async (data: CampaignCreate) => {
      if (!editingCampaign) return
      const campaign = await updateCampaign(editingCampaign._id, data)
      if (campaign) {
        setShowFormModal(false)
        setEditingCampaign(null)
      }
    },
    [editingCampaign, updateCampaign]
  )

  // Handle delete confirmation
  const handleDeleteCampaign = useCallback(
    async (campaignId: string) => {
      const success = await deleteCampaign(campaignId)
      if (success) {
        setConfirmDelete(null)
      }
    },
    [deleteCampaign]
  )

  // Handle grid save - saves ALL pending changes
  const handleSaveAll = useCallback(async () => {
    await saveAllGrids()
  }, [saveAllGrids])

  // Stop audio playback
  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlayingSlot(null)
    setPlayQueue([])
  }, [])

  // Handle playing next item in queue
  useEffect(() => {
    if (playQueue.length === 0) {
      if (playingSlot) {
        setPlayingSlot(null)
      }
      return
    }

    const currentContentId = playQueue[0]
    const streamUrl = api.getStreamUrl(currentContentId)

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current

    const handleEnded = () => {
      // Remove played item and continue with next
      setPlayQueue(prev => prev.slice(1))
    }

    const handleError = () => {
      console.error('Audio playback error, skipping to next')
      setPlayQueue(prev => prev.slice(1))
    }

    audio.src = streamUrl
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.play().catch(err => {
      console.error('Play error:', err)
      setPlayQueue(prev => prev.slice(1))
    })

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [playQueue, playingSlot])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  // Handle play slot - gather all commercials for the slot and play sequentially
  const handlePlaySlot = useCallback((slotDate: string, slotIndex: number) => {
    // If already playing this slot, stop
    if (playingSlot?.slotDate === slotDate && playingSlot?.slotIndex === slotIndex) {
      stopPlayback()
      return
    }

    // Stop any current playback
    stopPlayback()

    // Gather all content IDs from all campaigns scheduled for this slot
    const contentIds: string[] = []
    const campaignsForSlot: Array<{ campaign: Campaign; playCount: number }> = []

    campaigns.forEach(campaign => {
      // Only include active campaigns
      if (campaign.status !== 'active') return

      const count = getSlotPlayCount(campaign.schedule_grid, slotDate, slotIndex)
      if (count > 0) {
        campaignsForSlot.push({ campaign, playCount: count })
      }
    })

    // Sort by priority (highest first)
    campaignsForSlot.sort((a, b) => b.campaign.priority - a.campaign.priority)

    // Build the queue: add each campaign's content refs according to play count
    campaignsForSlot.forEach(({ campaign, playCount }) => {
      for (let i = 0; i < playCount; i++) {
        campaign.content_refs.forEach(ref => {
          if (ref.content_id) {
            contentIds.push(ref.content_id)
          }
        })
      }
    })

    if (contentIds.length === 0) {
      return
    }

    setPlayingSlot({ slotDate, slotIndex })
    setPlayQueue(contentIds)
  }, [campaigns, playingSlot, stopPlayback])

  // Draggable splitter handlers - left splitter (between campaign list and heatmap)
  const handleLeftSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingLeft.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // Draggable splitter handlers - right splitter (between heatmap and slot details)
  const handleRightSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRight.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      if (isDraggingLeft.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newWidth = e.clientX - containerRect.left
        setLeftPanelWidth(Math.max(200, Math.min(500, newWidth)))
      }

      if (isDraggingRight.current && heatmapContainerRef.current) {
        const heatmapRect = heatmapContainerRef.current.getBoundingClientRect()
        // Right panel width = right edge of heatmap container - mouse position
        const newWidth = heatmapRect.right - e.clientX
        setRightPanelWidth(Math.max(200, Math.min(400, newWidth)))
      }
    }

    const handleMouseUp = () => {
      isDraggingLeft.current = false
      isDraggingRight.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Filter slot index for the schedule details panel (null = show all)
  const [filterSlotIndex, setFilterSlotIndex] = useState<number | null>(null)

  // Day labels (moved up so getScheduledSlots can use it)
  const dayLabels = isRTL ? DAY_LABELS_HE : DAY_LABELS_EN

  // Calculate base date for the heatmap based on week offset (moved up for dependency)
  const heatmapBaseDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + weekOffset * 7)
    return date
  }, [weekOffset])

  // Get selected campaign's scheduled slots for the details panel
  // Filtered by the displayed week
  const getScheduledSlots = useCallback(() => {
    if (!selectedCampaign) return []

    const weekDates = getWeekDates(heatmapBaseDate)

    const slots: Array<{
      slotDate: string
      slotIndex: number
      playCount: number
      timeLabel: string
      dayLabel: string
    }> = []

    editingGrid.forEach(slot => {
      if (slot.play_count > 0) {
        // Only include slots within the displayed week
        if (!weekDates.includes(slot.slot_date)) {
          return
        }
        // If filtering by slot index, only include matching slots
        if (filterSlotIndex !== null && slot.slot_index !== filterSlotIndex) {
          return
        }
        // Get day of week from date for display
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
      }
    })

    // Sort by date, then by slot index
    return slots.sort((a, b) => {
      if (a.slotDate !== b.slotDate) return a.slotDate.localeCompare(b.slotDate)
      return a.slotIndex - b.slotIndex
    })
  }, [selectedCampaign, editingGrid, filterSlotIndex, heatmapBaseDate, dayLabels])

  // Handle row header click - deselect campaign and show all commercials for that slot
  const handleRowClick = useCallback((slotIndex: number) => {
    // Toggle filter - if clicking same slot, clear filter
    if (filterSlotIndex === slotIndex) {
      setFilterSlotIndex(null)
    } else {
      setFilterSlotIndex(slotIndex)
      // Deselect campaign to show overview of all campaigns for this slot
      selectCampaign(null)
      setIsRightPanelOpen(true)
    }
  }, [filterSlotIndex, selectCampaign])

  // Copy schedule from another campaign
  const handleCopySchedule = useCallback((sourceCampaign: Campaign) => {
    setEditingGrid(sourceCampaign.schedule_grid)
    setShowCopyDropdown(false)
  }, [setEditingGrid])

  // Get other campaigns that have schedules (excluding current)
  const campaignsWithSchedules = useMemo(() => {
    return campaigns.filter(c =>
      c._id !== selectedCampaign?._id &&
      c.schedule_grid.length > 0
    )
  }, [campaigns, selectedCampaign?._id])

  // Handle week navigation
  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setWeekOffset(prev => direction === 'next' ? prev + 1 : prev - 1)
  }, [])

  // Handle heatmap scroll changes
  const handleHeatmapScroll = useCallback((scrollTop: number) => {
    heatmapScrollTop.current = scrollTop
  }, [])

  // Get all campaigns' scheduled commercials for a specific slot (for overview mode)
  // Filtered by the displayed week
  const getSlotOverview = useCallback(() => {
    if (filterSlotIndex === null) return []

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
      // Skip campaigns not active during this week
      if (!isCampaignActiveInWeek(campaign, weekStart, weekEnd)) {
        return
      }

      // Priority: selected campaign uses editingGrid, others check editingGrids map, fallback to schedule_grid
      let gridToUse: WeeklySlot[]
      if (campaign._id === selectedCampaign?._id) {
        gridToUse = editingGrid
      } else {
        const pendingGrid = editingGrids.get(campaign._id)
        gridToUse = pendingGrid !== undefined ? pendingGrid : campaign.schedule_grid
      }

      gridToUse.forEach(slot => {
        if (slot.slot_index === filterSlotIndex && slot.play_count > 0 && weekDates.includes(slot.slot_date)) {
          // Get day of week from date for display
          const [year, month, day] = slot.slot_date.split('-').map(Number)
          const date = new Date(year, month - 1, day)
          const dayOfWeek = date.getDay()

          overview.push({
            campaign,
            slotDate: slot.slot_date,
            dayLabel: dayLabels[dayOfWeek],
            playCount: slot.play_count,
          })
        }
      })
    })

    // Sort by date, then by priority
    return overview.sort((a, b) => {
      if (a.slotDate !== b.slotDate) return a.slotDate.localeCompare(b.slotDate)
      return b.campaign.priority - a.campaign.priority
    })
  }, [campaigns, selectedCampaign?._id, editingGrid, editingGrids, filterSlotIndex, heatmapBaseDate, dayLabels])

  const slotOverview = getSlotOverview()

  // Status filter options
  const statusOptions: Array<{ value: CampaignStatus | 'all'; label: string; labelHe: string }> = [
    { value: 'all', label: 'All', labelHe: 'הכל' },
    { value: 'active', label: 'Active', labelHe: 'פעיל' },
    { value: 'paused', label: 'Paused', labelHe: 'מושהה' },
    { value: 'draft', label: 'Draft', labelHe: 'טיוטה' },
    { value: 'completed', label: 'Completed', labelHe: 'הושלם' },
  ]

  const scheduledSlots = getScheduledSlots()

  // Calculate aggregated grid from all campaigns for the displayed week
  const aggregatedGrid = useMemo(() => {
    return calculateAggregatedGrid(
      campaigns,
      selectedCampaign?._id || null,
      editingGrid,
      editingGrids,
      heatmapBaseDate
    )
  }, [campaigns, selectedCampaign?._id, editingGrid, editingGrids, heatmapBaseDate])

  // Get per-campaign breakdown for a specific slot (filtered by displayed week)
  const getCampaignBreakdown = useCallback(
    (slotDate: string, slotIndex: number): CampaignSlotInfo[] => {
      const weekStart = getWeekStart(heatmapBaseDate)
      const weekEnd = getWeekEnd(heatmapBaseDate)
      const breakdown: CampaignSlotInfo[] = []

      campaigns.forEach(campaign => {
        // Skip campaigns not active during this week
        if (!isCampaignActiveInWeek(campaign, weekStart, weekEnd)) {
          return
        }

        // Priority: selected campaign uses editingGrid, others check editingGrids map, fallback to schedule_grid
        let gridToUse: WeeklySlot[]
        if (campaign._id === selectedCampaign?._id) {
          gridToUse = editingGrid
        } else {
          const pendingGrid = editingGrids.get(campaign._id)
          gridToUse = pendingGrid !== undefined ? pendingGrid : campaign.schedule_grid
        }
        const count = getSlotPlayCount(gridToUse, slotDate, slotIndex)

        if (count > 0) {
          breakdown.push({
            campaignId: campaign._id,
            campaignName: isRTL && campaign.name_he ? campaign.name_he : campaign.name,
            playCount: count,
            priority: campaign.priority,
          })
        }
      })

      // Sort by priority (highest first)
      return breakdown.sort((a, b) => b.priority - a.priority)
    },
    [campaigns, selectedCampaign?._id, editingGrid, editingGrids, isRTL, heatmapBaseDate]
  )

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Megaphone className="text-primary-400" size={24} />
          <h1 className="text-xl font-semibold text-dark-100">
            {isRTL ? 'מנהל קמפיינים' : 'Campaign Manager'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as CampaignStatus | 'all')}
            className="glass-input text-sm py-1.5 pl-8 pr-3"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {isRTL ? opt.labelHe : opt.label}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => fetchCampaigns()}
            disabled={isLoading}
            className="glass-button p-2"
            title={isRTL ? 'רענן' : 'Refresh'}
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Add Campaign */}
          <button
            onClick={() => {
              setEditingCampaign(null)
              setShowFormModal(true)
            }}
            className="glass-button-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus size={18} />
            <span>{isRTL ? 'קמפיין חדש' : 'New Campaign'}</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Unsaved changes warning banner */}
      {dirtyGrids.size > 0 && (
        <div className="mx-6 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
          <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-yellow-400 text-sm font-medium">
              {isRTL ? 'שינויים לא נשמרו' : 'Unsaved Changes'}
            </span>
            <span className="text-yellow-400/70 text-sm ml-2">
              {isRTL
                ? `${dirtyGrids.size} קמפיינים עם שינויים שלא יהיו בתוקף עד שתשמור`
                : `${dirtyGrids.size} campaign${dirtyGrids.size > 1 ? 's have' : ' has'} changes that won't take effect until saved`}
            </span>
          </div>
          <div className="flex gap-2">
            {getUnsavedCampaignIds().map(id => {
              const campaign = campaigns.find(c => c._id === id)
              if (!campaign) return null
              return (
                <button
                  key={id}
                  onClick={() => selectCampaign(campaign)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedCampaign?._id === id
                      ? 'bg-yellow-500/30 text-yellow-300'
                      : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                  }`}
                >
                  {isRTL && campaign.name_he ? campaign.name_he : campaign.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Campaign list - resizable with slide animation */}
        <div
          className={`
            flex flex-col border-r border-white/10 transition-all duration-300 ease-in-out overflow-hidden
            ${isLeftPanelCollapsed ? 'opacity-0' : 'opacity-100'}
          `}
          style={{
            width: isLeftPanelCollapsed ? 0 : leftPanelWidth,
            minWidth: isLeftPanelCollapsed ? 0 : leftPanelWidth,
          }}
        >
          <div className="p-4 border-b border-white/10">
            <div className="text-sm text-dark-400">
              {filteredCampaigns.length} {isRTL ? 'קמפיינים' : 'campaigns'}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {isLoading && campaigns.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary-400" size={24} />
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center text-dark-500 py-8">
                {isRTL ? 'אין קמפיינים' : 'No campaigns'}
              </div>
            ) : (
              filteredCampaigns.map(campaign => (
                <CampaignCard
                  key={campaign._id}
                  campaign={campaign}
                  isSelected={selectedCampaign?._id === campaign._id}
                  isAdmin={isAdmin}
                  onSelect={() => selectCampaign(selectedCampaign?._id === campaign._id ? null : campaign)}
                  onEdit={() => {
                    setEditingCampaign(campaign)
                    setShowFormModal(true)
                  }}
                  onDelete={() => setConfirmDelete(campaign._id)}
                  onToggleStatus={() => toggleCampaignStatus(campaign._id)}
                  onSyncCalendar={() => syncToCalendar(campaign._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Draggable splitter */}
        <div
          className={`
            w-1 bg-white/5 hover:bg-primary-500/50 cursor-col-resize transition-all duration-300 flex-shrink-0
            ${isLeftPanelCollapsed ? 'opacity-0 w-0' : 'opacity-100'}
          `}
          onMouseDown={handleLeftSplitterMouseDown}
        />

        {/* Left panel toggle button */}
        <button
          type="button"
          onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
          className="flex-shrink-0 w-6 flex items-center justify-center bg-dark-800/50 hover:bg-dark-700/50 border-r border-white/10 transition-colors"
          title={isLeftPanelCollapsed
            ? (isRTL ? 'הצג רשימת קמפיינים' : 'Show campaigns list')
            : (isRTL ? 'הסתר רשימת קמפיינים' : 'Hide campaigns list')
          }
        >
          {isLeftPanelCollapsed ? (
            <ChevronRight size={14} className="text-dark-400" />
          ) : (
            <ChevronLeft size={14} className="text-dark-400" />
          )}
        </button>

        {/* Schedule grid panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - always show, content changes based on selection */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex-1">
              {selectedCampaign ? (
                <>
                  <h2 className="font-medium text-dark-100" dir="auto">
                    {isRTL && selectedCampaign.name_he
                      ? selectedCampaign.name_he
                      : selectedCampaign.name}
                  </h2>
                  <p className="text-sm text-dark-400">
                    {isRTL ? 'לוח זמנים שבועי' : 'Weekly Schedule'}
                  </p>
                  {/* Warning for non-active campaigns */}
                  {selectedCampaign.status !== 'active' && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
                      <span className="text-xs text-yellow-400">
                        {isRTL
                          ? `קמפיין במצב "${selectedCampaign.status}" - פרסומות לא ישודרו! שנה למצב "פעיל" כדי להפעיל.`
                          : `Campaign is "${selectedCampaign.status}" - commercials won't play! Set to "Active" to enable.`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-medium text-dark-100">
                    {isRTL ? 'לוח זמנים כללי' : 'Overall Schedule'}
                  </h2>
                  <p className="text-sm text-dark-400">
                    {isRTL ? 'כל הקמפיינים' : 'All campaigns'}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Now playing indicator */}
              {playingSlot && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs text-blue-400">
                    {isRTL ? 'מנגן' : 'Playing'} {slotIndexToTime(playingSlot.slotIndex)} ({playQueue.length} {isRTL ? 'בתור' : 'in queue'})
                  </span>
                  <button
                    onClick={stopPlayback}
                    className="p-1 hover:bg-blue-500/30 rounded"
                    title={isRTL ? 'עצור' : 'Stop'}
                  >
                    <Square size={12} className="text-blue-400" />
                  </button>
                </div>
              )}

              {/* Reset button - only for current campaign */}
              {selectedCampaign && isDirty && (
                <button
                  onClick={resetGrid}
                  className="glass-button px-3 py-1.5 text-sm"
                >
                  {isRTL ? 'בטל שינויים' : 'Reset'}
                </button>
              )}

              {/* Save All button - saves all pending changes */}
              {dirtyGrids.size > 0 && (
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="glass-button-primary px-3 py-1.5 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>
                    {dirtyGrids.size > 1
                      ? (isRTL ? `שמור הכל (${dirtyGrids.size})` : `Save All (${dirtyGrids.size})`)
                      : (isRTL ? 'שמור' : 'Save')}
                  </span>
                </button>
              )}

              {/* Toggle right panel */}
              <button
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                className="glass-button p-1.5"
                title={isRTL ? 'פרטי משבצת' : 'Slot details'}
              >
                {isRightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>

              {selectedCampaign && (
                <button
                  onClick={() => selectCampaign(null)}
                  className="glass-button p-1.5"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Heatmap grid + details panel - always show */}
          <div className="flex-1 flex overflow-hidden" ref={heatmapContainerRef}>
            {/* Heatmap */}
            <div className="flex-1 overflow-auto p-4">
              {/* Copy schedule button - only when campaign is selected */}
              {selectedCampaign && (
                <div className="mb-3 flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                      disabled={campaignsWithSchedules.length === 0}
                      className="glass-button px-3 py-1.5 text-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      <Copy size={14} />
                      <span>{isRTL ? 'העתק מקמפיין קודם' : 'Populate from previous'}</span>
                      <ChevronDown size={12} />
                    </button>

                    {/* Dropdown */}
                    {showCopyDropdown && (
                      <div className="absolute top-full left-0 mt-1 z-20 bg-dark-800 border border-white/10 rounded-lg shadow-xl min-w-[200px] max-h-60 overflow-auto">
                        {campaignsWithSchedules.length === 0 ? (
                          <div className="p-3 text-xs text-dark-400 text-center">
                            {isRTL ? 'אין קמפיינים עם לוחות זמנים' : 'No campaigns with schedules'}
                          </div>
                        ) : (
                          campaignsWithSchedules.map(campaign => (
                            <button
                              key={campaign._id}
                              onClick={() => handleCopySchedule(campaign)}
                              className="w-full p-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                            >
                              <div className="text-sm text-dark-100" dir="auto">
                                {isRTL && campaign.name_he ? campaign.name_he : campaign.name}
                              </div>
                              <div className="text-xs text-dark-400 mt-0.5">
                                {campaign.schedule_grid.length} {isRTL ? 'משבצות' : 'slots'}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {showCopyDropdown && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowCopyDropdown(false)}
                    />
                  )}
                </div>
              )}

              <ScheduleHeatmap
                key={`heatmap-week-${weekOffset}`}
                grid={aggregatedGrid}
                selectedCampaignGrid={selectedCampaign ? editingGrid : undefined}
                selectedCampaignId={selectedCampaign?._id}
                selectedCampaignStartDate={selectedCampaign?.start_date}
                selectedCampaignEndDate={selectedCampaign?.end_date}
                getCampaignBreakdown={getCampaignBreakdown}
                onIncrement={selectedCampaign ? incrementSlot : undefined}
                onDecrement={selectedCampaign ? decrementSlot : undefined}
                readOnly={!selectedCampaign}
                highlightCurrentSlot={weekOffset === 0}
                baseDate={heatmapBaseDate}
                onRowClick={handleRowClick}
                activeRowFilter={filterSlotIndex}
                onPlaySlot={handlePlaySlot}
                isPlayingSlot={playingSlot}
                onWeekChange={handleWeekChange}
                initialScrollTop={heatmapScrollTop.current}
                onScrollChange={handleHeatmapScroll}
              />
            </div>

            {/* Draggable splitter for right panel */}
            <div
              className={`
                w-1 bg-white/5 hover:bg-primary-500/50 cursor-col-resize transition-all duration-300 flex-shrink-0
                ${isRightPanelOpen ? 'opacity-100' : 'opacity-0 w-0'}
              `}
              onMouseDown={handleRightSplitterMouseDown}
            />

            {/* Collapsible right panel - schedule details with slide animation */}
            <div
              className={`
                border-l border-white/10 flex flex-col bg-dark-800/30 flex-shrink-0
                transition-all duration-300 ease-in-out overflow-hidden
                ${isRightPanelOpen ? 'opacity-100' : 'opacity-0'}
              `}
              style={{ width: isRightPanelOpen ? rightPanelWidth : 0 }}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-dark-100 text-sm">
                      {isRTL ? 'פרטי לוח זמנים' : 'Schedule Details'}
                    </h3>
                    {filterSlotIndex !== null && (
                      <button
                        onClick={() => setFilterSlotIndex(null)}
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 mt-1"
                      >
                        <span>{slotIndexToTime(filterSlotIndex)}</span>
                        <X size={10} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setIsRightPanelOpen(false)
                      setFilterSlotIndex(null)
                    }}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  {selectedCampaign ? (
                    <div className="space-y-4">
                      {/* Campaign commercials */}
                      <div>
                        <h4 className="text-xs text-dark-400 mb-2">
                          {isRTL ? 'פרסומות בקמפיין' : 'Campaign Commercials'}
                        </h4>
                        {selectedCampaign.content_refs.length > 0 ? (
                          <div className="space-y-1">
                            {selectedCampaign.content_refs.map((ref, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 bg-dark-700/30 rounded text-sm"
                              >
                                <FileAudio size={12} className="text-primary-400 flex-shrink-0" />
                                <span className="text-dark-200 truncate" dir="auto">
                                  {ref.file_title}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-dark-500">
                            {isRTL ? 'אין פרסומות' : 'No commercials'}
                          </div>
                        )}
                      </div>

                      {/* Scheduled slots */}
                      <div className="pt-4 border-t border-white/5">
                        <h4 className="text-xs text-dark-400 mb-2">
                          {filterSlotIndex !== null
                            ? (isRTL ? `משבצות ב-${slotIndexToTime(filterSlotIndex)}` : `Slots at ${slotIndexToTime(filterSlotIndex)}`)
                            : (isRTL ? 'משבצות מתוזמנות' : 'Scheduled Slots')}
                          {scheduledSlots.length > 0 && (
                            <span className="text-primary-400 ml-1">({scheduledSlots.length})</span>
                          )}
                        </h4>

                        {scheduledSlots.length > 0 ? (
                          <div className="space-y-1">
                            {scheduledSlots.map((slot, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-dark-700/30 rounded text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock size={12} className="text-dark-400" />
                                  <span className="text-dark-200">{slot.timeLabel}</span>
                                  <span className="text-dark-400">{slot.dayLabel}</span>
                                </div>
                                <span className="text-primary-400 text-xs">×{slot.playCount}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-dark-500 text-xs">
                            {isRTL
                              ? 'אין משבצות מתוזמנות'
                              : 'No scheduled slots'}
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex justify-between text-xs">
                          <span className="text-dark-400">{isRTL ? 'סה"כ השמעות:' : 'Total plays:'}</span>
                          <span className="text-dark-200 font-medium">
                            {scheduledSlots.reduce((sum, s) => sum + s.playCount, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : filterSlotIndex !== null ? (
                    // Show all campaigns' commercials for the filtered slot
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs text-dark-400 mb-2">
                          {isRTL
                            ? `פרסומות ב-${slotIndexToTime(filterSlotIndex)}`
                            : `Commercials at ${slotIndexToTime(filterSlotIndex)}`}
                          {slotOverview.length > 0 && (
                            <span className="text-primary-400 ml-1">({slotOverview.length})</span>
                          )}
                        </h4>

                        {slotOverview.length > 0 ? (
                          <div className="space-y-2">
                            {slotOverview.map((item, idx) => (
                              <div
                                key={idx}
                                className="p-2 bg-dark-700/30 rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-dark-400">
                                    {item.dayLabel}
                                  </span>
                                  <span className="text-xs text-primary-400">×{item.playCount}</span>
                                </div>
                                <div
                                  className="text-sm text-dark-200 font-medium cursor-pointer hover:text-primary-400"
                                  dir="auto"
                                  onClick={() => selectCampaign(item.campaign)}
                                >
                                  {isRTL && item.campaign.name_he ? item.campaign.name_he : item.campaign.name}
                                </div>
                                {item.campaign.content_refs.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {item.campaign.content_refs.map((ref, refIdx) => (
                                      <div
                                        key={refIdx}
                                        className="flex items-center gap-1 text-xs text-dark-400"
                                      >
                                        <FileAudio size={10} />
                                        <span className="truncate" dir="auto">{ref.file_title}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-dark-500 text-xs">
                            {isRTL
                              ? 'אין פרסומות מתוזמנות לשעה זו'
                              : 'No commercials scheduled for this time'}
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      {slotOverview.length > 0 && (
                        <div className="pt-4 border-t border-white/5">
                          <div className="flex justify-between text-xs">
                            <span className="text-dark-400">{isRTL ? 'סה"כ השמעות:' : 'Total plays:'}</span>
                            <span className="text-dark-200 font-medium">
                              {slotOverview.reduce((sum, s) => sum + s.playCount, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-dark-400">{isRTL ? 'קמפיינים:' : 'Campaigns:'}</span>
                            <span className="text-dark-200 font-medium">
                              {new Set(slotOverview.map(s => s.campaign._id)).size}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-dark-500">
                      <Megaphone size={24} className="mb-2 opacity-50" />
                      <p className="text-xs text-center">
                        {isRTL
                          ? 'בחר קמפיין או לחץ על שעה'
                          : 'Select a campaign or click a time'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <CampaignFormModal
          campaign={editingCampaign}
          onClose={() => {
            setShowFormModal(false)
            setEditingCampaign(null)
          }}
          onSave={editingCampaign ? handleUpdateCampaign : handleCreateCampaign}
          isSaving={isSaving}
          isAdmin={isAdmin}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-dark-100 mb-4">
              {isRTL ? 'מחיקת קמפיין' : 'Delete Campaign'}
            </h3>
            <p className="text-dark-400 mb-6">
              {isRTL
                ? 'האם אתה בטוח שברצונך למחוק קמפיין זה?'
                : 'Are you sure you want to delete this campaign?'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 glass-button py-2"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDeleteCampaign(confirmDelete)}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg py-2 transition-colors"
              >
                {isRTL ? 'מחק' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

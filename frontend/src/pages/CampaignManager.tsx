import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Megaphone,
  RefreshCw,
  Save,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Square,
  AlertTriangle,
  Copy,
} from 'lucide-react'
import {
  useCampaignStore,
  Campaign,
  CampaignCreate,
  CampaignStatus,
  WeeklySlot,
  getSlotPlayCount,
  slotIndexToTime,
} from '../store/campaignStore'
import { api } from '../services/api'
import { toast } from '../store/toastStore'
import CampaignFormModal from '../components/Campaigns/CampaignFormModal'
import ScheduleHeatmap, { CampaignSlotInfo, SlotExecutionStatus } from '../components/Campaigns/ScheduleHeatmap'
import CampaignListPanel from '../components/Campaigns/CampaignListPanel'
import CampaignStatsBar from '../components/Campaigns/CampaignStatsBar'
import ScheduleDetailsPanel from '../components/Campaigns/ScheduleDetailsPanel'
import { usePanelResize } from '../components/Campaigns/hooks/usePanelResize'
import { useSlotPlayback } from '../components/Campaigns/hooks/useSlotPlayback'
import {
  calculateAggregatedGrid,
  getWeekStart,
  getWeekEnd,
  isCampaignActiveInWeek,
} from '../components/Campaigns/utils/campaignUtils'

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
    cloneCampaign,
    incrementSlot,
    decrementSlot,
    setEditingGrid,
    setCampaignGrid,
    saveAllGrids,
    resetGrid,
    syncToCalendar,
    clearError,
    hasAnyUnsavedChanges,
    getUnsavedCampaignIds,
    dirtyGrids,
  } = useCampaignStore()

  // Panel resize hook
  const {
    leftPanelWidth,
    rightPanelWidth,
    isLeftPanelCollapsed,
    isRightPanelOpen,
    setIsRightPanelOpen,
    containerRef,
    heatmapContainerRef,
    handleLeftSplitterMouseDown,
    handleRightSplitterMouseDown,
    toggleLeftPanel,
    toggleRightPanel,
  } = usePanelResize()

  // Slot playback hook
  const { playingSlot, playQueue, handlePlaySlot, stopPlayback } = useSlotPlayback(campaigns)

  // Local state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [statusFilter, setStatusFilter] = useState<CampaignStatus[]>(['active'])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmPause, setConfirmPause] = useState<string | null>(null)

  // Jingle settings
  const [useOpeningJingle, setUseOpeningJingle] = useState(true)
  const [openingJingleId, setOpeningJingleId] = useState<string>('')
  const [useClosingJingle, setUseClosingJingle] = useState(true)
  const [closingJingleId, setClosingJingleId] = useState<string>('')
  const [isJingleSettingsDirty, setIsJingleSettingsDirty] = useState(false)

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0)
  const heatmapScrollTop = useRef(0)

  // Filter state
  const [filterSlotIndex, setFilterSlotIndex] = useState<number | null>(null)
  const [filterSlotDate, setFilterSlotDate] = useState<string | null>(null)
  const [isRunningSlot, setIsRunningSlot] = useState(false)

  // Get user role
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  })
  const isAdmin = currentUser?.role === 'admin'

  // Fetch jingles
  const { data: jingles = [] } = useQuery({
    queryKey: ['jingles'],
    queryFn: api.getJingles,
  })

  // Fetch saved jingle settings
  const { data: jingleSettings } = useQuery({
    queryKey: ['jingleSettings'],
    queryFn: api.getJingleSettings,
  })

  // Initialize jingle settings
  useEffect(() => {
    if (jingleSettings) {
      setUseOpeningJingle(jingleSettings.use_opening_jingle ?? true)
      setUseClosingJingle(jingleSettings.use_closing_jingle ?? true)
      if (jingleSettings.opening_jingle_id) setOpeningJingleId(jingleSettings.opening_jingle_id)
      if (jingleSettings.closing_jingle_id) setClosingJingleId(jingleSettings.closing_jingle_id)
    }
  }, [jingleSettings])

  // Set default jingles
  useEffect(() => {
    if (jingles.length > 0) {
      if (!openingJingleId && !jingleSettings?.opening_jingle_id) setOpeningJingleId(jingles[0]._id)
      if (!closingJingleId && !jingleSettings?.closing_jingle_id) setClosingJingleId(jingles[0]._id)
    }
  }, [jingles, openingJingleId, closingJingleId, jingleSettings])

  // Save jingle settings
  const saveJingleSettings = useCallback(async () => {
    if (!isJingleSettingsDirty) return
    try {
      await api.saveJingleSettings(useOpeningJingle, openingJingleId, useClosingJingle, closingJingleId)
      setIsJingleSettingsDirty(false)
    } catch (error) {
      console.error('Failed to save jingle settings:', error)
    }
  }, [isJingleSettingsDirty, useOpeningJingle, openingJingleId, useClosingJingle, closingJingleId])

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return hasAnyUnsavedChanges() || isJingleSettingsDirty
  }, [hasAnyUnsavedChanges, isJingleSettingsDirty])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    // Empty array means "All" - show everything except deleted/completed by default
    if (statusFilter.length === 0) {
      return c.status !== 'deleted' && c.status !== 'completed'
    }
    // Otherwise, filter by selected statuses
    return statusFilter.includes(c.status)
  })

  // Handle campaign creation
  const handleCreateCampaign = useCallback(async (data: CampaignCreate) => {
    const campaign = await createCampaign(data)
    if (campaign) {
      setShowFormModal(false)
      // Ensure the new campaign's status is visible in the filter
      if (!statusFilter.includes(campaign.status)) {
        setStatusFilter(prev => [...prev, campaign.status])
      }
      selectCampaign(campaign)
    }
  }, [createCampaign, selectCampaign, statusFilter])

  // Handle campaign update
  const handleUpdateCampaign = useCallback(async (data: CampaignCreate) => {
    if (!editingCampaign) return
    const campaign = await updateCampaign(editingCampaign._id, data)
    if (campaign) {
      setShowFormModal(false)
      setEditingCampaign(null)
    }
  }, [editingCampaign, updateCampaign])

  // Handle delete
  const handleDeleteCampaign = useCallback(async (campaignId: string) => {
    await saveAllGrids()
    try {
      await api.updateCampaignGrid(campaignId, [])
    } catch (e) {
      console.error('Failed to clear schedule:', e)
    }
    const success = await deleteCampaign(campaignId)
    if (success) {
      setConfirmDelete(null)
      toast.success(isRTL ? 'הקמפיין נמחק והמשבצות הוסרו' : 'Campaign deleted and slots removed')
      fetchCampaigns()
    }
  }, [deleteCampaign, isRTL, fetchCampaigns, saveAllGrids])

  // Handle pause
  const handlePauseCampaign = useCallback(async (campaignId: string) => {
    await saveAllGrids()
    try {
      await api.updateCampaignGrid(campaignId, [])
    } catch (e) {
      console.error('Failed to clear schedule:', e)
    }
    const campaign = await toggleCampaignStatus(campaignId)
    if (campaign) {
      setConfirmPause(null)
      toast.success(isRTL ? 'הקמפיין הושהה והמשבצות הוסרו' : 'Campaign paused and slots removed')
      fetchCampaigns()
    }
  }, [toggleCampaignStatus, isRTL, fetchCampaigns, saveAllGrids])

  // Handle toggle status
  const handleToggleStatus = useCallback((campaign: Campaign) => {
    if (campaign.status === 'active') {
      setConfirmPause(campaign._id)
    } else {
      toggleCampaignStatus(campaign._id)
    }
  }, [toggleCampaignStatus])

  // Handle clone
  const handleCloneCampaign = useCallback(async (campaignId: string) => {
    const cloned = await cloneCampaign(campaignId)
    if (cloned) {
      toast.success(isRTL ? `קמפיין "${cloned.name}" נוצר בהצלחה` : `Campaign "${cloned.name}" created successfully`)
    }
  }, [cloneCampaign, isRTL])

  // Handle save all
  const handleSaveAll = useCallback(async () => {
    await saveAllGrids()
    await saveJingleSettings()
  }, [saveAllGrids, saveJingleSettings])

  // Handle run slot now
  const handleRunSlotNow = async (slotDate: string, slotIndex: number) => {
    setIsRunningSlot(true)
    try {
      const result = await api.runSlotNow(
        slotDate, slotIndex,
        useOpeningJingle, useOpeningJingle ? openingJingleId : undefined,
        useClosingJingle, useClosingJingle ? closingJingleId : undefined
      )
      if (result.success) {
        if (result.queued > 0) {
          toast.success(isRTL ? `הופעלו ${result.queued} פרסומות` : `Triggered ${result.queued} commercials`)
        } else {
          toast.info(isRTL ? 'אין פרסומות מתוזמנות למשבצת זו' : 'No commercials scheduled for this slot')
        }
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Unknown error'
      toast.error(isRTL ? `שגיאה: ${errorMessage}` : `Error: ${errorMessage}`)
    } finally {
      setIsRunningSlot(false)
    }
  }

  // Calculate base date for heatmap
  const heatmapBaseDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + weekOffset * 7)
    return date
  }, [weekOffset])

  // Calculate week date range for slot execution status fetch
  const weekDateRange = useMemo(() => {
    const weekStart = getWeekStart(heatmapBaseDate)
    const weekEnd = getWeekEnd(heatmapBaseDate)
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    return {
      startDate: formatDate(weekStart),
      endDate: formatDate(weekEnd),
    }
  }, [heatmapBaseDate])

  // Fetch slot execution status for the current week
  const { data: slotExecutionData } = useQuery<{ slots: SlotExecutionStatus[] }>({
    queryKey: ['slotExecutionStatus', weekDateRange.startDate, weekDateRange.endDate],
    queryFn: () => api.getSlotExecutionStatus(weekDateRange.startDate, weekDateRange.endDate),
    staleTime: 30000, // Cache for 30 seconds
  })

  // Handle row click
  const handleRowClick = useCallback((slotIndex: number) => {
    if (filterSlotIndex === slotIndex && !filterSlotDate) {
      setFilterSlotIndex(null)
    } else {
      setFilterSlotIndex(slotIndex)
      setFilterSlotDate(null)
      selectCampaign(null)
      setIsRightPanelOpen(true)
    }
  }, [filterSlotIndex, filterSlotDate, selectCampaign, setIsRightPanelOpen])

  // Handle slot click
  const handleSlotClick = useCallback((slotDate: string, slotIndex: number) => {
    setFilterSlotIndex(slotIndex)
    setFilterSlotDate(slotDate)
    setIsRightPanelOpen(true)
  }, [setIsRightPanelOpen])

  // Handle copy from previous week - copies slots from the previous week to the current week
  // If a campaign is selected, copies only that campaign's slots
  // If no campaign is selected, copies all active campaigns' slots
  const handleCopyFromPreviousWeek = useCallback(() => {
    // Calculate previous week dates
    const prevWeekDate = new Date(heatmapBaseDate)
    prevWeekDate.setDate(prevWeekDate.getDate() - 7)
    const prevWeekStart = getWeekStart(prevWeekDate)

    // Get dates for previous week (YYYY-MM-DD format)
    const prevWeekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(prevWeekStart)
      d.setDate(d.getDate() + i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      prevWeekDates.push(`${yyyy}-${mm}-${dd}`)
    }

    // Get dates for current week
    const currentWeekStart = getWeekStart(heatmapBaseDate)
    const currentWeekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart)
      d.setDate(d.getDate() + i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      currentWeekDates.push(`${yyyy}-${mm}-${dd}`)
    }

    // Determine which campaigns to process
    const campaignsToProcess = selectedCampaign
      ? [selectedCampaign]
      : campaigns.filter(c => c.status === 'active')

    let totalSlotsCopied = 0
    let campaignsUpdated = 0

    campaignsToProcess.forEach(campaign => {
      // Get the campaign's slots from the previous week (from saved grid)
      const prevWeekSlots = campaign.schedule_grid.filter(slot =>
        prevWeekDates.includes(slot.slot_date) && slot.play_count > 0
      )

      if (prevWeekSlots.length === 0) return

      // Map previous week slots to current week (same day of week, same time slot)
      const newSlots: WeeklySlot[] = prevWeekSlots.map(slot => {
        const prevDayIndex = prevWeekDates.indexOf(slot.slot_date)
        const newDate = currentWeekDates[prevDayIndex]
        return {
          slot_date: newDate,
          slot_index: slot.slot_index,
          play_count: slot.play_count,
        }
      })

      // Get existing grid for this campaign
      const existingGrid = campaign._id === selectedCampaign?._id
        ? editingGrid
        : (editingGrids.get(campaign._id) || campaign.schedule_grid)

      // Merge with existing slots (keeping non-current-week slots)
      const existingNonCurrentWeek = existingGrid.filter(slot => !currentWeekDates.includes(slot.slot_date))
      const mergedGrid = [...existingNonCurrentWeek, ...newSlots]

      // Update the campaign's grid
      if (campaign._id === selectedCampaign?._id) {
        setEditingGrid(mergedGrid)
      } else {
        setCampaignGrid(campaign._id, mergedGrid)
      }

      totalSlotsCopied += newSlots.length
      campaignsUpdated++
    })

    if (totalSlotsCopied === 0) {
      toast.info(isRTL ? 'אין משבצות בשבוע הקודם להעתקה' : 'No slots in previous week to copy')
    } else {
      const message = selectedCampaign
        ? (isRTL ? `הועתקו ${totalSlotsCopied} משבצות מהשבוע הקודם` : `Copied ${totalSlotsCopied} slots from previous week`)
        : (isRTL ? `הועתקו ${totalSlotsCopied} משבצות מ-${campaignsUpdated} קמפיינים` : `Copied ${totalSlotsCopied} slots from ${campaignsUpdated} campaigns`)
      toast.success(message)
    }
  }, [selectedCampaign, campaigns, heatmapBaseDate, editingGrid, editingGrids, setEditingGrid, setCampaignGrid, isRTL])

  // Handle week change
  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setWeekOffset(prev => direction === 'next' ? prev + 1 : prev - 1)
  }, [])

  // Handle heatmap scroll
  const handleHeatmapScroll = useCallback((scrollTop: number) => {
    heatmapScrollTop.current = scrollTop
  }, [])

  // Calculate aggregated grid
  const aggregatedGrid = useMemo(() => {
    return calculateAggregatedGrid(campaigns, selectedCampaign?._id || null, editingGrid, editingGrids, heatmapBaseDate)
  }, [campaigns, selectedCampaign?._id, editingGrid, editingGrids, heatmapBaseDate])

  // Get campaign breakdown for slot
  const getCampaignBreakdown = useCallback((slotDate: string, slotIndex: number): CampaignSlotInfo[] => {
    const weekStart = getWeekStart(heatmapBaseDate)
    const weekEnd = getWeekEnd(heatmapBaseDate)
    const breakdown: CampaignSlotInfo[] = []

    campaigns.forEach(campaign => {
      if (!isCampaignActiveInWeek(campaign, weekStart, weekEnd)) return

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

    return breakdown.sort((a, b) => b.priority - a.priority)
  }, [campaigns, selectedCampaign?._id, editingGrid, editingGrids, isRTL, heatmapBaseDate])

  return (
    <div className="h-full flex flex-col overflow-hidden" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Megaphone className="text-primary-400" size={24} />
          <h1 className="text-xl font-semibold text-dark-100">
            {isRTL ? 'מנהל קמפיינים' : 'Campaign Manager'}
          </h1>
        </div>

        <button
          onClick={() => fetchCampaigns()}
          disabled={isLoading}
          className="glass-button p-2"
          title={isRTL ? 'רענן' : 'Refresh'}
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Bar */}
      <CampaignStatsBar campaigns={campaigns} isRTL={isRTL} isAdmin={isAdmin} />

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Unsaved changes warning */}
      {dirtyGrids.size > 0 && (
        <div className="mx-6 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
          <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-yellow-400 text-sm font-medium">
              {isRTL ? 'שינויים לא נשמרו' : 'Unsaved Changes'}
            </span>
            <span className="text-yellow-400/70 text-sm ml-2">
              {isRTL
                ? `${dirtyGrids.size} קמפיינים עם שינויים`
                : `${dirtyGrids.size} campaign${dirtyGrids.size > 1 ? 's have' : ' has'} changes`}
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
        {/* Campaign list panel */}
        <div
          className={`flex flex-col border-r border-white/10 transition-all duration-300 ease-in-out overflow-hidden ${
            isLeftPanelCollapsed ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            width: isLeftPanelCollapsed ? 0 : leftPanelWidth,
            minWidth: isLeftPanelCollapsed ? 0 : leftPanelWidth,
          }}
        >
          <CampaignListPanel
            isRTL={isRTL}
            campaigns={campaigns}
            filteredCampaigns={filteredCampaigns}
            selectedCampaign={selectedCampaign}
            isLoading={isLoading}
            isAdmin={isAdmin}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onSelectCampaign={selectCampaign}
            onEditCampaign={(campaign) => {
              setEditingCampaign(campaign)
              setShowFormModal(true)
            }}
            onDeleteCampaign={(id) => setConfirmDelete(id)}
            onToggleStatus={handleToggleStatus}
            onSyncCalendar={syncToCalendar}
            onCloneCampaign={handleCloneCampaign}
            onOpenRightPanel={() => setIsRightPanelOpen(true)}
            onCreateCampaign={() => {
              setEditingCampaign(null)
              setShowFormModal(true)
            }}
          />
        </div>

        {/* Left splitter */}
        <div
          className={`w-1 bg-white/5 hover:bg-primary-500/50 cursor-col-resize transition-all duration-300 flex-shrink-0 ${
            isLeftPanelCollapsed ? 'opacity-0 w-0' : 'opacity-100'
          }`}
          onMouseDown={handleLeftSplitterMouseDown}
        />

        {/* Left panel toggle */}
        <button
          type="button"
          onClick={toggleLeftPanel}
          className="flex-shrink-0 w-6 flex items-center justify-center bg-dark-800/50 hover:bg-dark-700/50 border-r border-white/10 transition-colors"
          title={isLeftPanelCollapsed ? (isRTL ? 'הצג רשימה' : 'Show list') : (isRTL ? 'הסתר רשימה' : 'Hide list')}
        >
          {isLeftPanelCollapsed ? <ChevronRight size={14} className="text-dark-400" /> : <ChevronLeft size={14} className="text-dark-400" />}
        </button>

        {/* Schedule grid panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Grid header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex-1">
              {selectedCampaign ? (
                <>
                  <h2 className="font-medium text-dark-100" dir="auto">
                    {isRTL && selectedCampaign.name_he ? selectedCampaign.name_he : selectedCampaign.name}
                  </h2>
                  <p className="text-sm text-dark-400">{isRTL ? 'לוח זמנים שבועי' : 'Weekly Schedule'}</p>
                  {selectedCampaign.status !== 'active' && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
                      <span className="text-xs text-yellow-400">
                        {isRTL
                          ? `קמפיין במצב "${selectedCampaign.status}" - פרסומות לא ישודרו!`
                          : `Campaign is "${selectedCampaign.status}" - commercials won't play!`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-medium text-dark-100">{isRTL ? 'לוח זמנים כללי' : 'Overall Schedule'}</h2>
                  <p className="text-sm text-dark-400">{isRTL ? 'כל הקמפיינים' : 'All campaigns'}</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {playingSlot && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs text-blue-400">
                    {isRTL ? 'מנגן' : 'Playing'} {slotIndexToTime(playingSlot.slotIndex)} ({playQueue.length} {isRTL ? 'בתור' : 'in queue'})
                  </span>
                  <button onClick={stopPlayback} className="p-1 hover:bg-blue-500/30 rounded" title={isRTL ? 'עצור' : 'Stop'}>
                    <Square size={12} className="text-blue-400" />
                  </button>
                </div>
              )}

              {selectedCampaign && isDirty && (
                <button onClick={resetGrid} className="glass-button px-3 py-1.5 text-sm">
                  {isRTL ? 'בטל שינויים' : 'Reset'}
                </button>
              )}

              {dirtyGrids.size > 0 && (
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="glass-button-primary px-3 py-1.5 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>
                    {dirtyGrids.size > 1
                      ? (isRTL ? `שמור הכל (${dirtyGrids.size})` : `Save All (${dirtyGrids.size})`)
                      : (isRTL ? 'שמור' : 'Save')}
                  </span>
                </button>
              )}

              <button onClick={toggleRightPanel} className="glass-button p-1.5" title={isRTL ? 'פרטי משבצת' : 'Slot details'}>
                {isRightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>

              {selectedCampaign && (
                <button onClick={() => selectCampaign(null)} className="glass-button p-1.5">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Heatmap + details */}
          <div className="flex-1 flex overflow-hidden" ref={heatmapContainerRef}>
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={handleCopyFromPreviousWeek}
                  className="glass-button px-3 py-1.5 text-xs flex items-center gap-2"
                >
                  <Copy size={14} />
                  <span>{isRTL ? 'העתק מהשבוע הקודם' : 'Copy from previous week'}</span>
                </button>
              </div>

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
                onSlotClick={handleSlotClick}
                slotExecutionStatus={slotExecutionData?.slots}
              />
            </div>

            {/* Right splitter */}
            <div
              className={`w-1 bg-white/5 hover:bg-primary-500/50 cursor-col-resize transition-all duration-300 flex-shrink-0 ${
                isRightPanelOpen ? 'opacity-100' : 'opacity-0 w-0'
              }`}
              onMouseDown={handleRightSplitterMouseDown}
            />

            {/* Schedule details panel */}
            <ScheduleDetailsPanel
              isRTL={isRTL}
              isOpen={isRightPanelOpen}
              width={rightPanelWidth}
              selectedCampaign={selectedCampaign}
              campaigns={campaigns}
              editingGrid={editingGrid}
              editingGrids={editingGrids}
              filterSlotIndex={filterSlotIndex}
              filterSlotDate={filterSlotDate}
              heatmapBaseDate={heatmapBaseDate}
              onClose={() => {
                setIsRightPanelOpen(false)
                setFilterSlotIndex(null)
                setFilterSlotDate(null)
              }}
              onClearFilter={() => {
                setFilterSlotIndex(null)
                setFilterSlotDate(null)
              }}
              onSelectCampaign={selectCampaign}
              setEditingGrid={setEditingGrid}
              useOpeningJingle={useOpeningJingle}
              setUseOpeningJingle={setUseOpeningJingle}
              openingJingleId={openingJingleId}
              setOpeningJingleId={setOpeningJingleId}
              useClosingJingle={useClosingJingle}
              setUseClosingJingle={setUseClosingJingle}
              closingJingleId={closingJingleId}
              setClosingJingleId={setClosingJingleId}
              jingles={jingles}
              isJingleSettingsDirty={isJingleSettingsDirty}
              onJingleSettingsChange={() => setIsJingleSettingsDirty(true)}
              onSaveAll={handleSaveAll}
              onRunSlotNow={handleRunSlotNow}
              isRunningSlot={isRunningSlot}
            />
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
            <h3 className="font-semibold text-dark-100 mb-4">{isRTL ? 'מחיקת קמפיין' : 'Delete Campaign'}</h3>
            <p className="text-dark-400 mb-2">{isRTL ? 'האם אתה בטוח?' : 'Are you sure?'}</p>
            <p className="text-yellow-400 text-sm mb-6 flex items-center gap-2">
              <AlertTriangle size={16} />
              {isRTL ? 'כל המשבצות יוסרו לצמיתות' : 'All slots will be permanently removed'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 glass-button py-2">
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

      {/* Pause Confirmation Modal */}
      {confirmPause && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-dark-100 mb-4">{isRTL ? 'השהיית קמפיין' : 'Pause Campaign'}</h3>
            <p className="text-dark-400 mb-2">{isRTL ? 'האם אתה בטוח?' : 'Are you sure?'}</p>
            <p className="text-yellow-400 text-sm mb-6 flex items-center gap-2">
              <AlertTriangle size={16} />
              {isRTL ? 'כל המשבצות יוסרו' : 'All slots will be removed'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPause(null)} className="flex-1 glass-button py-2">
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={() => handlePauseCampaign(confirmPause)}
                className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg py-2 transition-colors"
              >
                {isRTL ? 'השהה' : 'Pause'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

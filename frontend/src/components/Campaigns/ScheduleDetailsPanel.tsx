import { useMemo, useCallback, useState } from 'react'
import { X, Clock, FileAudio, Save, Loader2, Play } from 'lucide-react'
import { Campaign, WeeklySlot, slotIndexToTime } from '../../store/campaignStore'
import { Select } from '../Form'
import JingleSettings from './JingleSettings'
import {
  getScheduledSlotsForCampaign,
  getSlotOverviewForTime,
  filterFutureSlots,
  getSlotKey,
  getWeekDates,
  DAY_LABELS_EN,
  DAY_LABELS_HE,
} from './utils/campaignUtils'

interface ScheduleDetailsPanelProps {
  isRTL: boolean
  isOpen: boolean
  width: number
  selectedCampaign: Campaign | null
  campaigns: Campaign[]
  editingGrid: WeeklySlot[]
  editingGrids: Map<string, WeeklySlot[]>
  filterSlotIndex: number | null
  filterSlotDate: string | null
  heatmapBaseDate: Date
  onClose: () => void
  onClearFilter: () => void
  onSelectCampaign: (campaign: Campaign) => void
  setEditingGrid: (grid: WeeklySlot[]) => void
  // Jingle settings
  useOpeningJingle: boolean
  setUseOpeningJingle: (value: boolean) => void
  openingJingleId: string
  setOpeningJingleId: (value: string) => void
  useClosingJingle: boolean
  setUseClosingJingle: (value: boolean) => void
  closingJingleId: string
  setClosingJingleId: (value: string) => void
  jingles: Array<{ _id: string; title: string }>
  isJingleSettingsDirty: boolean
  onJingleSettingsChange: () => void
  onSaveAll: () => void
  onRunSlotNow: (slotDate: string, slotIndex: number) => void
  isRunningSlot: boolean
}

export default function ScheduleDetailsPanel({
  isRTL,
  isOpen,
  width,
  selectedCampaign,
  campaigns,
  editingGrid,
  editingGrids,
  filterSlotIndex,
  filterSlotDate,
  heatmapBaseDate,
  onClose,
  onClearFilter,
  onSelectCampaign,
  setEditingGrid,
  useOpeningJingle,
  setUseOpeningJingle,
  openingJingleId,
  setOpeningJingleId,
  useClosingJingle,
  setUseClosingJingle,
  closingJingleId,
  setClosingJingleId,
  jingles,
  isJingleSettingsDirty,
  onJingleSettingsChange,
  onSaveAll,
  onRunSlotNow,
  isRunningSlot,
}: ScheduleDetailsPanelProps) {
  const dayLabels = isRTL ? DAY_LABELS_HE : DAY_LABELS_EN

  // Repeat slot settings
  const [repeatScope, setRepeatScope] = useState<'day' | 'week'>('day')
  const [repeatStartSlot, setRepeatStartSlot] = useState<number>(0)
  const [repeatEndSlot, setRepeatEndSlot] = useState<number>(47)
  const [selectedSlotKeys, setSelectedSlotKeys] = useState<Set<string>>(new Set())

  // Get scheduled slots for selected campaign
  const scheduledSlots = useMemo(() => {
    if (!selectedCampaign) return []
    return getScheduledSlotsForCampaign(editingGrid, heatmapBaseDate, filterSlotIndex, dayLabels)
  }, [selectedCampaign, editingGrid, heatmapBaseDate, filterSlotIndex, dayLabels])

  // Get future slots only
  const futureSlots = useMemo(() => filterFutureSlots(scheduledSlots), [scheduledSlots])

  // Get slot overview for all campaigns
  const slotOverview = useMemo(() => {
    if (filterSlotIndex === null) return []
    return getSlotOverviewForTime(
      campaigns,
      selectedCampaign?._id || null,
      editingGrid,
      editingGrids,
      filterSlotIndex,
      filterSlotDate,
      heatmapBaseDate,
      dayLabels
    )
  }, [campaigns, selectedCampaign?._id, editingGrid, editingGrids, filterSlotIndex, filterSlotDate, heatmapBaseDate, dayLabels])

  // Toggle slot selection
  const toggleSlotSelection = useCallback((slotDate: string, slotIndex: number) => {
    const key = getSlotKey(slotDate, slotIndex)
    setSelectedSlotKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // Check if all future slots are selected
  const allFutureSlotsSelected = useMemo(() => {
    if (futureSlots.length === 0) return false
    return futureSlots.every(s => selectedSlotKeys.has(getSlotKey(s.slotDate, s.slotIndex)))
  }, [futureSlots, selectedSlotKeys])

  // Toggle all future slots selection
  const toggleSelectAllFutureSlots = useCallback(() => {
    const allFutureKeys = futureSlots.map(s => getSlotKey(s.slotDate, s.slotIndex))
    if (allFutureSlotsSelected) {
      setSelectedSlotKeys(new Set())
    } else {
      setSelectedSlotKeys(new Set(allFutureKeys))
    }
  }, [futureSlots, allFutureSlotsSelected])

  // Delete selected slots
  const deleteSelectedSlots = useCallback(() => {
    if (selectedSlotKeys.size === 0) return
    const updatedGrid = editingGrid.filter(slot => {
      const key = getSlotKey(slot.slot_date, slot.slot_index)
      return !selectedSlotKeys.has(key)
    })
    setEditingGrid(updatedGrid)
    setSelectedSlotKeys(new Set())
  }, [selectedSlotKeys, editingGrid, setEditingGrid])

  // Handle repeat slot pattern
  const handleRepeatSlot = useCallback((pattern: 'hourly' | '2hours' | '30min') => {
    if (filterSlotIndex === null || !selectedCampaign) return

    const weekDates = getWeekDates(heatmapBaseDate)
    const sourcePlayCounts: Record<string, number> = {}

    weekDates.forEach(slotDate => {
      const slot = editingGrid.find(s => s.slot_date === slotDate && s.slot_index === filterSlotIndex)
      if (slot && slot.play_count > 0) {
        sourcePlayCounts[slotDate] = slot.play_count
      }
    })

    if (Object.keys(sourcePlayCounts).length === 0) return

    const step = pattern === 'hourly' ? 2 : pattern === '2hours' ? 4 : 1
    const newSlots: WeeklySlot[] = []
    const sortedSourceDates = Object.keys(sourcePlayCounts).sort()
    const firstSourceDate = sortedSourceDates[0]
    const firstPlayCount = sourcePlayCounts[firstSourceDate]

    if (repeatScope === 'day') {
      Object.entries(sourcePlayCounts).forEach(([slotDate, playCount]) => {
        for (let idx = filterSlotIndex + step; idx < 48; idx += step) {
          newSlots.push({ slot_date: slotDate, slot_index: idx, play_count: playCount })
        }
      })
    } else {
      const firstSourceIdx = weekDates.indexOf(firstSourceDate)
      for (let dayIdx = firstSourceIdx; dayIdx < weekDates.length; dayIdx++) {
        const slotDate = weekDates[dayIdx]
        const playCount = sourcePlayCounts[slotDate] || firstPlayCount
        let startIdx = dayIdx === firstSourceIdx
          ? Math.max(filterSlotIndex + step, repeatStartSlot)
          : repeatStartSlot
        for (let idx = startIdx; idx <= repeatEndSlot; idx += step) {
          newSlots.push({ slot_date: slotDate, slot_index: idx, play_count: playCount })
        }
      }
    }

    if (newSlots.length === 0) return

    const updatedGrid = [...editingGrid]
    newSlots.forEach(newSlot => {
      const existingIdx = updatedGrid.findIndex(
        s => s.slot_date === newSlot.slot_date && s.slot_index === newSlot.slot_index
      )
      if (existingIdx >= 0) {
        updatedGrid[existingIdx] = { ...updatedGrid[existingIdx], play_count: newSlot.play_count }
      } else {
        updatedGrid.push(newSlot)
      }
    })

    setEditingGrid(updatedGrid)
  }, [filterSlotIndex, selectedCampaign, editingGrid, heatmapBaseDate, repeatScope, repeatStartSlot, repeatEndSlot, setEditingGrid])

  if (!isOpen) return null

  return (
    <div
      className="border-l border-white/10 flex flex-col bg-dark-800/30 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width }}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-dark-100 text-sm">
            {isRTL ? 'פרטי לוח זמנים' : 'Schedule Details'}
          </h3>
          {filterSlotIndex !== null && (
            <button
              onClick={onClearFilter}
              className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 mt-1"
            >
              <span>
                {slotIndexToTime(filterSlotIndex)}
                {filterSlotDate && ` • ${filterSlotDate}`}
              </span>
              <X size={10} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isJingleSettingsDirty && (
            <button
              onClick={onSaveAll}
              className="px-3 py-1 text-xs rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-1"
            >
              <Save size={12} />
              {isRTL ? 'שמור' : 'Save'}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Jingle Settings */}
        <JingleSettings
          isRTL={isRTL}
          useOpeningJingle={useOpeningJingle}
          setUseOpeningJingle={setUseOpeningJingle}
          openingJingleId={openingJingleId}
          setOpeningJingleId={setOpeningJingleId}
          useClosingJingle={useClosingJingle}
          setUseClosingJingle={setUseClosingJingle}
          closingJingleId={closingJingleId}
          setClosingJingleId={setClosingJingleId}
          jingles={jingles}
          onSettingsChange={onJingleSettingsChange}
          isDirty={isJingleSettingsDirty}
        />

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
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs text-dark-400">
                  {filterSlotIndex !== null
                    ? (isRTL ? `משבצות ב-${slotIndexToTime(filterSlotIndex)}` : `Slots at ${slotIndexToTime(filterSlotIndex)}`)
                    : (isRTL ? 'משבצות מתוזמנות' : 'Scheduled Slots')}
                  {scheduledSlots.length > 0 && (
                    <span className="text-primary-400 ml-1">({scheduledSlots.length})</span>
                  )}
                </h4>

                {selectedSlotKeys.size > 0 && (
                  <button
                    onClick={deleteSelectedSlots}
                    className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    {isRTL ? `מחק (${selectedSlotKeys.size})` : `Delete (${selectedSlotKeys.size})`}
                  </button>
                )}
              </div>

              {futureSlots.length > 0 && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                  <button
                    onClick={toggleSelectAllFutureSlots}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      allFutureSlotsSelected
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-dark-500 hover:border-primary-500/50'
                    }`}
                  >
                    {allFutureSlotsSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-xs text-dark-400">
                    {isRTL ? `בחר הכל (${futureSlots.length} עתידיות)` : `Select all (${futureSlots.length} future)`}
                  </span>
                </div>
              )}

              {scheduledSlots.length > 0 ? (
                <div className="space-y-1">
                  {scheduledSlots.map((slot, idx) => {
                    const slotKey = getSlotKey(slot.slotDate, slot.slotIndex)
                    const isFuture = futureSlots.some(
                      f => f.slotDate === slot.slotDate && f.slotIndex === slot.slotIndex
                    )
                    const isSelected = selectedSlotKeys.has(slotKey)

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded text-sm transition-colors ${
                          isSelected ? 'bg-primary-500/20' : 'bg-dark-700/30'
                        } ${!isFuture ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {isFuture ? (
                            <button
                              onClick={() => toggleSlotSelection(slot.slotDate, slot.slotIndex)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-primary-500 border-primary-500'
                                  : 'border-dark-500 hover:border-primary-500/50'
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            <Clock size={12} className="text-dark-500" />
                          )}
                          <span className="text-dark-200">{slot.timeLabel}</span>
                          <span className="text-dark-400">{slot.dayLabel}</span>
                          {!isFuture && (
                            <span className="text-xs text-dark-500">
                              ({isRTL ? 'עבר' : 'past'})
                            </span>
                          )}
                        </div>
                        <span className="text-primary-400 text-xs">×{slot.playCount}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-dark-500 text-xs">
                  {isRTL ? 'אין משבצות מתוזמנות' : 'No scheduled slots'}
                </div>
              )}
            </div>

            {/* Repeat slot section */}
            {filterSlotIndex !== null && scheduledSlots.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <h4 className="text-xs text-dark-400 mb-2">
                  {isRTL ? 'חזור על משבצת' : 'Repeat Slot'}
                </h4>
                <p className="text-xs text-dark-500 mb-3">
                  {isRTL
                    ? `העתק את ${slotIndexToTime(filterSlotIndex)} למשבצות נוספות`
                    : `Copy ${slotIndexToTime(filterSlotIndex)} to other time slots`}
                </p>

                <div className="flex rounded-lg bg-dark-700/50 p-0.5 mb-3 border border-dark-600/50">
                  <button
                    onClick={() => setRepeatScope('day')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                      repeatScope === 'day'
                        ? 'bg-primary-500/30 text-primary-400'
                        : 'text-dark-400 hover:text-dark-200'
                    }`}
                  >
                    {isRTL ? 'שאר היום' : 'Rest of Day'}
                  </button>
                  <button
                    onClick={() => setRepeatScope('week')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                      repeatScope === 'week'
                        ? 'bg-primary-500/30 text-primary-400'
                        : 'text-dark-400 hover:text-dark-200'
                    }`}
                  >
                    {isRTL ? 'שאר השבוע' : 'Rest of Week'}
                  </button>
                </div>

                {repeatScope === 'week' && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-dark-400">{isRTL ? 'בין' : 'Between'}</span>
                    <Select
                      value={String(repeatStartSlot)}
                      onChange={(value) => setRepeatStartSlot(Number(value))}
                      className="flex-1"
                      options={Array.from({ length: 48 }, (_, i) => ({
                        value: String(i),
                        label: slotIndexToTime(i)
                      }))}
                    />
                    <span className="text-xs text-dark-400">{isRTL ? 'עד' : 'Until'}</span>
                    <Select
                      value={String(repeatEndSlot)}
                      onChange={(value) => setRepeatEndSlot(Number(value))}
                      className="flex-1"
                      options={Array.from({ length: 48 }, (_, i) => ({
                        value: String(i),
                        label: slotIndexToTime(i)
                      }))}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleRepeatSlot('30min')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-dark-700/50 text-dark-300 hover:bg-primary-500/20 hover:text-primary-400 transition-colors border border-dark-600/50"
                  >
                    {isRTL ? 'כל 30 דק׳' : 'Every 30m'}
                  </button>
                  <button
                    onClick={() => handleRepeatSlot('hourly')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-dark-700/50 text-dark-300 hover:bg-primary-500/20 hover:text-primary-400 transition-colors border border-dark-600/50"
                  >
                    {isRTL ? 'כל שעה' : 'Hourly'}
                  </button>
                  <button
                    onClick={() => handleRepeatSlot('2hours')}
                    className="px-3 py-1.5 text-xs rounded-lg bg-dark-700/50 text-dark-300 hover:bg-primary-500/20 hover:text-primary-400 transition-colors border border-dark-600/50"
                  >
                    {isRTL ? 'כל שעתיים' : 'Every 2h'}
                  </button>
                </div>
              </div>
            )}

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

              {slotOverview.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => {
                      const firstSlotDate = slotOverview[0]?.slotDate
                      if (firstSlotDate && filterSlotIndex !== null) {
                        onRunSlotNow(firstSlotDate, filterSlotIndex)
                      }
                    }}
                    disabled={isRunningSlot}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isRunningSlot ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    <span className="text-xs font-medium">
                      {isRTL ? 'הפעל עכשיו' : 'Run Now'}
                    </span>
                  </button>
                </div>
              )}

              {slotOverview.length > 0 ? (
                <div className="space-y-2">
                  {slotOverview.map((item, idx) => (
                    <div key={idx} className="p-2 bg-dark-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-dark-400">
                          {item.dayLabel} • {item.slotDate}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-primary-400">×{item.playCount}</span>
                          <button
                            onClick={() => onRunSlotNow(item.slotDate, filterSlotIndex!)}
                            disabled={isRunningSlot}
                            className="p-1 hover:bg-green-500/20 rounded text-green-400 transition-colors disabled:opacity-50"
                            title={isRTL ? 'הפעל עכשיו' : 'Run Now'}
                          >
                            {isRunningSlot ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Play size={10} />
                            )}
                          </button>
                        </div>
                      </div>
                      <div
                        className="text-sm text-dark-200 font-medium cursor-pointer hover:text-primary-400"
                        dir="auto"
                        onClick={() => onSelectCampaign(item.campaign)}
                      >
                        {isRTL && item.campaign.name_he ? item.campaign.name_he : item.campaign.name}
                      </div>
                      {item.campaign.content_refs.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {item.campaign.content_refs.map((ref, refIdx) => (
                            <div key={refIdx} className="flex items-center gap-1 text-xs text-dark-400">
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
                  {isRTL ? 'אין פרסומות מתוזמנות לשעה זו' : 'No commercials scheduled for this time'}
                </div>
              )}
            </div>

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
            <FileAudio size={24} className="mb-2 opacity-50" />
            <p className="text-xs text-center">
              {isRTL ? 'בחר קמפיין או לחץ על שעה' : 'Select a campaign or click a time'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

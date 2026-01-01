import { create } from 'zustand'
import { api } from '../services/api'

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'deleted'

export interface WeeklySlot {
  slot_date: string    // YYYY-MM-DD format - the specific date for this slot
  slot_index: number   // 0-47 (00:00, 00:30, ... 23:30)
  play_count: number
}

export interface ContentRef {
  content_id?: string
  file_google_drive_id?: string
  file_local_path?: string
  file_title?: string
  file_duration_seconds?: number
}

export interface Campaign {
  _id: string
  name: string
  name_he?: string
  campaign_type: string
  comment?: string
  start_date: string  // ISO date string
  end_date: string    // ISO date string
  priority: number    // 1-9
  contract_link?: string  // Admin only - link to contract document
  content_refs: ContentRef[]
  schedule_grid: WeeklySlot[]
  status: CampaignStatus
  calendar_event_id?: string
  created_at: string
  updated_at: string
}

export interface CampaignCreate {
  name: string
  name_he?: string
  campaign_type?: string
  comment?: string
  start_date: string
  end_date: string
  priority?: number
  contract_link?: string  // Admin only
  content_refs?: ContentRef[]
  schedule_grid?: WeeklySlot[]
}

export interface DailyPreviewSlot {
  slot_index: number
  time: string
  commercials: Array<{
    campaign_id: string
    name: string
    campaign_type: string
    priority: number
    play_count: number
    content_count: number
  }>
}

export interface DailyPreview {
  date: string
  day_of_week: number
  slots: DailyPreviewSlot[]
}

export interface CampaignStats {
  campaign_id: string
  name: string
  total_plays: number
  plays_today: number
  scheduled_today: number
  scheduled_per_week: number
  content_count: number
}

interface CampaignState {
  // Data
  campaigns: Campaign[]
  selectedCampaign: Campaign | null
  dailyPreview: DailyPreview | null

  // UI State
  isLoading: boolean
  isSaving: boolean
  error: string | null

  // Grid editing state - now per-campaign to preserve changes when switching
  editingGrids: Map<string, WeeklySlot[]>  // campaignId -> grid
  dirtyGrids: Set<string>  // campaignIds with unsaved changes
  editingGrid: WeeklySlot[]  // Current campaign's grid (for convenience)
  isDirty: boolean  // Current campaign has unsaved changes

  // Actions
  fetchCampaigns: (status?: CampaignStatus) => Promise<void>
  fetchCampaign: (id: string) => Promise<void>
  selectCampaign: (campaign: Campaign | null) => void
  createCampaign: (data: CampaignCreate) => Promise<Campaign | null>
  updateCampaign: (id: string, data: Partial<CampaignCreate>) => Promise<Campaign | null>
  deleteCampaign: (id: string, hardDelete?: boolean) => Promise<boolean>
  toggleCampaignStatus: (id: string) => Promise<Campaign | null>
  cloneCampaign: (id: string) => Promise<Campaign | null>

  // Grid editing
  initEditingGrid: (campaign: Campaign) => void
  setEditingGrid: (grid: WeeklySlot[]) => void
  updateSlot: (slotDate: string, slotIndex: number, playCount: number) => void
  incrementSlot: (slotDate: string, slotIndex: number) => void
  decrementSlot: (slotDate: string, slotIndex: number) => void
  saveGrid: (campaignId: string) => Promise<boolean>
  saveAllGrids: () => Promise<boolean>
  resetGrid: () => void

  // Content management
  addContent: (campaignId: string, contentRef: ContentRef) => Promise<boolean>
  removeContent: (campaignId: string, contentIndex: number) => Promise<boolean>

  // Preview
  fetchDailyPreview: (date?: string) => Promise<void>

  // Calendar sync
  syncToCalendar: (campaignId: string) => Promise<boolean>

  // Stats
  fetchCampaignStats: (campaignId: string) => Promise<CampaignStats | null>

  // Helpers
  clearError: () => void
  setLoading: (loading: boolean) => void
  hasAnyUnsavedChanges: () => boolean
  getUnsavedCampaignIds: () => string[]
}

// Helper to convert slot index to time string
export const slotIndexToTime = (slotIndex: number): string => {
  const hours = Math.floor(slotIndex / 2)
  const minutes = (slotIndex % 2) * 30
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

// Helper to convert time to slot index
export const timeToSlotIndex = (hour: number, minute: number): number => {
  return hour * 2 + (minute >= 30 ? 1 : 0)
}

// Helper to get slot play count from grid by date
export const getSlotPlayCount = (grid: WeeklySlot[], slotDate: string, slotIndex: number): number => {
  const slot = grid.find(s => s.slot_date === slotDate && s.slot_index === slotIndex)
  return slot?.play_count ?? 0
}

// Helper to format date as YYYY-MM-DD
export const formatSlotDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  // Initial state
  campaigns: [],
  selectedCampaign: null,
  dailyPreview: null,
  isLoading: false,
  isSaving: false,
  error: null,
  editingGrids: new Map(),
  dirtyGrids: new Set(),
  editingGrid: [],
  isDirty: false,

  // Fetch all campaigns
  fetchCampaigns: async (status?: CampaignStatus) => {
    set({ isLoading: true, error: null })
    try {
      const campaigns = await api.getCampaigns(status)
      set({ campaigns, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch campaigns', isLoading: false })
    }
  },

  // Fetch single campaign
  fetchCampaign: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const campaign = await api.getCampaign(id)
      set({ selectedCampaign: campaign, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch campaign', isLoading: false })
    }
  },

  // Select campaign - preserves unsaved changes when switching
  selectCampaign: (campaign: Campaign | null) => {
    set(state => {
      const currentCampaign = state.selectedCampaign
      const newEditingGrids = new Map(state.editingGrids)

      // Save current grid to the map before switching (always save, even if empty)
      if (currentCampaign) {
        newEditingGrids.set(currentCampaign._id, [...state.editingGrid])
      }

      // Determine the new editing grid
      let newEditingGrid: WeeklySlot[]
      let newIsDirty: boolean

      if (campaign) {
        // Check if we have unsaved changes for this campaign
        const savedGrid = newEditingGrids.get(campaign._id)
        if (savedGrid !== undefined) {
          // Restore unsaved changes (filter out legacy day_of_week format)
          newEditingGrid = savedGrid.filter(slot => 'slot_date' in slot && slot.slot_date)
          newIsDirty = state.dirtyGrids.has(campaign._id)
        } else {
          // Initialize from campaign's stored grid (filter out legacy day_of_week format)
          newEditingGrid = campaign.schedule_grid.filter(slot => 'slot_date' in slot && slot.slot_date)
          newIsDirty = false
        }
      } else {
        // No campaign selected
        newEditingGrid = []
        newIsDirty = false
      }

      return {
        selectedCampaign: campaign,
        editingGrids: newEditingGrids,
        editingGrid: newEditingGrid,
        isDirty: newIsDirty,
      }
    })
  },

  // Create campaign
  createCampaign: async (data: CampaignCreate) => {
    set({ isSaving: true, error: null })
    try {
      const campaign = await api.createCampaign(data)
      set(state => ({
        campaigns: [campaign, ...state.campaigns],
        isSaving: false,
      }))
      return campaign
    } catch (error: any) {
      set({ error: error.message || 'Failed to create campaign', isSaving: false })
      return null
    }
  },

  // Update campaign
  updateCampaign: async (id: string, data: Partial<CampaignCreate>) => {
    set({ isSaving: true, error: null })
    try {
      const campaign = await api.updateCampaign(id, data)
      set(state => ({
        campaigns: state.campaigns.map(c => c._id === id ? campaign : c),
        selectedCampaign: state.selectedCampaign?._id === id ? campaign : state.selectedCampaign,
        isSaving: false,
      }))
      return campaign
    } catch (error: any) {
      set({ error: error.message || 'Failed to update campaign', isSaving: false })
      return null
    }
  },

  // Delete campaign
  deleteCampaign: async (id: string, hardDelete = false) => {
    set({ isSaving: true, error: null })
    try {
      await api.deleteCampaign(id, hardDelete)
      set(state => ({
        campaigns: hardDelete
          ? state.campaigns.filter(c => c._id !== id)
          : state.campaigns.map(c => c._id === id ? { ...c, status: 'deleted' as CampaignStatus } : c),
        selectedCampaign: state.selectedCampaign?._id === id ? null : state.selectedCampaign,
        isSaving: false,
      }))
      return true
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete campaign', isSaving: false })
      return false
    }
  },

  // Toggle status
  toggleCampaignStatus: async (id: string) => {
    set({ isSaving: true, error: null })
    try {
      const campaign = await api.toggleCampaignStatus(id)
      set(state => ({
        campaigns: state.campaigns.map(c => c._id === id ? campaign : c),
        selectedCampaign: state.selectedCampaign?._id === id ? campaign : state.selectedCampaign,
        isSaving: false,
      }))
      return campaign
    } catch (error: any) {
      set({ error: error.message || 'Failed to toggle campaign status', isSaving: false })
      return null
    }
  },

  // Clone a campaign
  cloneCampaign: async (id: string) => {
    set({ isSaving: true, error: null })
    try {
      const clonedCampaign = await api.cloneCampaign(id)
      set(state => ({
        campaigns: [clonedCampaign, ...state.campaigns],
        selectedCampaign: clonedCampaign,
        isSaving: false,
      }))
      return clonedCampaign
    } catch (error: any) {
      set({ error: error.message || 'Failed to clone campaign', isSaving: false })
      return null
    }
  },

  // Initialize editing grid from campaign
  initEditingGrid: (campaign: Campaign) => {
    set(state => {
      // Filter out legacy day_of_week format slots
      const cleanGrid = campaign.schedule_grid.filter(slot => 'slot_date' in slot && slot.slot_date)

      // Also update the editingGrids map
      const newEditingGrids = new Map(state.editingGrids)
      newEditingGrids.set(campaign._id, [...cleanGrid])

      return {
        editingGrid: [...cleanGrid],
        isDirty: false,
        editingGrids: newEditingGrids,
      }
    })
  },

  // Set editing grid directly (for copying from another campaign)
  setEditingGrid: (grid: WeeklySlot[]) => {
    const campaignId = get().selectedCampaign?._id
    // Filter out legacy day_of_week format slots
    const cleanGrid = grid.filter(slot => 'slot_date' in slot && slot.slot_date)

    set(state => {
      const newDirtyGrids = new Set(state.dirtyGrids)
      if (campaignId) newDirtyGrids.add(campaignId)

      // Also update the editingGrids map to keep it in sync
      const newEditingGrids = new Map(state.editingGrids)
      if (campaignId) newEditingGrids.set(campaignId, [...cleanGrid])

      return {
        editingGrid: [...cleanGrid],
        isDirty: true,
        dirtyGrids: newDirtyGrids,
        editingGrids: newEditingGrids,
      }
    })
  },

  // Update slot in editing grid
  updateSlot: (slotDate: string, slotIndex: number, playCount: number) => {
    const campaignId = get().selectedCampaign?._id
    set(state => {
      const grid = [...state.editingGrid]
      const existingIdx = grid.findIndex(
        s => s.slot_date === slotDate && s.slot_index === slotIndex
      )

      if (playCount === 0) {
        // Remove slot if count is 0
        if (existingIdx >= 0) {
          grid.splice(existingIdx, 1)
        }
      } else if (existingIdx >= 0) {
        // Update existing slot
        grid[existingIdx] = { slot_date: slotDate, slot_index: slotIndex, play_count: playCount }
      } else {
        // Add new slot
        grid.push({ slot_date: slotDate, slot_index: slotIndex, play_count: playCount })
      }

      // Mark this campaign as dirty
      const newDirtyGrids = new Set(state.dirtyGrids)
      if (campaignId) newDirtyGrids.add(campaignId)

      // Also update the editingGrids map to keep it in sync
      const newEditingGrids = new Map(state.editingGrids)
      if (campaignId) newEditingGrids.set(campaignId, grid)

      return {
        editingGrid: grid,
        isDirty: true,
        dirtyGrids: newDirtyGrids,
        editingGrids: newEditingGrids,
      }
    })
  },

  // Increment slot
  incrementSlot: (slotDate: string, slotIndex: number) => {
    const current = getSlotPlayCount(get().editingGrid, slotDate, slotIndex)
    get().updateSlot(slotDate, slotIndex, current + 1)
  },

  // Decrement slot
  decrementSlot: (slotDate: string, slotIndex: number) => {
    const current = getSlotPlayCount(get().editingGrid, slotDate, slotIndex)
    if (current > 0) {
      get().updateSlot(slotDate, slotIndex, current - 1)
    }
  },

  // Save grid to server
  saveGrid: async (campaignId: string) => {
    set({ isSaving: true, error: null })
    try {
      // Filter out any legacy slots with day_of_week format (only keep slot_date format)
      const cleanGrid = get().editingGrid.filter(slot => 'slot_date' in slot && slot.slot_date)
      const campaign = await api.updateCampaignGrid(campaignId, cleanGrid)
      set(state => {
        // Clear dirty state for this campaign
        const newDirtyGrids = new Set(state.dirtyGrids)
        newDirtyGrids.delete(campaignId)
        const newEditingGrids = new Map(state.editingGrids)
        newEditingGrids.delete(campaignId)

        return {
          campaigns: state.campaigns.map(c => c._id === campaignId ? campaign : c),
          selectedCampaign: state.selectedCampaign?._id === campaignId ? campaign : state.selectedCampaign,
          isDirty: false,
          isSaving: false,
          dirtyGrids: newDirtyGrids,
          editingGrids: newEditingGrids,
        }
      })
      return true
    } catch (error: any) {
      set({ error: error.message || 'Failed to save grid', isSaving: false })
      return false
    }
  },

  // Save all pending grids
  saveAllGrids: async () => {
    const state = get()
    const dirtyIds = Array.from(state.dirtyGrids)

    if (dirtyIds.length === 0) return true

    set({ isSaving: true, error: null })

    try {
      const results: Campaign[] = []

      for (const campaignId of dirtyIds) {
        // Get the grid for this campaign (from editingGrids map or current editingGrid)
        const grid = campaignId === state.selectedCampaign?._id
          ? state.editingGrid
          : state.editingGrids.get(campaignId)

        if (grid) {
          // Filter out any legacy slots with day_of_week format (only keep slot_date format)
          const cleanGrid = grid.filter(slot => 'slot_date' in slot && slot.slot_date)
          const campaign = await api.updateCampaignGrid(campaignId, cleanGrid)
          results.push(campaign)
        }
      }

      // Update state with all saved campaigns
      set(state => {
        const updatedCampaigns = state.campaigns.map(c => {
          const saved = results.find(r => r._id === c._id)
          return saved || c
        })

        const updatedSelected = state.selectedCampaign
          ? results.find(r => r._id === state.selectedCampaign?._id) || state.selectedCampaign
          : null

        return {
          campaigns: updatedCampaigns,
          selectedCampaign: updatedSelected,
          isDirty: false,
          isSaving: false,
          dirtyGrids: new Set(),
          editingGrids: new Map(),
        }
      })

      return true
    } catch (error: any) {
      set({ error: error.message || 'Failed to save grids', isSaving: false })
      return false
    }
  },

  // Reset grid to original
  resetGrid: () => {
    const campaign = get().selectedCampaign
    if (campaign) {
      set(state => {
        // Clear dirty state for this campaign
        const newDirtyGrids = new Set(state.dirtyGrids)
        newDirtyGrids.delete(campaign._id)
        const newEditingGrids = new Map(state.editingGrids)
        newEditingGrids.delete(campaign._id)

        return {
          editingGrid: [...campaign.schedule_grid],
          isDirty: false,
          dirtyGrids: newDirtyGrids,
          editingGrids: newEditingGrids,
        }
      })
    }
  },

  // Add content to campaign
  addContent: async (campaignId: string, contentRef: ContentRef) => {
    set({ isSaving: true, error: null })
    try {
      const campaign = await api.addCampaignContent(campaignId, contentRef)
      set(state => ({
        campaigns: state.campaigns.map(c => c._id === campaignId ? campaign : c),
        selectedCampaign: state.selectedCampaign?._id === campaignId ? campaign : state.selectedCampaign,
        isSaving: false,
      }))
      return true
    } catch (error: any) {
      set({ error: error.message || 'Failed to add content', isSaving: false })
      return false
    }
  },

  // Remove content from campaign
  removeContent: async (campaignId: string, contentIndex: number) => {
    set({ isSaving: true, error: null })
    try {
      const campaign = await api.removeCampaignContent(campaignId, contentIndex)
      set(state => ({
        campaigns: state.campaigns.map(c => c._id === campaignId ? campaign : c),
        selectedCampaign: state.selectedCampaign?._id === campaignId ? campaign : state.selectedCampaign,
        isSaving: false,
      }))
      return true
    } catch (error: any) {
      set({ error: error.message || 'Failed to remove content', isSaving: false })
      return false
    }
  },

  // Fetch daily preview
  fetchDailyPreview: async (date?: string) => {
    set({ isLoading: true, error: null })
    try {
      const preview = await api.getCampaignDailyPreview(date)
      set({ dailyPreview: preview, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch preview', isLoading: false })
    }
  },

  // Sync to calendar
  syncToCalendar: async (campaignId: string) => {
    set({ isSaving: true, error: null })
    try {
      await api.syncCampaignToCalendar(campaignId)
      set({ isSaving: false })
      return true
    } catch (error: any) {
      set({ error: error.message || 'Failed to sync to calendar', isSaving: false })
      return false
    }
  },

  // Fetch campaign stats
  fetchCampaignStats: async (campaignId: string) => {
    try {
      const stats = await api.getCampaignStats(campaignId)
      return stats
    } catch (error: any) {
      console.error('Failed to fetch campaign stats:', error)
      return null
    }
  },

  // Helpers
  clearError: () => set({ error: null }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  hasAnyUnsavedChanges: () => get().dirtyGrids.size > 0,
  getUnsavedCampaignIds: () => Array.from(get().dirtyGrids),
}))

import { create } from 'zustand'
import { api } from '../services/api'

// Action types matching backend FlowActionType enum
export type FlowActionType =
  | 'play_genre'
  | 'play_content'
  | 'play_commercials'
  | 'play_show'
  | 'wait'
  | 'set_volume'
  | 'announcement'

export interface StudioAction {
  id: string // Client-side unique ID for drag-and-drop
  action_type: FlowActionType
  // Parameters
  genre?: string
  content_id?: string
  content_title?: string
  commercial_count?: number
  batch_number?: number
  song_count?: number
  duration_minutes?: number
  volume_level?: number
  announcement_text?: string
  // Display
  description?: string
  description_he?: string
  // Validation
  isValid: boolean
  validationErrors: string[]
}

export interface FlowSchedule {
  start_time?: string
  end_time?: string
  start_datetime?: string
  end_datetime?: string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  days_of_week: number[]
  day_of_month?: number
  month?: number
}

export type SimulatorState = 'idle' | 'playing' | 'paused' | 'finished'

interface ActionsStudioState {
  // Flow data
  flowId: string | null
  flowName: string
  flowNameHe: string
  description: string
  descriptionHe: string
  actions: StudioAction[]
  isLoop: boolean
  triggerType: 'scheduled' | 'manual'
  schedule: FlowSchedule | null

  // UI state
  selectedBlockId: string | null
  isDirty: boolean
  isLoading: boolean
  isSaving: boolean

  // Simulator state
  simulatorState: SimulatorState
  currentSimStep: number
  simulatedTime: number // in seconds

  // Actions
  setFlowId: (id: string | null) => void
  setFlowName: (name: string) => void
  setFlowNameHe: (name: string) => void
  setDescription: (desc: string) => void
  setDescriptionHe: (desc: string) => void
  setIsLoop: (loop: boolean) => void
  setTriggerType: (type: 'scheduled' | 'manual') => void
  setSchedule: (schedule: FlowSchedule | null) => void

  // Action management
  addAction: (action: Omit<StudioAction, 'id' | 'isValid' | 'validationErrors'>, index?: number) => void
  updateAction: (id: string, updates: Partial<StudioAction>) => void
  removeAction: (id: string) => void
  reorderActions: (fromIndex: number, toIndex: number) => void
  selectBlock: (id: string | null) => void
  clearActions: () => void

  // Simulator actions
  startSimulation: () => void
  pauseSimulation: () => void
  stepSimulation: () => void
  resetSimulation: () => void

  // Persistence
  saveFlow: () => Promise<{ success: boolean; error?: string; flowId?: string }>
  loadFlow: (flowId: string) => Promise<void>
  createNewFlow: () => void
  setLoading: (loading: boolean) => void
  markClean: () => void
}

// Generate unique ID for actions
const generateId = () => `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Validate a single action
const validateAction = (action: StudioAction): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  switch (action.action_type) {
    case 'play_genre':
      if (!action.genre) {
        errors.push('Genre is required')
      }
      if (!action.duration_minutes && !action.song_count) {
        errors.push('Duration or song count is required')
      }
      break
    case 'play_content':
    case 'play_show':
      if (!action.content_id && !action.content_title) {
        errors.push('Content selection is required')
      }
      break
    case 'play_commercials':
      if (!action.commercial_count || action.commercial_count < 1) {
        errors.push('At least 1 commercial is required')
      }
      break
    case 'wait':
      if (!action.duration_minutes || action.duration_minutes < 1) {
        errors.push('Wait duration is required')
      }
      break
    case 'set_volume':
      if (action.volume_level === undefined || action.volume_level < 0 || action.volume_level > 100) {
        errors.push('Volume must be between 0 and 100')
      }
      break
    case 'announcement':
      if (!action.announcement_text?.trim()) {
        errors.push('Announcement text is required')
      }
      break
  }

  return { isValid: errors.length === 0, errors }
}

// Calculate estimated duration for an action (in seconds)
export const getActionDuration = (action: StudioAction): number => {
  switch (action.action_type) {
    case 'play_genre':
      if (action.duration_minutes) return action.duration_minutes * 60
      if (action.song_count) return action.song_count * 210 // ~3.5 min per song
      return 0
    case 'play_content':
    case 'play_show':
      return 180 // Default 3 min for content
    case 'play_commercials':
      return (action.commercial_count || 1) * 30 // ~30s per commercial
    case 'wait':
      return (action.duration_minutes || 0) * 60
    case 'set_volume':
      return 0 // Instant
    case 'announcement':
      // Estimate ~10 seconds per 100 characters
      return Math.max(10, ((action.announcement_text?.length || 0) / 100) * 10)
    default:
      return 0
  }
}

// Get display name for action type
export const getActionDisplayName = (type: FlowActionType, isRTL: boolean = false): string => {
  const names: Record<FlowActionType, { en: string; he: string }> = {
    play_genre: { en: 'Play Genre', he: 'נגן ז\'אנר' },
    play_content: { en: 'Play Content', he: 'נגן תוכן' },
    play_commercials: { en: 'Play Commercials', he: 'נגן פרסומות' },
    play_show: { en: 'Play Show', he: 'נגן תוכנית' },
    wait: { en: 'Wait', he: 'המתן' },
    set_volume: { en: 'Set Volume', he: 'קבע עוצמה' },
    announcement: { en: 'Announcement', he: 'הכרזה' },
  }
  return isRTL ? names[type].he : names[type].en
}

// Get action category
export const getActionCategory = (type: FlowActionType): 'playback' | 'control' | 'audio' => {
  switch (type) {
    case 'play_genre':
    case 'play_content':
    case 'play_show':
      return 'playback'
    case 'play_commercials':
    case 'wait':
      return 'control'
    case 'set_volume':
    case 'announcement':
      return 'audio'
  }
}

export const useActionsStudioStore = create<ActionsStudioState>((set, get) => ({
  // Initial state
  flowId: null,
  flowName: '',
  flowNameHe: '',
  description: '',
  descriptionHe: '',
  actions: [],
  isLoop: false,
  triggerType: 'manual',
  schedule: null,

  selectedBlockId: null,
  isDirty: false,
  isLoading: false,
  isSaving: false,

  simulatorState: 'idle',
  currentSimStep: 0,
  simulatedTime: 0,

  // Setters
  setFlowId: (id) => set({ flowId: id }),
  setFlowName: (name) => set({ flowName: name, isDirty: true }),
  setFlowNameHe: (name) => set({ flowNameHe: name, isDirty: true }),
  setDescription: (desc) => set({ description: desc, isDirty: true }),
  setDescriptionHe: (desc) => set({ descriptionHe: desc, isDirty: true }),
  setIsLoop: (loop) => set({ isLoop: loop, isDirty: true }),
  setTriggerType: (type) => set({ triggerType: type, isDirty: true }),
  setSchedule: (schedule) => set({ schedule, isDirty: true }),

  // Action management
  addAction: (actionData, index) => {
    const id = generateId()
    const validation = validateAction({ ...actionData, id, isValid: true, validationErrors: [] } as StudioAction)
    const newAction: StudioAction = {
      ...actionData,
      id,
      isValid: validation.isValid,
      validationErrors: validation.errors,
    }

    set((state) => {
      const actions = [...state.actions]
      if (index !== undefined && index >= 0 && index <= actions.length) {
        actions.splice(index, 0, newAction)
      } else {
        actions.push(newAction)
      }
      return { actions, isDirty: true }
    })
  },

  updateAction: (id, updates) => {
    set((state) => {
      const actions = state.actions.map((action) => {
        if (action.id === id) {
          const updated = { ...action, ...updates }
          const validation = validateAction(updated)
          return { ...updated, isValid: validation.isValid, validationErrors: validation.errors }
        }
        return action
      })
      return { actions, isDirty: true }
    })
  },

  removeAction: (id) => {
    set((state) => ({
      actions: state.actions.filter((a) => a.id !== id),
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      isDirty: true,
    }))
  },

  reorderActions: (fromIndex, toIndex) => {
    set((state) => {
      const actions = [...state.actions]
      const [moved] = actions.splice(fromIndex, 1)
      actions.splice(toIndex, 0, moved)
      return { actions, isDirty: true }
    })
  },

  selectBlock: (id) => set({ selectedBlockId: id }),

  clearActions: () => set({ actions: [], selectedBlockId: null, isDirty: true }),

  // Simulator
  startSimulation: () => {
    const { actions, simulatorState } = get()
    if (actions.length === 0) return

    if (simulatorState === 'paused') {
      set({ simulatorState: 'playing' })
    } else {
      set({ simulatorState: 'playing', currentSimStep: 0, simulatedTime: 0 })
    }
  },

  pauseSimulation: () => set({ simulatorState: 'paused' }),

  stepSimulation: () => {
    const { actions, currentSimStep: currentStep } = get()
    if (currentStep < actions.length - 1) {
      const currentAction = actions[currentStep]
      const duration = getActionDuration(currentAction)
      set((state) => ({
        currentSimStep: state.currentSimStep + 1,
        simulatedTime: state.simulatedTime + duration,
        simulatorState: state.currentSimStep + 1 >= actions.length - 1 ? 'finished' : state.simulatorState,
      }))
    } else {
      set({ simulatorState: 'finished' })
    }
  },

  resetSimulation: () => set({ simulatorState: 'idle', currentSimStep: 0, simulatedTime: 0 }),

  // Persistence
  saveFlow: async () => {
    const state = get()
    set({ isSaving: true })

    try {
      // Convert actions to backend format (remove client-side fields)
      const backendActions = state.actions.map(({ id, isValid, validationErrors, ...rest }) => rest)

      const flowData: any = {
        name: state.flowName,
        name_he: state.flowNameHe || undefined,
        description: state.description || undefined,
        description_he: state.descriptionHe || undefined,
        actions: backendActions,
        trigger_type: state.triggerType,
        loop: state.isLoop,
        priority: 0,
      }

      // Only include schedule if it's valid
      if (state.schedule) {
        flowData.schedule = state.schedule
      }

      let result
      if (state.flowId) {
        // Update existing flow
        result = await api.updateFlow(state.flowId, flowData)
      } else {
        // Create new flow
        result = await api.createFlow(flowData)
      }

      set({ isDirty: false, isSaving: false, flowId: result._id || state.flowId })
      return { success: true, flowId: result._id || state.flowId }
    } catch (error: any) {
      set({ isSaving: false })
      return { success: false, error: error.message || 'Failed to save flow' }
    }
  },

  loadFlow: async (flowId) => {
    set({ isLoading: true })

    try {
      const flows = await api.getFlows()
      const flow = flows.find((f: any) => f._id === flowId)

      if (!flow) {
        throw new Error('Flow not found')
      }

      // Convert backend actions to studio format
      const studioActions: StudioAction[] = flow.actions.map((action: any, index: number) => {
        const validation = validateAction({ ...action, id: '', isValid: true, validationErrors: [] } as StudioAction)
        return {
          ...action,
          id: `action-loaded-${index}-${Date.now()}`,
          isValid: validation.isValid,
          validationErrors: validation.errors,
        }
      })

      set({
        flowId: flow._id,
        flowName: flow.name,
        flowNameHe: flow.name_he || '',
        description: flow.description || '',
        descriptionHe: flow.description_he || '',
        actions: studioActions,
        isLoop: flow.loop || false,
        triggerType: flow.trigger_type || 'manual',
        schedule: flow.schedule || null,
        isDirty: false,
        isLoading: false,
        selectedBlockId: null,
        simulatorState: 'idle',
        currentSimStep: 0,
        simulatedTime: 0,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createNewFlow: () => {
    set({
      flowId: null,
      flowName: '',
      flowNameHe: '',
      description: '',
      descriptionHe: '',
      actions: [],
      isLoop: false,
      triggerType: 'manual',
      schedule: null,
      selectedBlockId: null,
      isDirty: false,
      isLoading: false,
      isSaving: false,
      simulatorState: 'idle',
      currentSimStep: 0,
      simulatedTime: 0,
    })
  },

  setLoading: (loading) => set({ isLoading: loading }),
  markClean: () => set({ isDirty: false }),
}))

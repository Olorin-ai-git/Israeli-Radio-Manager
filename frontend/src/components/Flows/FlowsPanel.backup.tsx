import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Pause,
  Trash2,
  Music,
  Megaphone,
  Clock,
  Loader2,
  X,
  Edit,
  Calendar,
  Sparkles,
  Eye,
  CheckCircle,
  GripVertical,
  RotateCcw,
  Repeat,
  Wand2,
  Hand
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../services/api'
import { Input, Textarea, Select, Checkbox } from '../Form'

// Genre and flow description parsing is now done via Claude API
// Flow description parsing is now done via API (parseNaturalFlow endpoint)

// Suggested built-in flows
const SUGGESTED_FLOWS = [
  {
    id: 'morning_happy',
    name: 'Happy Morning Show',
    name_he: 'תוכנית בוקר שמחה',
    description: 'Play happy israeli music, then 2 commercials, then mizrahi',
    description_he: 'נגן מוזיקה ישראלית שמחה, אז 2 פרסומות, אז מזרחי',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '08:00',
      end_time: '10:00',
      recurrence: 'weekly' as RecurrenceType,
      days_of_week: [0, 1, 2, 3, 4],  // Sun-Thu
    },
    actions: [
      { action_type: 'play_genre', genre: 'happy', duration_minutes: 45, description: 'Play happy music' },
      { action_type: 'play_commercials', commercial_count: 2, description: 'Play 2 commercials' },
      { action_type: 'play_genre', genre: 'mizrahi', duration_minutes: 30, description: 'Play mizrahi music' },
    ]
  },
  {
    id: 'friday_special',
    name: 'Friday Hasidi Special',
    name_he: 'מיוחד חסידי לשישי',
    description: 'Play hasidi music for Shabbat preparation',
    description_he: 'נגן מוזיקה חסידית לקראת שבת',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '14:00',
      end_time: '16:00',
      recurrence: 'weekly' as RecurrenceType,
      days_of_week: [5],  // Friday
    },
    actions: [
      { action_type: 'play_genre', genre: 'hasidi', duration_minutes: 120, description: 'Play hasidi music' },
    ]
  },
  {
    id: 'commercial_break',
    name: 'Commercial Break',
    name_he: 'הפסקת פרסומות',
    description: 'Play 3 commercials',
    description_he: 'נגן 3 פרסומות',
    trigger_type: 'manual',
    actions: [
      { action_type: 'play_commercials', commercial_count: 3, description: 'Play 3 commercials' },
    ]
  },
  {
    id: 'evening_mix',
    name: 'Evening Mix',
    name_he: 'מיקס ערב',
    description: 'Play mixed israeli music, then commercials, then mediterranean',
    description_he: 'נגן מיקס ישראלי, אז פרסומות, אז ים תיכוני',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '18:00',
      end_time: '20:00',
      recurrence: 'daily' as RecurrenceType,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
    },
    actions: [
      { action_type: 'play_genre', genre: 'israeli', duration_minutes: 40, description: 'Play israeli music' },
      { action_type: 'play_commercials', commercial_count: 2, description: 'Play 2 commercials' },
      { action_type: 'play_genre', genre: 'mediterranean', duration_minutes: 40, description: 'Play mediterranean music' },
    ]
  },
]

interface FlowAction {
  action_type: string
  genre?: string
  content_id?: string
  commercial_count?: number
  batch_number?: number
  duration_minutes?: number
  description?: string
}

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

interface FlowSchedule {
  // For recurring events
  start_time?: string
  end_time?: string
  // For one-time/multi-day events
  start_datetime?: string
  end_datetime?: string
  // Common fields
  recurrence: RecurrenceType
  days_of_week: number[]
  day_of_month?: number
  month?: number
}

interface Flow {
  _id: string
  name: string
  name_he?: string
  description?: string
  actions: FlowAction[]
  trigger_type: 'scheduled' | 'manual' | 'event'
  schedule?: FlowSchedule
  status: 'active' | 'paused' | 'disabled' | 'running'
  priority: number
  loop: boolean
  last_run?: string
  run_count: number
}

interface FlowsPanelProps {
  collapsed: boolean
  onToggle: () => void
  width?: number
}

const ActionIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'play_genre':
      return <Music size={14} className="text-blue-400" />
    case 'play_commercials':
      return <Megaphone size={14} className="text-orange-400" />
    case 'wait':
      return <Clock size={14} className="text-gray-400" />
    case 'set_volume':
      return <Workflow size={14} className="text-purple-400" />
    default:
      return <Workflow size={14} className="text-primary-400" />
  }
}

const StatusBadge = ({ status, isRunning }: { status: string; isRunning?: boolean }) => {
  const effectiveStatus = isRunning ? 'running' : status
  const colors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    disabled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${colors[effectiveStatus as keyof typeof colors] || colors.disabled}`}>
      {(isRunning || effectiveStatus === 'running') && (
        <Loader2 size={10} className="animate-spin" />
      )}
      {effectiveStatus}
    </span>
  )
}

// Sortable action item for drag and drop
function SortableActionItem({
  action,
  index,
  isRTL,
  onRemove,
}: {
  action: FlowAction & { id: string }
  index: number
  isRTL: boolean
  onRemove: (index: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-xs text-dark-200 p-2 bg-dark-700/50 rounded hover:bg-dark-700 transition-colors group"
    >
      <div className="tooltip-trigger">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-dark-500 hover:text-dark-300 transition-colors"
        >
          <GripVertical size={14} />
        </button>
        <div className="tooltip tooltip-top">
          {isRTL ? 'גרור לשינוי סדר' : 'Drag to reorder'}
        </div>
      </div>
      <ActionIcon type={action.action_type} />
      <span className="flex-1">{action.description || action.action_type}</span>
      {action.duration_minutes && (
        <span className="text-dark-400">({action.duration_minutes} min)</span>
      )}
      {action.genre && (
        <span className="text-dark-400 text-xs">({action.genre})</span>
      )}
      {action.commercial_count && (
        <span className="text-dark-400 text-xs">({action.commercial_count} ads)</span>
      )}
      <div className="tooltip-trigger opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-300 p-1"
        >
          <X size={14} />
        </button>
        <div className="tooltip tooltip-top">
          {isRTL ? 'מחק פעולה' : 'Remove action'}
        </div>
      </div>
    </div>
  )
}

export default function FlowsPanel({ collapsed, onToggle, width = 288 }: FlowsPanelProps) {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRTL = i18n.language === 'he'

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)
  const [showSuggested, setShowSuggested] = useState(false)
  const [flowDescription, setFlowDescription] = useState('')
  const [triggerType, setTriggerType] = useState<'scheduled' | 'manual'>('scheduled')
  const [editTriggerType, setEditTriggerType] = useState<'scheduled' | 'manual'>('scheduled')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly')
  const [editRecurrenceType, setEditRecurrenceType] = useState<RecurrenceType>('weekly')
  const [editFlowDescription, setEditFlowDescription] = useState('')
  const [editParsedActions, setEditParsedActions] = useState<any[]>([])
  const [actionsManuallyModified, setActionsManuallyModified] = useState(false)
  const [previewActions, setPreviewActions] = useState<FlowAction[]>([])
  const [createBuildMode, setCreateBuildMode] = useState<'manual' | 'ai'>('manual')
  const [editBuildMode, setEditBuildMode] = useState<'manual' | 'ai'>('manual')
  const [showAddActionModal, setShowAddActionModal] = useState(false)
  const [addActionContext, setAddActionContext] = useState<'create' | 'edit'>('edit')
  const [selectedActionType, setSelectedActionType] = useState('play_genre')
  const [selectedCommercials, setSelectedCommercials] = useState<Set<string>>(new Set())
  const [flowToPause, setFlowToPause] = useState<Flow | null>(null)
  const [overlapError, setOverlapError] = useState<{ message: string; conflictingFlows: any[] } | null>(null)
  const [runningFlowIds, setRunningFlowIds] = useState<Set<string>>(new Set())

  // Fetch commercials for selection
  const { data: commercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: api.getCommercials,
    enabled: showAddActionModal && selectedActionType === 'play_commercials'
  })

  // Auto-select all commercials when they load
  useEffect(() => {
    if (commercials && selectedActionType === 'play_commercials') {
      setSelectedCommercials(new Set(commercials.map((c: any) => c._id)))
    }
  }, [commercials, selectedActionType])

  // Calculate select all checkbox state
  const selectAllState = useMemo(() => {
    if (!commercials || commercials.length === 0) return 'none'
    const selectedCount = selectedCommercials.size
    if (selectedCount === 0) return 'none'
    if (selectedCount === commercials.length) return 'all'
    return 'partial'
  }, [commercials, selectedCommercials])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // Real-time preview of parsed actions using LLM API (only in AI mode)
  useEffect(() => {
    // Skip auto-parsing in manual mode
    if (createBuildMode !== 'ai') {
      return
    }

    if (!flowDescription.trim()) {
      setPreviewActions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.parseNaturalFlow(flowDescription)
        if (result.actions) {
          setPreviewActions(result.actions)
        }
      } catch (error) {
        console.error('Failed to parse flow description:', error)
        setPreviewActions([])
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timer)
  }, [flowDescription, createBuildMode])

  // Parse edit flow description using LLM API (only in AI mode and if not manually modified)
  useEffect(() => {
    // Skip auto-parsing in manual mode or if user has manually modified actions
    if (editBuildMode !== 'ai' || actionsManuallyModified) {
      return
    }

    if (!editFlowDescription.trim()) {
      setEditParsedActions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.parseNaturalFlow(editFlowDescription)
        if (result.actions) {
          setEditParsedActions(result.actions)
        }
      } catch (error) {
        console.error('Failed to parse flow description:', error)
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timer)
  }, [editFlowDescription, actionsManuallyModified, editBuildMode])

  // Fetch flows
  const { data: flows, isLoading } = useQuery<Flow[]>({
    queryKey: ['flows'],
    queryFn: () => api.getFlows(),
  })

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: (flowId: string) => api.toggleFlow(flowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const runMutation = useMutation({
    mutationFn: (flowId: string) => api.runFlow(flowId),
    onMutate: (flowId) => {
      // Optimistically mark as running
      setRunningFlowIds(prev => new Set(prev).add(flowId))
    },
    onSuccess: (_, flowId) => {
      // Keep showing running until refetch completes
      queryClient.invalidateQueries({ queryKey: ['flows'] }).then(() => {
        // Remove from running set after refetch - the actual status will be shown
        setTimeout(() => {
          setRunningFlowIds(prev => {
            const next = new Set(prev)
            next.delete(flowId)
            return next
          })
        }, 500) // Small delay to ensure UI updates smoothly
      })
    },
    onError: (_, flowId) => {
      // Remove from running set on error
      setRunningFlowIds(prev => {
        const next = new Set(prev)
        next.delete(flowId)
        return next
      })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (flowId: string) => api.resetFlow(flowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (flowId: string) => api.deleteFlow(flowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createFlow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      setShowCreateModal(false)
      setOverlapError(null)
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail && detail.conflicting_flows) {
        setOverlapError(detail)
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ flowId, data }: { flowId: string; data: any }) => api.updateFlow(flowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      closeEditModal()
      setOverlapError(null)
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail && detail.conflicting_flows) {
        setOverlapError(detail)
      }
    },
  })

  const closeEditModal = () => {
    setEditingFlow(null)
    setEditTriggerType('scheduled')
    setEditFlowDescription('')
    setEditParsedActions([])
    setActionsManuallyModified(false)
    setEditBuildMode('manual')
    setShowAddActionModal(false)
    setOverlapError(null)
    setSelectedActionType('play_genre')
    setSelectedCommercials(new Set())
  }

  // Handle drag end for reordering actions (works for both create and edit contexts)
  const handleDragEnd = (event: DragEndEvent, context: 'create' | 'edit' = 'edit') => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).split('-')[1])
      const newIndex = parseInt(String(over.id).split('-')[1])

      if (context === 'create') {
        setPreviewActions((items) => arrayMove(items, oldIndex, newIndex))
      } else {
        setActionsManuallyModified(true)
        setEditParsedActions((items) => arrayMove(items, oldIndex, newIndex))
      }
    }
  }

  // Handle remove action (works for both create and edit contexts)
  const handleRemoveAction = (index: number, context: 'create' | 'edit' = 'edit') => {
    if (context === 'create') {
      setPreviewActions((items) => items.filter((_, idx) => idx !== index))
    } else {
      setActionsManuallyModified(true)
      setEditParsedActions((items) => items.filter((_, idx) => idx !== index))
    }
  }

  // Handle add action (works for both create and edit contexts)
  const handleAddAction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const actionType = formData.get('action_type') as string
    const genre = formData.get('genre') as string
    const batchLetter = formData.get('batch_letter') as string
    const durationMinutes = formData.get('duration_minutes') as string
    const description = formData.get('description') as string

    const newAction: FlowAction = {
      action_type: actionType,
      description: description || undefined,
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : undefined,
      genre: genre || undefined,
    }

    // For commercials, add batch and selected commercial IDs
    if (actionType === 'play_commercials') {
      // Convert batch letter (A, B, C...) to number (1, 2, 3...)
      if (batchLetter && batchLetter !== 'all') {
        newAction.batch_number = batchLetter.toUpperCase().charCodeAt(0) - 64 // A=1, B=2, etc.
        newAction.description = `Play commercials from Batch ${batchLetter.toUpperCase()}`
      }
      // Only set content_id if specific commercials are selected (not all)
      if (selectedCommercials.size > 0 && selectedCommercials.size < (commercials?.length || 0)) {
        newAction.content_id = Array.from(selectedCommercials).join(',')
      }
      newAction.commercial_count = 1 // Play the set once
    }

    if (addActionContext === 'create') {
      setPreviewActions((items) => [...items, newAction])
    } else {
      setActionsManuallyModified(true)
      setEditParsedActions((items) => [...items, newAction])
    }
    setShowAddActionModal(false)
    setSelectedActionType('play_genre')
    setSelectedCommercials(new Set())
  }

  const handleCreateFlow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const loop = formData.get('loop') === 'on'

    // Use the preview actions (submit button is disabled if empty)
    const actions = previewActions

    // Build schedule object if scheduled (using state, not form data)
    let schedule = undefined
    if (triggerType === 'scheduled') {
      if (recurrenceType === 'none') {
        // One-time/multi-day event: use datetime-local inputs
        const startDatetime = formData.get('start_datetime') as string
        const endDatetime = formData.get('end_datetime') as string

        schedule = {
          start_datetime: startDatetime ? new Date(startDatetime).toISOString() : undefined,
          end_datetime: endDatetime ? new Date(endDatetime).toISOString() : undefined,
          recurrence: recurrenceType,
          days_of_week: [],
        }
      } else {
        // Recurring event: use time inputs
        const startTime = formData.get('start_time') as string
        const endTime = formData.get('end_time') as string
        const dayOfMonth = formData.get('day_of_month') as string
        const month = formData.get('month') as string

        // Collect selected days (for weekly recurrence)
        const daysOfWeek: number[] = []
        for (let i = 0; i < 7; i++) {
          if (formData.get(`day_${i}`)) {
            daysOfWeek.push(i)
          }
        }

        schedule = {
          start_time: startTime || '09:00',
          end_time: endTime || undefined,
          recurrence: recurrenceType,
          days_of_week: recurrenceType === 'weekly' ? (daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]) : [],
          day_of_month: (recurrenceType === 'monthly' || recurrenceType === 'yearly') && dayOfMonth ? parseInt(dayOfMonth) : undefined,
          month: recurrenceType === 'yearly' && month ? parseInt(month) : undefined,
        }
      }
    }

    console.log('Creating flow with schedule:', schedule)

    createMutation.mutate({
      name,
      description,
      actions,
      trigger_type: triggerType,
      schedule,
      priority: 0,
      loop,
    })
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setFlowDescription('')
    setPreviewActions([])
    setTriggerType('scheduled')
    setRecurrenceType('weekly')
    setCreateBuildMode('manual')
    setOverlapError(null)
  }

  const handleUseSuggested = (suggested: typeof SUGGESTED_FLOWS[0]) => {
    createMutation.mutate({
      name: suggested.name,
      name_he: suggested.name_he,
      description: isRTL ? suggested.description_he : suggested.description,
      actions: suggested.actions,
      trigger_type: suggested.trigger_type,
      schedule: suggested.schedule,
      priority: 0,
      loop: false,
    })
    setShowSuggested(false)
  }

  return (
    <div
      className={`h-full flex flex-col relative transition-all duration-300 ease-in-out ${collapsed ? 'bg-dark-900/95 border-r border-white/5' : 'glass-sidebar'}`}
      style={{ width: collapsed ? '64px' : `${width}px` }}
    >
      {/* Collapsed view - icons only (no backdrop-blur to allow tooltip overflow) */}
      <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 overflow-visible ${collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Collapse toggle at top */}
        <div className="p-3 border-b border-white/5 flex justify-center">
          <div className="group tooltip-trigger">
            <button
              onClick={onToggle}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className="text-dark-300 transition-transform" />
            </button>
            <div className="tooltip tooltip-right">
              {isRTL ? 'הרחב' : 'Expand'}
            </div>
          </div>
        </div>

        {/* Flow icons */}
        <div className="flex-1 flex flex-col items-center py-4 gap-3 overflow-visible">
          <div className="p-2 bg-primary-500/20 rounded-xl mb-2 group tooltip-trigger">
            <Workflow size={20} className="text-primary-400" />
            <div className="tooltip tooltip-right">
              {isRTL ? 'זרימות' : 'Flows'}
            </div>
          </div>
          {(Array.isArray(flows) ? flows : []).slice(0, 8).map((flow) => (
            <div key={flow._id} className="group tooltip-trigger">
              <button
                onClick={() => {
                  onToggle()
                  setExpandedFlow(flow._id)
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${
                  flow.status === 'active'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : flow.status === 'running'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-dark-700/50 text-dark-400 border border-white/5 hover:border-white/20'
                }`}
              >
                <Workflow size={16} />
              </button>
              <div className="tooltip tooltip-right">
                <div className="font-medium">{flow.name}</div>
                {flow.status && (
                  <div className={`text-[10px] ${
                    flow.status === 'active' ? 'text-green-400' :
                    flow.status === 'running' ? 'text-blue-400' : 'text-dark-400'
                  }`}>
                    {flow.status === 'active' ? (isRTL ? 'פעיל' : 'Active') :
                     flow.status === 'running' ? (isRTL ? 'רץ' : 'Running') :
                     (isRTL ? 'לא פעיל' : 'Inactive')}
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Add new flow button */}
          <div className="group tooltip-trigger">
            <button
              onClick={() => {
                onToggle()
                setShowCreateModal(true)
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all hover:scale-110"
            >
              <Plus size={18} />
            </button>
            <div className="tooltip tooltip-right">
              {isRTL ? 'זרימה חדשה' : 'New Flow'}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded view - full content */}
      <div className={`flex flex-col h-full transition-opacity duration-300 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow size={20} className="text-primary-400" />
          <h2 className="font-semibold text-dark-100">
            {isRTL ? 'זרימות אוטומטיות' : 'Auto Flows'}
          </h2>
        </div>
        <div className="tooltip-trigger">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} className="text-dark-300" />
          </button>
          <div className="tooltip tooltip-left">
            {isRTL ? 'כווץ' : 'Collapse'}
          </div>
        </div>
      </div>

      {/* Add Flow Button */}
      <div className="p-3 border-b border-white/5 space-y-2">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full glass-button-primary flex items-center justify-center gap-2 py-2 text-sm"
        >
          <Plus size={16} />
          <span>{isRTL ? 'זרימה חדשה' : 'New Flow'}</span>
        </button>
        <button
          onClick={() => setShowSuggested(true)}
          className="w-full glass-button flex items-center justify-center gap-2 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10"
        >
          <Sparkles size={16} />
          <span>{isRTL ? 'זרימות מוצעות' : 'Suggested Flows'}</span>
        </button>
      </div>

      {/* Flows List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        ) : Array.isArray(flows) && flows.length > 0 ? (
          flows.map((flow) => (
            <div
              key={flow._id}
              className={`glass-card p-3 transition-all ${
                expandedFlow === flow._id ? 'ring-1 ring-primary-500' : ''
              }`}
            >
              {/* Flow Header */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setExpandedFlow(expandedFlow === flow._id ? null : flow._id)}
                  className="flex-1 min-w-0 text-start"
                >
                  <h3 className="font-medium text-dark-100 text-sm truncate" dir="auto">
                    {isRTL ? flow.name_he || flow.name : flow.name}
                  </h3>
                </button>
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  {flow.loop && (
                    <span className="tooltip-trigger text-primary-400">
                      <Repeat size={14} />
                      <span className="tooltip tooltip-top">
                        {isRTL ? 'זרימה חוזרת' : 'Looping'}
                      </span>
                    </span>
                  )}
                  <StatusBadge status={flow.status} isRunning={runningFlowIds.has(flow._id)} />
                </div>
              </div>

              {/* Actions Preview */}
              <div className="flex items-center gap-1 mb-2">
                {(flow.actions || []).slice(0, 4).map((action, idx) => {
                  // Build detailed tooltip
                  let tooltip = action.description || action.action_type
                  if (action.genre) tooltip += ` (${action.genre})`
                  if (action.duration_minutes) tooltip += ` - ${action.duration_minutes} min`
                  if (action.commercial_count) tooltip += ` (${action.commercial_count} ads)`

                  return (
                    <div
                      key={idx}
                      className="w-6 h-6 rounded bg-dark-700/50 flex items-center justify-center hover:bg-dark-700 transition-colors cursor-help tooltip-trigger"
                    >
                      <ActionIcon type={action.action_type} />
                      <div className="tooltip tooltip-top">{tooltip}</div>
                    </div>
                  )
                })}
                {(flow.actions || []).length > 4 && (
                  <span className="text-xs text-dark-400">+{(flow.actions || []).length - 4}</span>
                )}
              </div>

              {/* Schedule Info */}
              {flow.schedule && (
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-1 text-xs text-dark-400">
                    <Calendar size={12} />
                    {flow.schedule.recurrence === 'none' && flow.schedule.start_datetime && flow.schedule.end_datetime ? (
                      // One-time/multi-day flow: show datetime range
                      <>
                        <span className="text-[10px]">
                          {new Date(flow.schedule.start_datetime).toLocaleDateString()} {new Date(flow.schedule.start_datetime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </span>
                        <span>→</span>
                        <span className="text-[10px]">
                          {new Date(flow.schedule.end_datetime).toLocaleDateString()} {new Date(flow.schedule.end_datetime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </span>
                      </>
                    ) : (
                      // Recurring flow: show time range
                      <>
                        <span>{flow.schedule.start_time}</span>
                        {flow.schedule.end_time && <span>- {flow.schedule.end_time}</span>}
                        {flow.schedule.recurrence && flow.schedule.recurrence !== 'none' && (
                          <span className="ml-1 px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded text-[10px]">
                            {flow.schedule.recurrence === 'daily' ? (isRTL ? 'יומי' : 'Daily') :
                             flow.schedule.recurrence === 'weekly' ? (isRTL ? 'שבועי' : 'Weekly') :
                             flow.schedule.recurrence === 'monthly' ? (isRTL ? 'חודשי' : 'Monthly') :
                             flow.schedule.recurrence === 'yearly' ? (isRTL ? 'שנתי' : 'Yearly') : ''}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Show specific days/dates for recurring flows */}
                  {flow.schedule.recurrence === 'weekly' && flow.schedule.days_of_week && flow.schedule.days_of_week.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-dark-500 ml-4">
                      {flow.schedule.days_of_week.map((day: number) => {
                        const dayNames = isRTL
                          ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
                          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        return (
                          <span key={day} className="px-1 py-0.5 bg-dark-700/50 rounded">
                            {dayNames[day]}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {flow.schedule.recurrence === 'monthly' && flow.schedule.day_of_month && (
                    <div className="text-[10px] text-dark-500 ml-4">
                      {isRTL ? `יום ${flow.schedule.day_of_month} בחודש` : `Day ${flow.schedule.day_of_month} of month`}
                    </div>
                  )}

                  {flow.schedule.recurrence === 'yearly' && flow.schedule.month && flow.schedule.day_of_month && (
                    <div className="text-[10px] text-dark-500 ml-4">
                      {isRTL
                        ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'][flow.schedule.month - 1]
                        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][flow.schedule.month - 1]
                      } {flow.schedule.day_of_month}
                    </div>
                  )}
                </div>
              )}

              {/* Expanded Details */}
              {expandedFlow === flow._id && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  {/* Description */}
                  {flow.description && (
                    <div className="text-xs text-dark-300 p-2 bg-dark-800/30 rounded" dir="auto">
                      {flow.description}
                    </div>
                  )}

                  {/* Actions List */}
                  <div className="space-y-1">
                    <p className="text-xs text-dark-500 mb-1">{isRTL ? 'פעולות:' : 'Actions:'}</p>
                    {(flow.actions || []).map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-dark-300 p-1.5 bg-dark-800/50 rounded"
                      >
                        <ActionIcon type={action.action_type} />
                        <span>{action.description || action.action_type}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-dark-400">
                    <span>{isRTL ? 'הרצות' : 'Runs'}: {flow.run_count}</span>
                    {flow.last_run && (
                      <span>
                        {isRTL ? 'אחרון' : 'Last'}: {new Date(flow.last_run).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                <div className="tooltip-trigger flex-1">
                  <button
                    onClick={() => {
                      // If pausing an active flow, show confirmation
                      if (flow.status === 'active') {
                        setFlowToPause(flow)
                      } else {
                        // Resuming - no confirmation needed
                        toggleMutation.mutate(flow._id)
                      }
                    }}
                    className="w-full glass-button py-1.5 text-xs flex items-center justify-center gap-1"
                  >
                    {flow.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <div className="tooltip tooltip-top">
                    {flow.status === 'active' ? (isRTL ? 'השהה' : 'Pause') : (isRTL ? 'הפעל' : 'Enable')}
                  </div>
                </div>
                {flow.status === 'running' ? (
                  <div className="tooltip-trigger flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        resetMutation.mutate(flow._id)
                      }}
                      disabled={resetMutation.isPending && resetMutation.variables === flow._id}
                      className="w-full glass-button py-1.5 text-xs flex items-center justify-center gap-1 text-yellow-400 hover:bg-yellow-500/20"
                    >
                      {resetMutation.isPending && resetMutation.variables === flow._id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                    </button>
                    <div className="tooltip tooltip-top">
                      {isRTL ? 'אפס סטטוס' : 'Reset Status'}
                    </div>
                  </div>
                ) : (
                  <div className="tooltip-trigger flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        runMutation.mutate(flow._id)
                      }}
                      disabled={runningFlowIds.has(flow._id)}
                      className="w-full glass-button py-1.5 text-xs flex items-center justify-center gap-1 text-green-400 hover:bg-green-500/20"
                    >
                      {runningFlowIds.has(flow._id) ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                    </button>
                    <div className="tooltip tooltip-top">
                      {isRTL ? 'הפעל עכשיו' : 'Run Now'}
                    </div>
                  </div>
                )}
                <div className="tooltip-trigger">
                  <button
                    onClick={() => {
                      setEditingFlow(flow)
                      setEditTriggerType(flow.trigger_type === 'scheduled' ? 'scheduled' : 'manual')
                      setEditRecurrenceType(flow.schedule?.recurrence || 'weekly')
                      setEditFlowDescription(flow.description || '')
                      setEditParsedActions(flow.actions || [])
                      setOverlapError(null)
                    }}
                    className="glass-button py-1.5 px-2 text-xs text-blue-400 hover:bg-blue-500/20"
                  >
                    <Edit size={12} />
                  </button>
                  <div className="tooltip tooltip-top">
                    {isRTL ? 'ערוך' : 'Edit'}
                  </div>
                </div>
                <div className="tooltip-trigger">
                  <button
                    onClick={() => deleteMutation.mutate(flow._id)}
                    disabled={deleteMutation.isPending && deleteMutation.variables === flow._id}
                    className="glass-button py-1.5 px-2 text-xs text-red-400 hover:bg-red-500/20"
                  >
                    {deleteMutation.isPending && deleteMutation.variables === flow._id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                  <div className="tooltip tooltip-top">
                    {isRTL ? 'מחק' : 'Delete'}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-dark-400">
            <Workflow size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{isRTL ? 'אין זרימות' : 'No flows yet'}</p>
            <p className="text-xs mt-1">
              {isRTL ? 'צור זרימה חדשה להתחיל' : 'Create a new flow to get started'}
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Create Flow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'זרימה חדשה' : 'New Flow'}
              </h3>
              <button
                onClick={handleCloseCreateModal}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFlow} className="space-y-4">
              <Input
                name="name"
                label={isRTL ? 'שם' : 'Name'}
                placeholder={isRTL ? 'לדוגמה: תוכנית בוקר' : 'e.g., Morning Show'}
                required
              />

              {/* Build Mode Toggle */}
              <div className="p-3 bg-dark-800/30 rounded-lg">
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'מצב בנייה' : 'Build Mode'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateBuildMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                      createBuildMode === 'manual'
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    <Hand size={16} />
                    <span className="text-sm">{isRTL ? 'ידני' : 'Manual'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateBuildMode('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                      createBuildMode === 'ai'
                        ? 'bg-purple-500 text-white'
                        : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    <Wand2 size={16} />
                    <span className="text-sm">{isRTL ? 'AI' : 'AI'}</span>
                  </button>
                </div>
                <p className="text-xs text-dark-500 mt-2">
                  {createBuildMode === 'manual'
                    ? (isRTL ? 'הוסף פעולות ידנית אחת אחת' : 'Add actions manually one by one')
                    : (isRTL ? 'תאר את הזרימה ו-AI יפרש אותה לפעולות' : 'Describe the flow and AI will parse it into actions')}
                </p>
              </div>

              {/* Description field - only required in AI mode */}
              <Textarea
                name="description"
                label={`${isRTL ? 'תיאור' : 'Description'}${createBuildMode === 'ai' ? ' *' : ''}`}
                rows={createBuildMode === 'ai' ? 6 : 2}
                value={flowDescription}
                onChange={(e) => setFlowDescription(e.target.value)}
                placeholder={
                  createBuildMode === 'ai'
                    ? (isRTL
                      ? 'תאר את הזרימה: נגן מזרחי שמח, אז שתי פרסומות, אז חסידי'
                      : 'Describe the flow: play happy mizrahi, then 2 commercials, then hasidi')
                    : (isRTL ? 'תיאור אופציונלי...' : 'Optional description...')
                }
                hint={createBuildMode === 'ai' ? (isRTL ? 'השתמש ב"אז" או "then" להפרדה בין פעולות' : 'Use "then" to separate actions') : undefined}
                required={createBuildMode === 'ai'}
              />

              {/* Actions Section */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-primary-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-primary-400" />
                    <span className="text-xs font-medium text-primary-400">
                      {createBuildMode === 'ai'
                        ? (isRTL ? 'תצוגה מקדימה - מה המערכת הבינה:' : 'Preview - What the system understood:')
                        : (isRTL ? 'פעולות:' : 'Actions:')}
                    </span>
                  </div>
                  {createBuildMode === 'manual' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddActionContext('create')
                        setShowAddActionModal(true)
                      }}
                      className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      <Plus size={14} />
                      <span>{isRTL ? 'הוסף פעולה' : 'Add Action'}</span>
                    </button>
                  )}
                </div>
                {previewActions.length > 0 ? (
                  createBuildMode === 'manual' ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, 'create')}
                    >
                      <SortableContext
                        items={previewActions.map((_, idx) => `action-${idx}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1 max-h-48 overflow-auto">
                          {previewActions.map((action, idx) => (
                            <SortableActionItem
                              key={`action-${idx}`}
                              action={{ ...action, id: `action-${idx}` }}
                              index={idx}
                              isRTL={isRTL}
                              onRemove={(index) => handleRemoveAction(index, 'create')}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="space-y-1">
                      {previewActions.map((action, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-dark-200 p-2 bg-dark-700/50 rounded"
                        >
                          <CheckCircle size={12} className="text-green-400" />
                          <ActionIcon type={action.action_type} />
                          <span>{action.description}</span>
                          {action.duration_minutes && (
                            <span className="text-dark-400">({action.duration_minutes} min)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-dark-400 italic">
                    {createBuildMode === 'ai'
                      ? (isRTL ? 'הקלד תיאור לראות פעולות...' : 'Type a description to see actions...')
                      : (isRTL ? 'לחץ "הוסף פעולה" כדי להתחיל' : 'Click "Add Action" to get started')}
                  </p>
                )}
              </div>

              {/* Trigger Type */}
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'סוג הפעלה' : 'Trigger Type'}
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as 'scheduled' | 'manual')}
                  className="w-full glass-input"
                >
                  <option value="scheduled">{isRTL ? 'מתוזמן' : 'Scheduled'}</option>
                  <option value="manual">{isRTL ? 'ידני' : 'Manual'}</option>
                </select>
              </div>

              {/* Schedule Fields - Only show if scheduled */}
              {triggerType === 'scheduled' && (
              <div className="space-y-3 p-3 bg-dark-800/30 rounded-lg">
                <p className="text-xs text-dark-400">
                  {isRTL ? 'הגדרות תזמון (לזרימות מתוזמנות)' : 'Schedule Settings (for scheduled flows)'}
                </p>

                {/* Recurrence Type */}
                <div>
                  <label className="block text-dark-300 text-xs mb-1">
                    {isRTL ? 'חזרה' : 'Repeat'}
                  </label>
                  <select
                    
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                    className="w-full glass-input text-sm"
                  >
                    <option value="none">{isRTL ? 'פעם אחת / מרובה ימים' : 'Once / Multi-day'}</option>
                    <option value="daily">{isRTL ? 'יומי' : 'Daily'}</option>
                    <option value="weekly">{isRTL ? 'שבועי' : 'Weekly'}</option>
                    <option value="monthly">{isRTL ? 'חודשי' : 'Monthly'}</option>
                    <option value="yearly">{isRTL ? 'שנתי' : 'Yearly'}</option>
                  </select>
                </div>

                {/* One-time/Multi-day: Datetime pickers */}
                {recurrenceType === 'none' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-dark-300 text-xs mb-1">
                          {isRTL ? 'תחילה' : 'Start Date & Time'}
                        </label>
                        <input
                          type="datetime-local"
                          name="start_datetime"
                          className="w-full glass-input text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-dark-300 text-xs mb-1">
                          {isRTL ? 'סיום' : 'End Date & Time'}
                        </label>
                        <input
                          type="datetime-local"
                          name="end_datetime"
                          className="w-full glass-input text-sm"
                          required
                        />
                      </div>
                    </div>
                    <p className="text-xs text-dark-500 italic">
                      {isRTL
                        ? 'ניתן ליצור זרימה שנמשכת מספר ימים על ידי הגדרת תאריך וזמן התחלה וסיום'
                        : 'Create multi-day flows by setting start and end date+time'}
                    </p>
                  </>
                )}

                {/* Recurring events: Time pickers */}
                {recurrenceType !== 'none' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'שעת התחלה' : 'Start Time'} *
                      </label>
                      <input
                        type="time"
                        name="start_time"
                        className="w-full glass-input text-sm"
                        defaultValue="09:00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'שעת סיום' : 'End Time'} *
                      </label>
                      <input
                        type="time"
                        name="end_time"
                        className="w-full glass-input text-sm"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Weekly: Day selector */}
                {recurrenceType === 'weekly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-2">
                      {isRTL ? 'ימים' : 'Days'}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(isRTL
                        ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      ).map((day, idx) => (
                        <Checkbox
                          key={idx}
                          name={`day_${idx}`}
                          label={day}
                          defaultChecked
                          className="text-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly: Day of month */}
                {recurrenceType === 'monthly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'יום בחודש' : 'Day of Month'}
                    </label>
                    <select name="day_of_month" className="w-full glass-input text-sm">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Yearly: Month and day */}
                {recurrenceType === 'yearly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'חודש' : 'Month'}
                      </label>
                      <select name="month" className="w-full glass-input text-sm">
                        {(isRTL
                          ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
                          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        ).map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'יום' : 'Day'}
                      </label>
                      <select name="day_of_month" className="w-full glass-input text-sm">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Loop Option - Only show for scheduled flows */}
              {triggerType === 'scheduled' && (
              <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                <Checkbox
                  name="loop"
                  label={isRTL ? 'חזור על הפעולות עד סוף הזמן' : 'Repeat actions until end time'}
                  description={isRTL
                    ? 'אם מוגדר זמן סיום, הזרימה תחזור על כל הפעולות עד שהזמן יגמר'
                    : 'If an end time is set, the flow will repeat all actions until that time'}
                />
              </div>
              )}

              {/* Overlap Error Display */}
              {overlapError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400 font-medium mb-2">
                    {isRTL ? 'חפיפה בלוח זמנים' : 'Schedule Overlap Detected'}
                  </p>
                  <p className="text-sm text-red-300 mb-2">
                    {isRTL
                      ? 'הזרימה חופפת לזרימות הבאות:'
                      : 'This flow overlaps with the following flows:'}
                  </p>
                  <ul className="space-y-1" dir={isRTL ? 'rtl' : 'ltr'}>
                    {overlapError.conflictingFlows.map((flow: any) => (
                      <li key={flow._id} className="text-sm text-red-200 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <div>
                          <span className="font-medium">{flow.name}</span>
                          <span className="text-red-300/70 text-xs ml-2">
                            {flow.schedule?.start_time} - {flow.schedule?.end_time}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <div className="tooltip-trigger flex-1">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || previewActions.length === 0}
                    className="w-full glass-button-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    <span>{isRTL ? 'צור' : 'Create'}</span>
                  </button>
                  {(createMutation.isPending || previewActions.length === 0) && (
                    <div className="tooltip tooltip-top">
                      {createMutation.isPending
                        ? (isRTL ? 'מעבד...' : 'Processing...')
                        : previewActions.length === 0
                        ? (createBuildMode === 'ai'
                          ? (isRTL ? 'אנא הזן תיאור זרימה תקף כדי להמשיך' : 'Please enter a valid flow description to continue')
                          : (isRTL ? 'אנא הוסף לפחות פעולה אחת' : 'Please add at least one action'))
                        : ''}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suggested Flows Modal */}
      {showSuggested && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-400" />
                <h3 className="font-semibold text-dark-100">
                  {isRTL ? 'זרימות מוצעות' : 'Suggested Flows'}
                </h3>
              </div>
              <button
                onClick={() => setShowSuggested(false)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-dark-400 mb-4">
              {isRTL
                ? 'בחר זרימה מוכנה להוספה מהירה. תוכל לערוך אותה אחרי ההוספה.'
                : 'Choose a pre-built flow for quick setup. You can edit it after adding.'}
            </p>

            <div className="space-y-3">
              {SUGGESTED_FLOWS.map((suggested) => (
                <div
                  key={suggested.id}
                  className="glass-card p-4 hover:ring-1 hover:ring-yellow-500/50 transition-all cursor-pointer"
                  onClick={() => handleUseSuggested(suggested)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-dark-100" dir="auto">
                      {isRTL ? suggested.name_he : suggested.name}
                    </h4>
                    {suggested.schedule && (
                      <div className="flex items-center gap-1 text-xs text-primary-400">
                        <Calendar size={12} />
                        <span>{suggested.schedule.start_time}-{suggested.schedule.end_time}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-dark-400 mb-3" dir="auto">
                    {isRTL ? suggested.description_he : suggested.description}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {suggested.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 text-xs bg-dark-700/50 px-2 py-1 rounded"
                      >
                        <ActionIcon type={action.action_type} />
                        <span className="text-dark-300">{action.description}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <button className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                      <Plus size={12} />
                      {isRTL ? 'הוסף זרימה זו' : 'Add this flow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Flow Modal */}
      {editingFlow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'עריכת זרימה' : 'Edit Flow'}
              </h3>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const loop = formData.get('loop') === 'on'

                // Build schedule object (using state editTriggerType, not form data)
                let schedule = undefined
                if (editTriggerType === 'scheduled') {
                  if (editRecurrenceType === 'none') {
                    // One-time/multi-day event: use datetime-local inputs
                    const startDatetime = formData.get('start_datetime') as string
                    const endDatetime = formData.get('end_datetime') as string

                    schedule = {
                      start_datetime: startDatetime ? new Date(startDatetime).toISOString() : undefined,
                      end_datetime: endDatetime ? new Date(endDatetime).toISOString() : undefined,
                      recurrence: editRecurrenceType,
                      days_of_week: [],
                    }
                  } else {
                    // Recurring event: use time inputs
                    const startTime = formData.get('start_time') as string
                    const endTime = formData.get('end_time') as string
                    const dayOfMonth = formData.get('day_of_month') as string
                    const month = formData.get('month') as string

                    // Collect selected days (for weekly recurrence)
                    const daysOfWeek: number[] = []
                    for (let i = 0; i < 7; i++) {
                      if (formData.get(`day_${i}`)) {
                        daysOfWeek.push(i)
                      }
                    }

                    schedule = {
                      start_time: startTime || '09:00',
                      end_time: endTime || undefined,
                      recurrence: editRecurrenceType,
                      days_of_week: editRecurrenceType === 'weekly' ? (daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]) : [],
                      day_of_month: (editRecurrenceType === 'monthly' || editRecurrenceType === 'yearly') && dayOfMonth ? parseInt(dayOfMonth) : undefined,
                      month: editRecurrenceType === 'yearly' && month ? parseInt(month) : undefined,
                    }
                  }
                }

                updateMutation.mutate({
                  flowId: editingFlow._id,
                  data: {
                    name: formData.get('name') as string,
                    description: editFlowDescription,
                    trigger_type: editTriggerType,
                    schedule,
                    actions: editParsedActions.length > 0 ? editParsedActions : editingFlow.actions,
                    loop,
                  },
                })
              }}
              className="space-y-4"
            >
              <Input
                name="name"
                label={isRTL ? 'שם' : 'Name'}
                defaultValue={editingFlow.name}
                required
              />

              {/* Build Mode Toggle */}
              <div className="p-3 bg-dark-800/30 rounded-lg">
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'מצב בנייה' : 'Build Mode'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBuildMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                      editBuildMode === 'manual'
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    <Hand size={16} />
                    <span className="text-sm">{isRTL ? 'ידני' : 'Manual'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditBuildMode('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                      editBuildMode === 'ai'
                        ? 'bg-purple-500 text-white'
                        : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    <Wand2 size={16} />
                    <span className="text-sm">{isRTL ? 'AI' : 'AI'}</span>
                  </button>
                </div>
                <p className="text-xs text-dark-500 mt-2">
                  {editBuildMode === 'manual'
                    ? (isRTL ? 'ערוך פעולות ידנית' : 'Edit actions manually')
                    : (isRTL ? 'עדכן את התיאור ו-AI יפרש אותו לפעולות' : 'Update the description and AI will parse it into actions')}
                </p>
              </div>

              <Textarea
                name="description"
                label={`${isRTL ? 'תיאור' : 'Description'}${editBuildMode === 'ai' ? ' *' : ''}`}
                rows={editBuildMode === 'ai' ? 8 : 2}
                value={editFlowDescription}
                onChange={(e) => setEditFlowDescription(e.target.value)}
                placeholder={
                  editBuildMode === 'ai'
                    ? (isRTL ? 'תאר את הזרימה...' : 'Describe the flow...')
                    : (isRTL ? 'תיאור אופציונלי...' : 'Optional description...')
                }
                hint={editBuildMode === 'ai' ? (isRTL ? 'השתמש ב"אז" או "then" להפרדה בין פעולות' : 'Use "then" to separate actions') : undefined}
              />

              {/* Trigger Type */}
              <Select
                label={isRTL ? 'סוג הפעלה' : 'Trigger Type'}
                value={editTriggerType}
                onChange={(val) => setEditTriggerType(val as 'scheduled' | 'manual')}
                options={[
                  { value: 'scheduled', label: isRTL ? 'מתוזמן' : 'Scheduled' },
                  { value: 'manual', label: isRTL ? 'ידני' : 'Manual' },
                ]}
              />

              {/* Schedule Fields - Only show if scheduled */}
              {editTriggerType === 'scheduled' && (
              <div className="space-y-3 p-3 bg-dark-800/30 rounded-lg">
                <p className="text-xs text-dark-400">
                  {isRTL ? 'הגדרות תזמון' : 'Schedule Settings'}
                </p>

                {/* Recurrence Type */}
                <Select
                  
                  label={isRTL ? 'חזרה' : 'Repeat'}
                  value={editRecurrenceType}
                  onChange={(val) => setEditRecurrenceType(val as RecurrenceType)}
                  options={[
                    { value: 'none', label: isRTL ? 'פעם אחת / מרובה ימים' : 'Once / Multi-day' },
                    { value: 'daily', label: isRTL ? 'יומי' : 'Daily' },
                    { value: 'weekly', label: isRTL ? 'שבועי' : 'Weekly' },
                    { value: 'monthly', label: isRTL ? 'חודשי' : 'Monthly' },
                    { value: 'yearly', label: isRTL ? 'שנתי' : 'Yearly' },
                  ]}
                />

                {/* One-time/Multi-day: Datetime pickers */}
                {editRecurrenceType === 'none' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-dark-300 text-xs mb-1">
                          {isRTL ? 'תחילה' : 'Start Date & Time'}
                        </label>
                        <input
                          type="datetime-local"
                          name="start_datetime"
                          className="w-full glass-input text-sm"
                          defaultValue={editingFlow.schedule?.start_datetime ? new Date(editingFlow.schedule.start_datetime).toISOString().slice(0, 16) : ''}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-dark-300 text-xs mb-1">
                          {isRTL ? 'סיום' : 'End Date & Time'}
                        </label>
                        <input
                          type="datetime-local"
                          name="end_datetime"
                          className="w-full glass-input text-sm"
                          defaultValue={editingFlow.schedule?.end_datetime ? new Date(editingFlow.schedule.end_datetime).toISOString().slice(0, 16) : ''}
                          required
                        />
                      </div>
                    </div>
                    <p className="text-xs text-dark-500 italic">
                      {isRTL
                        ? 'ניתן ליצור זרימה שנמשכת מספר ימים על ידי הגדרת תאריך וזמן התחלה וסיום'
                        : 'Create multi-day flows by setting start and end date+time'}
                    </p>
                  </>
                )}

                {/* Recurring events: Time pickers */}
                {editRecurrenceType !== 'none' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'שעת התחלה' : 'Start Time'} *
                      </label>
                      <input
                        type="time"
                        name="start_time"
                        className="w-full glass-input text-sm"
                        defaultValue={editingFlow.schedule?.start_time || '09:00'}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'שעת סיום' : 'End Time'} *
                      </label>
                      <input
                        type="time"
                        name="end_time"
                        className="w-full glass-input text-sm"
                        defaultValue={editingFlow.schedule?.end_time || ''}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Weekly: Day selector */}
                {editRecurrenceType === 'weekly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-2">
                      {isRTL ? 'ימים' : 'Days'}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(isRTL
                        ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      ).map((day, idx) => (
                        <Checkbox
                          key={idx}
                          name={`day_${idx}`}
                          label={day}
                          defaultChecked={editingFlow.schedule?.days_of_week?.includes(idx) ?? true}
                          className="text-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly: Day of month */}
                {editRecurrenceType === 'monthly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'יום בחודש' : 'Day of Month'}
                    </label>
                    <select
                      name="day_of_month"
                      className="w-full glass-input text-sm"
                      defaultValue={editingFlow.schedule?.day_of_month || 1}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Yearly: Month and day */}
                {editRecurrenceType === 'yearly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'חודש' : 'Month'}
                      </label>
                      <select
                        name="month"
                        className="w-full glass-input text-sm"
                        defaultValue={editingFlow.schedule?.month || 1}
                      >
                        {(isRTL
                          ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
                          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        ).map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'יום' : 'Day'}
                      </label>
                      <select
                        name="day_of_month"
                        className="w-full glass-input text-sm"
                        defaultValue={editingFlow.schedule?.day_of_month || 1}
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Actions Section */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-primary-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-primary-400" />
                    <span className="text-xs font-medium text-primary-400">
                      {editBuildMode === 'ai'
                        ? (isRTL ? 'תצוגה מקדימה - פעולות שזוהו:' : 'Preview - Detected Actions:')
                        : (isRTL ? 'פעולות:' : 'Actions:')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddActionContext('edit')
                      setShowAddActionModal(true)
                    }}
                    className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <Plus size={14} />
                    <span>{isRTL ? 'הוסף פעולה' : 'Add Action'}</span>
                  </button>
                </div>
                {editParsedActions.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, 'edit')}
                  >
                    <SortableContext
                      items={editParsedActions.map((_, idx) => `action-${idx}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1 max-h-48 overflow-auto">
                        {editParsedActions.map((action, idx) => (
                          <SortableActionItem
                            key={`action-${idx}`}
                            action={{ ...action, id: `action-${idx}` }}
                            index={idx}
                            isRTL={isRTL}
                            onRemove={(index) => handleRemoveAction(index, 'edit')}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="text-xs text-dark-400 italic">
                    {editBuildMode === 'ai'
                      ? (isRTL ? 'הקלד תיאור לראות פעולות...' : 'Type a description to see actions...')
                      : (isRTL ? 'לחץ "הוסף פעולה" כדי להתחיל' : 'Click "Add Action" to get started')}
                  </p>
                )}
              </div>

              {/* Loop Option - Only show for scheduled flows */}
              {editTriggerType === 'scheduled' && (
              <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                <Checkbox
                  name="loop"
                  defaultChecked={editingFlow.loop}
                  label={isRTL ? 'חזור על הפעולות עד סוף הזמן' : 'Repeat actions until end time'}
                  description={isRTL
                    ? 'אם מוגדר זמן סיום, הזרימה תחזור על כל הפעולות עד שהזמן יגמר'
                    : 'If an end time is set, the flow will repeat all actions until that time'}
                />
              </div>
              )}

              {/* Overlap Error Display */}
              {overlapError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400 font-medium mb-2">
                    {isRTL ? 'חפיפה בלוח זמנים' : 'Schedule Overlap Detected'}
                  </p>
                  <p className="text-sm text-red-300 mb-2">
                    {isRTL
                      ? 'הזרימה חופפת לזרימות הבאות:'
                      : 'This flow overlaps with the following flows:'}
                  </p>
                  <ul className="space-y-1" dir={isRTL ? 'rtl' : 'ltr'}>
                    {overlapError.conflictingFlows.map((flow: any) => (
                      <li key={flow._id} className="text-sm text-red-200 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <div>
                          <span className="font-medium">{flow.name}</span>
                          <span className="text-red-300/70 text-xs ml-2">
                            {flow.schedule?.start_time} - {flow.schedule?.end_time}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <div className="tooltip-trigger flex-1">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending || editParsedActions.length === 0}
                    className="w-full glass-button-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Edit size={16} />
                    )}
                    <span>{isRTL ? 'שמור' : 'Save'}</span>
                  </button>
                  {(updateMutation.isPending || editParsedActions.length === 0) && (
                    <div className="tooltip tooltip-top">
                      {updateMutation.isPending
                        ? (isRTL ? 'שומר שינויים...' : 'Saving changes...')
                        : editParsedActions.length === 0
                        ? (isRTL ? 'אנא הוסף לפחות פעולה אחת' : 'Please add at least one action')
                        : ''}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Action Modal */}
      {showAddActionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'הוסף פעולה' : 'Add Action'}
              </h3>
              <button
                onClick={() => {
                  setShowAddActionModal(false)
                  setSelectedActionType('play_genre')
                  setSelectedCommercials(new Set())
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddAction} className="space-y-3">
              <Select
                
                label={isRTL ? 'סוג פעולה' : 'Action Type'}
                value={selectedActionType}
                onChange={(val) => setSelectedActionType(val)}
                options={[
                  { value: 'play_genre', label: isRTL ? 'נגן ז\'אנר' : 'Play Genre' },
                  { value: 'play_commercials', label: isRTL ? 'נגן פרסומות' : 'Play Commercials' },
                  { value: 'wait', label: isRTL ? 'המתן' : 'Wait' },
                  { value: 'set_volume', label: isRTL ? 'קבע עוצמת קול' : 'Set Volume' },
                ]}
              />

              <Input
                name="description"
                label={isRTL ? 'תיאור' : 'Description'}
                placeholder={isRTL ? 'תיאור הפעולה' : 'Action description'}
              />

              {selectedActionType !== 'play_commercials' && (
                <Input
                  type="number"
                  name="duration_minutes"
                  label={isRTL ? 'משך זמן (דקות)' : 'Duration (minutes)'}
                  placeholder="30"
                  min={1}
                />
              )}

              {selectedActionType === 'play_genre' && (
                <Select
                  
                  label={isRTL ? 'ז\'אנר' : 'Genre'}
                  value=""
                  onChange={() => {}}
                  options={[
                    { value: '', label: isRTL ? 'בחר ז\'אנר' : 'Select genre' },
                    { value: 'hasidi', label: 'Hasidi' },
                    { value: 'mizrahi', label: 'Mizrahi' },
                    { value: 'happy', label: 'Happy' },
                    { value: 'israeli', label: 'Israeli' },
                    { value: 'pop', label: 'Pop' },
                    { value: 'rock', label: 'Rock' },
                    { value: 'mediterranean', label: 'Mediterranean' },
                    { value: 'classic', label: 'Classic' },
                    { value: 'hebrew', label: 'Hebrew' },
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'all', label: 'All' },
                  ]}
                />
              )}

              {selectedActionType === 'play_commercials' && (
                <>
                  <Select
                    
                    label={isRTL ? 'אצווה' : 'Batch'}
                    value="all"
                    onChange={() => {}}
                    options={[
                      { value: 'all', label: isRTL ? 'הכל' : 'All Batches' },
                      { value: 'A', label: 'Batch A' },
                      { value: 'B', label: 'Batch B' },
                      { value: 'C', label: 'Batch C' },
                      { value: 'D', label: 'Batch D' },
                      { value: 'E', label: 'Batch E' },
                    ]}
                  />

                  <div className="p-3 bg-dark-800/30 rounded-lg max-h-64 overflow-auto">
                    <Checkbox
                      label={`${isRTL ? 'בחר הכל' : 'Select All'} (${selectedCommercials.size}/${commercials?.length || 0})`}
                      checked={selectAllState === 'all'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCommercials(new Set(commercials?.map((c: any) => c._id) || []))
                        } else {
                          setSelectedCommercials(new Set())
                        }
                      }}
                      className="mb-2 pb-2 border-b border-white/10"
                    />

                    {Array.isArray(commercials) && commercials.length > 0 ? (
                      <div className="space-y-1">
                        {commercials.map((commercial: any) => (
                          <Checkbox
                            key={commercial._id}
                            label={commercial.title}
                            description={commercial.artist}
                            checked={selectedCommercials.has(commercial._id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedCommercials)
                              if (e.target.checked) {
                                newSet.add(commercial._id)
                              } else {
                                newSet.delete(commercial._id)
                              }
                              setSelectedCommercials(newSet)
                            }}
                            className="p-2 hover:bg-dark-700/30 rounded"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-dark-500 italic">
                        {isRTL ? 'אין פרסומות זמינות' : 'No commercials available'}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddActionModal(false)
                    setSelectedActionType('play_genre')
                    setSelectedCommercials(new Set())
                  }}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span>{isRTL ? 'הוסף' : 'Add'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pause Flow Confirmation Modal */}
      {flowToPause && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-500/20 rounded-xl">
                <Pause size={24} className="text-yellow-400" />
              </div>
              <h3 className="font-semibold text-dark-100 text-lg">
                {isRTL ? 'השהיית זרימה' : 'Pause Flow'}
              </h3>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-dark-200">
                {isRTL
                  ? `האם אתה בטוח שברצונך להשהות את "${flowToPause.name}"?`
                  : `Are you sure you want to pause "${flowToPause.name}"?`}
              </p>

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-200">
                  {isRTL
                    ? 'השהיית זרימה תבצע את הפעולות הבאות:'
                    : 'Pausing this flow will:'}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-dark-300" dir={isRTL ? 'rtl' : 'ltr'}>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>
                      {isRTL
                        ? 'מחק את האירוע מיומן Google Calendar'
                        : 'Delete the event from Google Calendar'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>
                      {isRTL
                        ? 'עצור את הזרימה מלרוץ אוטומטית בזמנים המתוזמנים'
                        : 'Stop the flow from running automatically at scheduled times'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>
                      {isRTL
                        ? 'ניתן יהיה להפעיל מחדש את הזרימה בכל עת'
                        : 'You can resume the flow at any time'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFlowToPause(null)}
                className="flex-1 glass-button py-2"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  toggleMutation.mutate(flowToPause._id)
                  setFlowToPause(null)
                }}
                className="flex-1 bg-yellow-500/80 hover:bg-yellow-500 text-dark-950 font-medium py-2 rounded-xl transition-colors"
              >
                {isRTL ? 'השהה זרימה' : 'Pause Flow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

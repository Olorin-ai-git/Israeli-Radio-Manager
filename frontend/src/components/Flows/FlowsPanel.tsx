/**
 * Flows Panel - Main component for managing automated flows
 * Refactored to use extracted sub-components
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  X,
  Edit,
  Sparkles,
  Eye,
  CheckCircle,
  Hand,
  Wand2,
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
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { api } from '../../services/api'
import { Input, Textarea, Select } from '../Form'

// Import types and constants
import { Flow, FlowAction, RecurrenceType } from './types'
import { SUGGESTED_FLOWS } from './constants'

// Import components
import {
  ActionIcon,
  SortableActionItem,
  FlowCard,
  ScheduleForm,
} from './components'

// Import modals
import {
  AddActionModal,
  PauseFlowModal,
  SuggestedFlowsModal,
} from './modals'

interface FlowsPanelProps {
  collapsed: boolean
  onToggle: () => void
  width?: number
}

export default function FlowsPanel({ collapsed, onToggle, width = 288 }: FlowsPanelProps) {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRTL = i18n.language === 'he'

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)
  const [showSuggested, setShowSuggested] = useState(false)
  const [flowToPause, setFlowToPause] = useState<Flow | null>(null)
  const [showAddActionModal, setShowAddActionModal] = useState(false)
  const [addActionContext, setAddActionContext] = useState<'create' | 'edit'>('edit')

  // Form states
  const [flowDescription, setFlowDescription] = useState('')
  const [triggerType, setTriggerType] = useState<'scheduled' | 'manual'>('scheduled')
  const [editTriggerType, setEditTriggerType] = useState<'scheduled' | 'manual'>('scheduled')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly')
  const [editRecurrenceType, setEditRecurrenceType] = useState<RecurrenceType>('weekly')
  const [editFlowDescription, setEditFlowDescription] = useState('')
  const [editParsedActions, setEditParsedActions] = useState<FlowAction[]>([])
  const [actionsManuallyModified, setActionsManuallyModified] = useState(false)
  const [previewActions, setPreviewActions] = useState<FlowAction[]>([])
  const [createBuildMode, setCreateBuildMode] = useState<'manual' | 'ai'>('manual')
  const [editBuildMode, setEditBuildMode] = useState<'manual' | 'ai'>('manual')
  const [overlapError, setOverlapError] = useState<{ message: string; conflictingFlows: any[] } | null>(null)
  const [runningFlowIds, setRunningFlowIds] = useState<Set<string>>(new Set())

  // Drag and drop sensors - activation constraint prevents accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Real-time preview of parsed actions using LLM API (only in AI mode)
  useEffect(() => {
    if (createBuildMode !== 'ai' || !flowDescription.trim()) {
      if (createBuildMode === 'ai') setPreviewActions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.parseNaturalFlow(flowDescription)
        if (result.actions) setPreviewActions(result.actions)
      } catch (error) {
        console.error('Failed to parse flow description:', error)
        setPreviewActions([])
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [flowDescription, createBuildMode])

  // Parse edit flow description using LLM API
  useEffect(() => {
    if (editBuildMode !== 'ai' || actionsManuallyModified || !editFlowDescription.trim()) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.parseNaturalFlow(editFlowDescription)
        if (result.actions) setEditParsedActions(result.actions)
      } catch (error) {
        console.error('Failed to parse flow description:', error)
      }
    }, 500)

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
      setRunningFlowIds(prev => new Set(prev).add(flowId))
    },
    onSuccess: (_, flowId) => {
      queryClient.invalidateQueries({ queryKey: ['flows'] }).then(() => {
        setTimeout(() => {
          setRunningFlowIds(prev => {
            const next = new Set(prev)
            next.delete(flowId)
            return next
          })
        }, 500)
      })
    },
    onError: (_, flowId) => {
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
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail?.conflicting_flows) setOverlapError(detail)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ flowId, data }: { flowId: string; data: any }) => api.updateFlow(flowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      closeEditModal()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail?.conflicting_flows) setOverlapError(detail)
    },
  })

  // Handlers
  const closeEditModal = () => {
    setEditingFlow(null)
    setEditTriggerType('scheduled')
    setEditFlowDescription('')
    setEditParsedActions([])
    setActionsManuallyModified(false)
    setEditBuildMode('manual')
    setOverlapError(null)
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

  const handleRemoveAction = (index: number, context: 'create' | 'edit' = 'edit') => {
    if (context === 'create') {
      setPreviewActions((items) => items.filter((_, idx) => idx !== index))
    } else {
      setActionsManuallyModified(true)
      setEditParsedActions((items) => items.filter((_, idx) => idx !== index))
    }
  }

  const handleAddAction = (action: FlowAction) => {
    if (addActionContext === 'create') {
      setPreviewActions((items) => [...items, action])
    } else {
      setActionsManuallyModified(true)
      setEditParsedActions((items) => [...items, action])
    }
  }

  const handleCreateFlow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const loop = formData.get('loop') === 'on'

    let schedule = undefined
    if (triggerType === 'scheduled') {
      schedule = buildScheduleFromForm(formData, recurrenceType)
    }

    createMutation.mutate({
      name,
      description,
      actions: previewActions,
      trigger_type: triggerType,
      schedule,
      priority: 0,
      loop,
    })
  }

  const handleEditFlow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingFlow) return

    const formData = new FormData(e.currentTarget)
    const loop = formData.get('loop') === 'on'

    let schedule = undefined
    if (editTriggerType === 'scheduled') {
      schedule = buildScheduleFromForm(formData, editRecurrenceType, editingFlow)
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

  const handleToggleStatus = (flow: Flow) => {
    if (flow.status === 'active') {
      setFlowToPause(flow)
    } else {
      toggleMutation.mutate(flow._id)
    }
  }

  const handleEditClick = (flow: Flow) => {
    setEditingFlow(flow)
    setEditTriggerType(flow.trigger_type === 'scheduled' ? 'scheduled' : 'manual')
    setEditRecurrenceType(flow.schedule?.recurrence || 'weekly')
    setEditFlowDescription(flow.description || '')
    setEditParsedActions(flow.actions || [])
    setOverlapError(null)
  }

  return (
    <div
      className={`h-full flex flex-col relative transition-all duration-300 ease-in-out ${collapsed ? 'bg-dark-900/95 border-r border-white/5' : 'glass-sidebar'}`}
      style={{ width: collapsed ? '64px' : `${width}px` }}
    >
      {/* Collapsed view */}
      <CollapsedView
        collapsed={collapsed}
        isRTL={isRTL}
        flows={flows}
        onToggle={onToggle}
        onFlowClick={(flowId) => {
          onToggle()
          setExpandedFlow(flowId)
        }}
        onNewFlow={() => {
          onToggle()
          setShowCreateModal(true)
        }}
      />

      {/* Expanded view */}
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
            <button onClick={onToggle} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-dark-300" />
            </button>
            <div className="tooltip tooltip-left">{isRTL ? 'כווץ' : 'Collapse'}</div>
          </div>
        </div>

        {/* Action Buttons */}
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
              <FlowCard
                key={flow._id}
                flow={flow}
                isRTL={isRTL}
                isRunning={runningFlowIds.has(flow._id)}
                isExpanded={expandedFlow === flow._id}
                onToggleExpand={() => setExpandedFlow(expandedFlow === flow._id ? null : flow._id)}
                onToggleStatus={() => handleToggleStatus(flow)}
                onRun={() => runMutation.mutate(flow._id)}
                onReset={() => resetMutation.mutate(flow._id)}
                onEdit={() => handleEditClick(flow)}
                onDelete={() => deleteMutation.mutate(flow._id)}
                isToggling={toggleMutation.isPending && toggleMutation.variables === flow._id}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === flow._id}
                isResetting={resetMutation.isPending && resetMutation.variables === flow._id}
              />
            ))
          ) : (
            <EmptyState isRTL={isRTL} />
          )}
        </div>
      </div>

      {/* Create Flow Modal */}
      {showCreateModal && (
        <FlowFormModal
          mode="create"
          isRTL={isRTL}
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateFlow}
          buildMode={createBuildMode}
          setBuildMode={setCreateBuildMode}
          description={flowDescription}
          setDescription={setFlowDescription}
          triggerType={triggerType}
          setTriggerType={setTriggerType}
          recurrenceType={recurrenceType}
          setRecurrenceType={setRecurrenceType}
          previewActions={previewActions}
          sensors={sensors}
          onDragEnd={(e) => handleDragEnd(e, 'create')}
          onRemoveAction={(idx) => handleRemoveAction(idx, 'create')}
          onAddAction={() => {
            setAddActionContext('create')
            setShowAddActionModal(true)
          }}
          overlapError={overlapError}
          isPending={createMutation.isPending}
          existingFlows={flows}
        />
      )}

      {/* Edit Flow Modal */}
      {editingFlow && (
        <FlowFormModal
          mode="edit"
          flow={editingFlow}
          isRTL={isRTL}
          onClose={closeEditModal}
          onSubmit={handleEditFlow}
          buildMode={editBuildMode}
          setBuildMode={setEditBuildMode}
          description={editFlowDescription}
          setDescription={setEditFlowDescription}
          triggerType={editTriggerType}
          setTriggerType={setEditTriggerType}
          recurrenceType={editRecurrenceType}
          setRecurrenceType={setEditRecurrenceType}
          previewActions={editParsedActions}
          sensors={sensors}
          onDragEnd={(e) => handleDragEnd(e, 'edit')}
          onRemoveAction={(idx) => handleRemoveAction(idx, 'edit')}
          onAddAction={() => {
            setAddActionContext('edit')
            setShowAddActionModal(true)
          }}
          overlapError={overlapError}
          isPending={updateMutation.isPending}
          existingFlows={flows}
        />
      )}

      {/* Modals */}
      <SuggestedFlowsModal
        isOpen={showSuggested}
        isRTL={isRTL}
        onClose={() => setShowSuggested(false)}
        onSelect={handleUseSuggested}
      />

      <PauseFlowModal
        flow={flowToPause}
        isRTL={isRTL}
        onConfirm={() => {
          if (flowToPause) {
            toggleMutation.mutate(flowToPause._id)
            setFlowToPause(null)
          }
        }}
        onCancel={() => setFlowToPause(null)}
      />

      <AddActionModal
        isOpen={showAddActionModal}
        isRTL={isRTL}
        onClose={() => setShowAddActionModal(false)}
        onAdd={handleAddAction}
      />
    </div>
  )
}

// Helper function to build schedule from form data
function buildScheduleFromForm(
  formData: FormData,
  recurrenceType: RecurrenceType,
  _editingFlow?: Flow
) {
  if (recurrenceType === 'none') {
    const startDatetime = formData.get('start_datetime') as string
    const endDatetime = formData.get('end_datetime') as string
    return {
      start_datetime: startDatetime ? new Date(startDatetime).toISOString() : undefined,
      end_datetime: endDatetime ? new Date(endDatetime).toISOString() : undefined,
      recurrence: recurrenceType,
      days_of_week: [],
    }
  }

  const startTime = formData.get('start_time') as string
  const endTime = formData.get('end_time') as string
  const dayOfMonth = formData.get('day_of_month') as string
  const month = formData.get('month') as string

  const daysOfWeek: number[] = []
  for (let i = 0; i < 7; i++) {
    if (formData.get(`day_${i}`)) daysOfWeek.push(i)
  }

  return {
    start_time: startTime || '09:00',
    end_time: endTime || undefined,
    recurrence: recurrenceType,
    days_of_week: recurrenceType === 'weekly' ? (daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]) : [],
    day_of_month: (recurrenceType === 'monthly' || recurrenceType === 'yearly') && dayOfMonth ? parseInt(dayOfMonth) : undefined,
    month: recurrenceType === 'yearly' && month ? parseInt(month) : undefined,
  }
}

// Collapsed view component
function CollapsedView({
  collapsed,
  isRTL,
  flows,
  onToggle,
  onFlowClick,
  onNewFlow,
}: {
  collapsed: boolean
  isRTL: boolean
  flows?: Flow[]
  onToggle: () => void
  onFlowClick: (flowId: string) => void
  onNewFlow: () => void
}) {
  return (
    <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 overflow-visible ${collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="p-3 border-b border-white/5 flex justify-center">
        <div className="group tooltip-trigger">
          <button onClick={onToggle} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronRight size={20} className="text-dark-300 transition-transform" />
          </button>
          <div className="tooltip tooltip-right">{isRTL ? 'הרחב' : 'Expand'}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center py-4 gap-3 overflow-visible">
        <div className="p-2 bg-primary-500/20 rounded-xl mb-2 group tooltip-trigger">
          <Workflow size={20} className="text-primary-400" />
          <div className="tooltip tooltip-right">{isRTL ? 'זרימות' : 'Flows'}</div>
        </div>

        {(Array.isArray(flows) ? flows : []).slice(0, 8).map((flow) => (
          <div key={flow._id} className="group tooltip-trigger">
            <button
              onClick={() => onFlowClick(flow._id)}
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

        <div className="group tooltip-trigger">
          <button
            onClick={onNewFlow}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all hover:scale-110"
          >
            <Plus size={18} />
          </button>
          <div className="tooltip tooltip-right">{isRTL ? 'זרימה חדשה' : 'New Flow'}</div>
        </div>
      </div>
    </div>
  )
}

// Empty state component
function EmptyState({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="text-center py-8 text-dark-400">
      <Workflow size={32} className="mx-auto mb-2 opacity-50" />
      <p className="text-sm">{isRTL ? 'אין זרימות' : 'No flows yet'}</p>
      <p className="text-xs mt-1">{isRTL ? 'צור זרימה חדשה להתחיל' : 'Create a new flow to get started'}</p>
    </div>
  )
}

// Helper function to validate actions
function validateActions(actions: FlowAction[], isRTL: boolean): string[] {
  const errors: string[] = []

  actions.forEach((action, index) => {
    const actionNum = index + 1

    switch (action.action_type) {
      case 'announcement':
        if (!action.announcement_text?.trim()) {
          errors.push(isRTL
            ? `פעולה ${actionNum}: הכרזה חסרה טקסט`
            : `Action ${actionNum}: Announcement missing text`)
        }
        break
      case 'play_genre':
        if (!action.genre && !action.duration_minutes && !action.song_count) {
          errors.push(isRTL
            ? `פעולה ${actionNum}: נגן ז'אנר חסר פרטים`
            : `Action ${actionNum}: Play genre missing details`)
        }
        break
      case 'play_content':
        if (!action.content_id && !action.content_title) {
          errors.push(isRTL
            ? `פעולה ${actionNum}: נגן תוכן חסר בחירת תוכן`
            : `Action ${actionNum}: Play content missing selection`)
        }
        break
      case 'set_volume':
        if (action.volume_level === undefined || action.volume_level === null) {
          errors.push(isRTL
            ? `פעולה ${actionNum}: הגדרת עוצמה חסרה ערך`
            : `Action ${actionNum}: Set volume missing level`)
        }
        break
      case 'wait':
        if (!action.duration_minutes) {
          errors.push(isRTL
            ? `פעולה ${actionNum}: המתנה חסרה משך זמן`
            : `Action ${actionNum}: Wait missing duration`)
        }
        break
    }
  })

  return errors
}

// Flow Form Modal component (for both create and edit)
function FlowFormModal({
  mode,
  flow,
  isRTL,
  onClose,
  onSubmit,
  buildMode,
  setBuildMode,
  description,
  setDescription,
  triggerType,
  setTriggerType,
  recurrenceType,
  setRecurrenceType,
  previewActions,
  sensors,
  onDragEnd,
  onRemoveAction,
  onAddAction,
  overlapError,
  isPending,
  existingFlows,
}: {
  mode: 'create' | 'edit'
  flow?: Flow
  isRTL: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  buildMode: 'manual' | 'ai'
  setBuildMode: (mode: 'manual' | 'ai') => void
  description: string
  setDescription: (desc: string) => void
  triggerType: 'scheduled' | 'manual'
  setTriggerType: (type: 'scheduled' | 'manual') => void
  recurrenceType: RecurrenceType
  setRecurrenceType: (type: RecurrenceType) => void
  previewActions: FlowAction[]
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (event: DragEndEvent) => void
  onRemoveAction: (index: number) => void
  onAddAction: () => void
  overlapError: { message: string; conflictingFlows: any[] } | null
  isPending: boolean
  existingFlows?: Flow[]
}) {
  const [flowName, setFlowName] = useState(flow?.name || '')
  const isCreate = mode === 'create'
  const title = isCreate
    ? (isRTL ? 'זרימה חדשה' : 'New Flow')
    : (isRTL ? 'עריכת זרימה' : 'Edit Flow')

  // Validation
  const actionErrors = validateActions(previewActions, isRTL)

  const isNameTaken = existingFlows?.some(
    f => f.name.toLowerCase() === flowName.toLowerCase() && f._id !== flow?._id
  ) || false

  const validationErrors: string[] = []

  if (previewActions.length === 0) {
    validationErrors.push(
      buildMode === 'ai'
        ? (isRTL ? 'אנא הזן תיאור זרימה תקף כדי להמשיך' : 'Please enter a valid flow description to continue')
        : (isRTL ? 'אנא הוסף לפחות פעולה אחת' : 'Please add at least one action')
    )
  }

  if (actionErrors.length > 0) {
    validationErrors.push(...actionErrors)
  }

  if (!flowName.trim()) {
    validationErrors.push(isRTL ? 'שם הזרימה נדרש' : 'Flow name is required')
  } else if (isNameTaken) {
    validationErrors.push(isRTL ? 'שם זרימה זה כבר קיים' : 'This flow name is already taken')
  }

  if (overlapError) {
    validationErrors.push(isRTL ? 'חפיפה בלוח זמנים עם זרימות אחרות' : 'Schedule overlaps with other flows')
  }

  const isValid = validationErrors.length === 0 && !isPending
  const submitText = isCreate
    ? (isRTL ? 'צור' : 'Create')
    : (isRTL ? 'שמור' : 'Save')

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="glass-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-dark-100">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Input
              name="name"
              label={isRTL ? 'שם' : 'Name'}
              placeholder={isRTL ? 'לדוגמה: תוכנית בוקר' : 'e.g., Morning Show'}
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              required
              error={isNameTaken ? (isRTL ? 'שם זה כבר קיים' : 'Name already exists') : undefined}
            />
          </div>

          {/* Build Mode Toggle */}
          <div className="p-3 bg-dark-800/30 rounded-lg">
            <label className="block text-dark-300 text-sm mb-2">
              {isRTL ? 'מצב בנייה' : 'Build Mode'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBuildMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                  buildMode === 'manual'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                }`}
              >
                <Hand size={16} />
                <span className="text-sm">{isRTL ? 'ידני' : 'Manual'}</span>
              </button>
              <button
                type="button"
                onClick={() => setBuildMode('ai')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all ${
                  buildMode === 'ai'
                    ? 'bg-purple-500 text-white'
                    : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                }`}
              >
                <Wand2 size={16} />
                <span className="text-sm">AI</span>
              </button>
            </div>
            <p className="text-xs text-dark-500 mt-2">
              {buildMode === 'manual'
                ? (isRTL ? 'הוסף פעולות ידנית אחת אחת' : 'Add actions manually one by one')
                : (isRTL ? 'תאר את הזרימה ו-AI יפרש אותה לפעולות' : 'Describe the flow and AI will parse it into actions')}
            </p>
          </div>

          {/* Description */}
          <Textarea
            name="description"
            label={`${isRTL ? 'תיאור' : 'Description'}${buildMode === 'ai' ? ' *' : ''}`}
            rows={buildMode === 'ai' ? 6 : 2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              buildMode === 'ai'
                ? (isRTL ? 'תאר את הזרימה: נגן מזרחי שמח, אז שתי פרסומות, אז חסידי' : 'Describe the flow: play happy mizrahi, then 2 commercials, then hasidi')
                : (isRTL ? 'תיאור אופציונלי...' : 'Optional description...')
            }
            hint={buildMode === 'ai' ? (isRTL ? 'השתמש ב"אז" או "then" להפרדה בין פעולות' : 'Use "then" to separate actions') : undefined}
            required={buildMode === 'ai'}
          />

          {/* Actions Section */}
          <div className="p-3 bg-dark-800/50 rounded-lg border border-primary-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-primary-400" />
                <span className="text-xs font-medium text-primary-400">
                  {buildMode === 'ai'
                    ? (isRTL ? 'תצוגה מקדימה - מה המערכת הבינה:' : 'Preview - What the system understood:')
                    : (isRTL ? 'פעולות:' : 'Actions:')}
                </span>
              </div>
              {buildMode === 'manual' && (
                <button
                  type="button"
                  onClick={onAddAction}
                  className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Plus size={14} />
                  <span>{isRTL ? 'הוסף פעולה' : 'Add Action'}</span>
                </button>
              )}
            </div>

            {previewActions.length > 0 ? (
              buildMode === 'manual' ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                          onRemove={onRemoveAction}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-1">
                  {previewActions.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-dark-200 p-2 bg-dark-700/50 rounded">
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
                {buildMode === 'ai'
                  ? (isRTL ? 'הקלד תיאור לראות פעולות...' : 'Type a description to see actions...')
                  : (isRTL ? 'לחץ "הוסף פעולה" כדי להתחיל' : 'Click "Add Action" to get started')}
              </p>
            )}
          </div>

          {/* Trigger Type */}
          <div>
            <Select
              label={isRTL ? 'סוג הפעלה' : 'Trigger Type'}
              value={triggerType}
              onChange={(value) => setTriggerType(value as 'scheduled' | 'manual')}
              options={[
                { value: 'scheduled', label: isRTL ? 'מתוזמן' : 'Scheduled', description: isRTL ? 'הפעלה אוטומטית לפי לוח זמנים' : 'Automatic execution by schedule' },
                { value: 'manual', label: isRTL ? 'ידני' : 'Manual', description: isRTL ? 'הפעלה ידנית בלבד' : 'Manual execution only' }
              ]}
            />
          </div>

          {/* Schedule Form */}
          {triggerType === 'scheduled' && (
            <ScheduleForm
              isRTL={isRTL}
              recurrenceType={recurrenceType}
              onRecurrenceTypeChange={setRecurrenceType}
              schedule={flow?.schedule}
              showLoop={true}
              loop={flow?.loop}
            />
          )}

          {/* Overlap Error */}
          {overlapError && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 font-medium mb-2">
                {isRTL ? 'חפיפה בלוח זמנים' : 'Schedule Overlap Detected'}
              </p>
              <p className="text-sm text-red-300 mb-2">
                {isRTL ? 'הזרימה חופפת לזרימות הבאות:' : 'This flow overlaps with the following flows:'}
              </p>
              <ul className="space-y-1" dir={isRTL ? 'rtl' : 'ltr'}>
                {overlapError.conflictingFlows.map((f: any) => (
                  <li key={f._id} className="text-sm text-red-200 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <div>
                      <span className="font-medium">{f.name}</span>
                      <span className="text-red-300/70 text-xs ml-2">
                        {f.schedule?.start_time} - {f.schedule?.end_time}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="flex-1 glass-button py-2">
              {isRTL ? 'ביטול' : 'Cancel'}
            </button>
            <div className="tooltip-trigger flex-1">
              <button
                type="submit"
                disabled={!isValid}
                className="w-full glass-button-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isCreate ? (
                  <Plus size={16} />
                ) : (
                  <Edit size={16} />
                )}
                <span>{submitText}</span>
              </button>
              {!isValid && (
                <div className="tooltip tooltip-top" style={{ maxWidth: '280px' }}>
                  {isPending ? (
                    isRTL ? 'מעבד...' : 'Processing...'
                  ) : (
                    <ul className="text-left space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-red-400">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

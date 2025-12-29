import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Play,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useActionsStudioStore, FlowActionType, StudioAction, getActionDisplayName } from '../store/actionsStudioStore'
import BlocksPalette from '../components/ActionsStudio/BlocksPalette'
import StudioCanvas from '../components/ActionsStudio/StudioCanvas'
import PreviewPanel from '../components/ActionsStudio/PreviewPanel'
import BlockConfigPanel from '../components/ActionsStudio/BlockConfigPanel'
import ActionBlockCard from '../components/ActionsStudio/ActionBlockCard'
import { api } from '../services/api'
import { useToastStore } from '../store/toastStore'

export default function ActionsStudio() {
  const { flowId } = useParams<{ flowId?: string }>()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const { addToast } = useToastStore()

  // Drag state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [activeDragType, setActiveDragType] = useState<'palette' | 'canvas' | null>(null)
  const [activeDragActionType, setActiveDragActionType] = useState<FlowActionType | null>(null)
  const [overCanvasIndex, setOverCanvasIndex] = useState<number | null>(null)

  // Store state
  const {
    flowName,
    actions,
    isDirty,
    isLoading,
    isSaving,
    selectedBlockId,
    loadFlow,
    createNewFlow,
    saveFlow,
    setFlowName,
    addAction,
    removeAction,
    reorderActions,
    selectBlock,
  } = useActionsStudioStore()

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Load flow if editing
  useEffect(() => {
    if (flowId) {
      loadFlow(flowId).catch((error) => {
        console.error('Failed to load flow:', error)
        addToast(isRTL ? 'שגיאה בטעינת הזרימה' : 'Failed to load flow', 'error')
        navigate('/actions-studio')
      })
    } else {
      createNewFlow()
    }
  }, [flowId, loadFlow, createNewFlow, navigate, addToast, isRTL])

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Handle save
  const handleSave = async () => {
    if (!flowName.trim()) {
      addToast(isRTL ? 'נא להזין שם לזרימה' : 'Please enter a flow name', 'warning')
      return
    }

    const result = await saveFlow()
    if (result.success) {
      addToast(isRTL ? 'הזרימה נשמרה בהצלחה' : 'Flow saved successfully', 'success')
      if (!flowId && result.flowId) {
        navigate(`/actions-studio/${result.flowId}`, { replace: true })
      }
    } else {
      addToast(result.error || (isRTL ? 'שגיאה בשמירה' : 'Failed to save'), 'error')
    }
  }

  // Handle run
  const handleRun = async () => {
    if (!flowId) {
      addToast(isRTL ? 'נא לשמור את הזרימה תחילה' : 'Please save the flow first', 'warning')
      return
    }

    try {
      await api.runFlow(flowId)
      addToast(isRTL ? 'הזרימה הופעלה' : 'Flow started', 'success')
    } catch (error) {
      addToast(isRTL ? 'שגיאה בהפעלת הזרימה' : 'Failed to run flow', 'error')
    }
  }

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id)

    const dragData = active.data.current
    if (dragData?.type === 'palette') {
      setActiveDragType('palette')
      setActiveDragActionType(dragData.actionType)
    } else {
      setActiveDragType('canvas')
      setActiveDragActionType(null)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (over?.data.current?.type === 'canvas-drop-zone') {
      setOverCanvasIndex(over.data.current.index ?? actions.length)
    } else if (over?.data.current?.sortable) {
      // Over a sortable item in the canvas
      const overIndex = actions.findIndex((a) => a.id === over.id)
      setOverCanvasIndex(overIndex >= 0 ? overIndex : null)
    } else {
      setOverCanvasIndex(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    setActiveId(null)
    setActiveDragType(null)
    setActiveDragActionType(null)
    setOverCanvasIndex(null)

    if (!over) return

    const dragData = active.data.current

    if (dragData?.type === 'palette' && activeDragActionType) {
      // Dropping from palette to canvas
      const actionType = activeDragActionType
      let dropIndex = actions.length

      // Determine drop index
      if (over.data.current?.type === 'canvas-drop-zone') {
        dropIndex = over.data.current.index ?? actions.length
      } else if (over.data.current?.sortable) {
        const overIndex = actions.findIndex((a) => a.id === over.id)
        if (overIndex >= 0) dropIndex = overIndex
      }

      // Create default action based on type
      const defaultAction = createDefaultAction(actionType)
      addAction(defaultAction, dropIndex)
    } else if (active.id !== over.id) {
      // Reordering within canvas
      const oldIndex = actions.findIndex((a) => a.id === active.id)
      const newIndex = actions.findIndex((a) => a.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderActions(oldIndex, newIndex)
      }
    }
  }

  // Create default action with sensible defaults
  const createDefaultAction = (type: FlowActionType): Omit<StudioAction, 'id' | 'isValid' | 'validationErrors'> => {
    const baseName = getActionDisplayName(type, isRTL)

    switch (type) {
      case 'play_genre':
        return {
          action_type: type,
          genre: '',
          duration_minutes: 30,
          description: baseName,
        }
      case 'play_content':
        return {
          action_type: type,
          content_id: '',
          description: baseName,
        }
      case 'play_commercials':
        return {
          action_type: type,
          commercial_count: 2,
          description: baseName,
        }
      case 'play_show':
        return {
          action_type: type,
          content_id: '',
          description: baseName,
        }
      case 'wait':
        return {
          action_type: type,
          duration_minutes: 5,
          description: baseName,
        }
      case 'set_volume':
        return {
          action_type: type,
          volume_level: 80,
          description: baseName,
        }
      case 'announcement':
        return {
          action_type: type,
          announcement_text: '',
          description: baseName,
        }
      default:
        return {
          action_type: type,
          description: baseName,
        }
    }
  }

  // Get selected action
  const selectedAction = selectedBlockId ? actions.find((a) => a.id === selectedBlockId) : null

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="animate-spin text-primary-400" />
          <p className="text-dark-300">{isRTL ? 'טוען זרימה...' : 'Loading flow...'}</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 glass-card mx-4 mt-4 p-4 flex items-center gap-4">
          {/* Back Button */}
          <div className="tooltip-trigger">
            <button
              onClick={() => {
                if (isDirty) {
                  if (confirm(isRTL ? 'יש שינויים שלא נשמרו. לצאת בכל זאת?' : 'You have unsaved changes. Leave anyway?')) {
                    navigate('/')
                  }
                } else {
                  navigate('/')
                }
              }}
              className="glass-button p-2"
            >
              {isRTL ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
            </button>
            <div className="tooltip tooltip-right">
              {isRTL ? 'חזור' : 'Back'}
            </div>
          </div>

          {/* Flow Name Input */}
          <div className="flex-1 flex items-center gap-3">
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder={isRTL ? 'שם הזרימה' : 'Flow Name'}
              className="glass-input text-lg font-semibold flex-1 max-w-md"
            />
            {isDirty && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle size={14} />
                {isRTL ? 'לא נשמר' : 'Unsaved'}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !flowName.trim()}
              className="glass-button-primary px-4 py-2 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              <span>{isRTL ? 'שמור' : 'Save'}</span>
            </button>

            {flowId && (
              <button
                onClick={handleRun}
                className="glass-button px-4 py-2 flex items-center gap-2 text-green-400 hover:bg-green-500/20"
              >
                <Play size={18} />
                <span>{isRTL ? 'הפעל' : 'Run'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
          {/* Blocks Palette */}
          <BlocksPalette isRTL={isRTL} />

          {/* Canvas */}
          <div className="flex-1 flex flex-col min-w-0">
            <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <StudioCanvas
                actions={actions}
                selectedBlockId={selectedBlockId}
                onSelectBlock={selectBlock}
                onRemoveBlock={removeAction}
                isRTL={isRTL}
                overIndex={activeDragType === 'palette' ? overCanvasIndex : null}
              />
            </SortableContext>
          </div>

          {/* Preview Panel */}
          <PreviewPanel isRTL={isRTL} />
        </div>

        {/* Block Config Panel */}
        {selectedAction && (
          <BlockConfigPanel
            action={selectedAction}
            isRTL={isRTL}
            onClose={() => selectBlock(null)}
          />
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeDragType === 'palette' && activeDragActionType && (
          <div className="opacity-80">
            <ActionBlockCard
              action={{
                id: 'drag-overlay',
                action_type: activeDragActionType,
                description: getActionDisplayName(activeDragActionType, isRTL),
                isValid: true,
                validationErrors: [],
              }}
              isRTL={isRTL}
              isDragging
            />
          </div>
        )}
        {activeId && activeDragType === 'canvas' && (
          <div className="opacity-80">
            {actions.find((a) => a.id === activeId) && (
              <ActionBlockCard
                action={actions.find((a) => a.id === activeId)!}
                isRTL={isRTL}
                isDragging
              />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

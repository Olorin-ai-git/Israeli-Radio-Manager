import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, Settings, Workflow } from 'lucide-react'
import { StudioAction } from '../../store/actionsStudioStore'
import ActionBlockCard from './ActionBlockCard'

interface StudioCanvasProps {
  actions: StudioAction[]
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onRemoveBlock: (id: string) => void
  isRTL: boolean
  overIndex: number | null
}

interface SortableActionProps {
  action: StudioAction
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  isRTL: boolean
}

function SortableAction({ action, isSelected, onSelect, onRemove, isRTL }: SortableActionProps) {
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
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'z-50' : ''}`}
    >
      <div
        onClick={onSelect}
        className="cursor-pointer"
      >
        <ActionBlockCard
          action={action}
          isRTL={isRTL}
          isDragging={isDragging}
          isSelected={isSelected}
          showDragHandle
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>

      {/* Action Buttons */}
      <div className={`
        absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1
        ${isRTL ? 'left-2' : 'right-2'}
      `}>
        <div className="tooltip-trigger">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            className="p-1.5 bg-dark-700/80 hover:bg-dark-600 rounded-lg transition-colors"
          >
            <Settings size={14} className="text-dark-300" />
          </button>
          <div className="tooltip tooltip-top">
            {isRTL ? 'הגדרות' : 'Settings'}
          </div>
        </div>
        <div className="tooltip-trigger">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-1.5 bg-dark-700/80 hover:bg-red-500/50 rounded-lg transition-colors"
          >
            <Trash2 size={14} className="text-dark-300 hover:text-red-400" />
          </button>
          <div className="tooltip tooltip-top">
            {isRTL ? 'מחק' : 'Delete'}
          </div>
        </div>
      </div>
    </div>
  )
}

function DropIndicator({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`
        h-1 rounded-full transition-all duration-200 my-2
        ${isActive ? 'bg-primary-500 shadow-glow' : 'bg-transparent'}
      `}
    />
  )
}

export default function StudioCanvas({
  actions,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  isRTL,
  overIndex,
}: StudioCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone',
    data: {
      type: 'canvas-drop-zone',
      index: actions.length,
    },
  })

  const isEmpty = actions.length === 0

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 glass-card p-4 rounded-2xl overflow-auto
        transition-all duration-200
        ${isOver && isEmpty ? 'ring-2 ring-primary-500/50 bg-primary-500/5' : ''}
      `}
      onClick={() => onSelectBlock(null)}
    >
      {isEmpty ? (
        // Empty State
        <div className="h-full flex flex-col items-center justify-center text-dark-400">
          <div className="w-24 h-24 rounded-full bg-dark-800/50 flex items-center justify-center mb-4">
            <Workflow size={40} className="text-dark-500" />
          </div>
          <h3 className="text-lg font-medium text-dark-300 mb-2">
            {isRTL ? 'התחל לבנות את הזרימה' : 'Start Building Your Flow'}
          </h3>
          <p className="text-sm text-center max-w-xs">
            {isRTL
              ? 'גרור בלוקים מהפאנל השמאלי לכאן כדי ליצור רצף פעולות'
              : 'Drag blocks from the left panel here to create a sequence of actions'}
          </p>

          {/* Drop indicator for empty canvas */}
          {isOver && (
            <div className="mt-6 px-8 py-4 border-2 border-dashed border-primary-500/50 rounded-xl bg-primary-500/10">
              <p className="text-primary-400 text-sm">
                {isRTL ? 'שחרר כאן' : 'Drop here'}
              </p>
            </div>
          )}
        </div>
      ) : (
        // Actions List
        <div className="space-y-2">
          {/* Drop indicator at top */}
          <DropIndicator isActive={overIndex === 0} />

          {actions.map((action, index) => (
            <div key={action.id}>
              <SortableAction
                action={action}
                isSelected={selectedBlockId === action.id}
                onSelect={() => onSelectBlock(action.id)}
                onRemove={() => onRemoveBlock(action.id)}
                isRTL={isRTL}
              />
              {/* Drop indicator after each item */}
              <DropIndicator isActive={overIndex === index + 1} />
            </div>
          ))}

          {/* Final drop zone indicator */}
          {isOver && overIndex === actions.length && (
            <div className="mt-4 p-4 border-2 border-dashed border-primary-500/50 rounded-xl bg-primary-500/10 text-center">
              <p className="text-primary-400 text-sm">
                {isRTL ? 'שחרר כאן להוספה' : 'Drop here to add'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

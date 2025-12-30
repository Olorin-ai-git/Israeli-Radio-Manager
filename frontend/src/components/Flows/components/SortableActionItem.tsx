/**
 * Sortable action item for drag and drop in flow editors
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import ActionIcon from './ActionIcon'
import { FlowAction } from '../types'

interface SortableActionItemProps {
  action: FlowAction & { id: string }
  index: number
  isRTL: boolean
  onRemove: (index: number) => void
}

export default function SortableActionItem({
  action,
  index,
  isRTL,
  onRemove,
}: SortableActionItemProps) {
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

  // Convert batch_number to letter
  const batchLetter = action.batch_number
    ? String.fromCharCode(64 + action.batch_number)
    : null

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
      {action.song_count && (
        <span className="text-dark-400 text-xs">({action.song_count} songs)</span>
      )}
      {action.genre && (
        <span className="text-dark-400 text-xs">({action.genre})</span>
      )}
      {action.commercial_count && (
        <span className="text-dark-400 text-xs">
          ({batchLetter ? `Batch ${batchLetter}` : 'All'}{action.commercial_count > 1 ? ` x${action.commercial_count}` : ''})
        </span>
      )}
      {action.volume_level !== undefined && (
        <span className="text-dark-400 text-xs">({action.volume_level}%)</span>
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

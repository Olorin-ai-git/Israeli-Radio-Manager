import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ListMusic, GripVertical, X, Trash2, Clock } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePlayerStore } from '../../store/playerStore'

interface Track {
  _id: string
  title: string
  artist?: string
  type: string
  duration_seconds?: number
  batches?: number[]
}

// Sortable Queue Item Component
function SortableQueueItem({
  item,
  index,
  uniqueKey,
  isRTL,
  onRemove,
  formatDuration,
  isRemoving
}: {
  item: Track
  index: number
  uniqueKey: string
  isRTL: boolean
  onRemove: () => void
  formatDuration: (seconds?: number) => string
  isRemoving?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: uniqueKey })

  const style: React.CSSProperties = {
    transform: isRemoving ? undefined : CSS.Transform.toString(transform),
    transition: isRemoving ? undefined : transition,
    ...(isDragging ? {
      opacity: 0.85,
      zIndex: 50
    } : !isRemoving ? {
      opacity: 1
    } : {})
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'commercial':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: isRTL ? 'פרס' : 'AD' }
      case 'show':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', label: isRTL ? 'תוכ' : 'SHOW' }
      case 'jingle':
        return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: isRTL ? 'ג\'נ' : 'JNG' }
      case 'bumper':
        return { bg: 'bg-pink-500/20', text: 'text-pink-400', label: isRTL ? 'במפ' : 'BMP' }
      default:
        return { bg: 'bg-sky-500/20', text: 'text-sky-400', label: isRTL ? 'שיר' : 'SONG' }
    }
  }

  const badge = getTypeBadge(item.type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg transition-colors group ${
        isRemoving ? 'animate-slide-out-fade' : ''
      } ${isDragging
        ? 'bg-dark-600 ring-1 ring-primary-500/50 shadow-lg'
        : 'bg-dark-700/30 hover:bg-dark-600/30'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-white/10 rounded transition-colors flex-shrink-0"
      >
        <GripVertical size={14} className="text-dark-500" />
      </button>

      {/* Index */}
      <span className="text-[10px] text-dark-500 w-4 text-center flex-shrink-0">{index + 1}</span>

      {/* Type Badge */}
      <span className={`flex-shrink-0 px-1 py-0.5 text-[9px] font-semibold rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-dark-200 truncate" dir="auto">
          {item.title || (isRTL ? 'ללא כותרת' : 'Untitled')}
        </p>
        <p className="text-[10px] text-dark-500 truncate" dir="auto">
          {item.artist || (isRTL ? 'אמן לא ידוע' : 'Unknown')}
        </p>
      </div>

      {/* Duration */}
      <span className="text-[10px] text-dark-500 tabular-nums flex-shrink-0">
        {formatDuration(item.duration_seconds)}
      </span>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="p-0.5 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
      >
        <X size={12} className="text-dark-400 hover:text-red-400" />
      </button>
    </div>
  )
}

export default function PlaybackQueueWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const { queue, removeFromQueue, clearQueue, reorderQueue } = usePlayerStore()
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set())
  const queueRef = useRef(queue)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const activeKey = String(active.id)
      const overKey = String(over.id)
      const oldIndex = parseInt(activeKey.split('-').pop() || '-1')
      const newIndex = parseInt(overKey.split('-').pop() || '-1')

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex < queue.length && newIndex < queue.length) {
        reorderQueue(oldIndex, newIndex)
      }
    }
  }

  const handleAnimatedRemove = (uniqueKey: string, index: number) => {
    setRemovingItems(prev => new Set(prev).add(uniqueKey))
    setTimeout(() => {
      const adjustedIndex = Math.min(index, queueRef.current.length - 1)
      if (adjustedIndex >= 0 && queueRef.current.length > 0) {
        removeFromQueue(adjustedIndex)
      }
      setRemovingItems(prev => {
        const next = new Set(prev)
        next.delete(uniqueKey)
        return next
      })
    }, 300)
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate total duration
  const totalDuration = queue.reduce((sum, item) => sum + (item.duration_seconds || 0), 0)

  return (
    <div className="glass-card p-4 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <ListMusic size={16} className="text-primary-400" />
          {isRTL ? 'תור השמעה' : 'Play Queue'}
          <span className="px-1.5 py-0.5 text-[10px] bg-dark-600/50 rounded-full text-dark-300">
            {queue.length}
          </span>
        </h3>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="text-[10px] text-dark-400 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Trash2 size={10} />
            {isRTL ? 'נקה' : 'Clear'}
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '320px' }}>
        {queue.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={queue.map((item, index) => `${item._id}-${index}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {queue.map((item, index) => {
                  const uniqueKey = `${item._id}-${index}`
                  return (
                    <SortableQueueItem
                      key={uniqueKey}
                      item={item}
                      index={index}
                      uniqueKey={uniqueKey}
                      isRTL={isRTL}
                      onRemove={() => handleAnimatedRemove(uniqueKey, index)}
                      formatDuration={formatDuration}
                      isRemoving={removingItems.has(uniqueKey)}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-500 py-8">
            <ListMusic size={32} className="mb-2 opacity-40" />
            <p className="text-xs">{isRTL ? 'התור ריק' : 'Queue is empty'}</p>
            <p className="text-[10px] text-dark-600 mt-1">
              {isRTL ? 'הוסף שירים מהספרייה' : 'Add songs from library'}
            </p>
          </div>
        )}
      </div>

      {/* Footer - Total Duration */}
      {queue.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-dark-500">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {isRTL ? 'זמן כולל' : 'Total'}
          </span>
          <span className="tabular-nums">{formatDuration(totalDuration)}</span>
        </div>
      )}
    </div>
  )
}

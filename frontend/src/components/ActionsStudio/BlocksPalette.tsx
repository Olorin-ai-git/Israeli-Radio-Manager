import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { LucideIcon } from 'lucide-react'
import {
  Music,
  FileAudio,
  Megaphone,
  Radio,
  Clock,
  Volume2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Search,
  GripVertical,
  AudioLines,
  VolumeX,
  Timer,
  CalendarClock,
} from 'lucide-react'
import { FlowActionType, getActionDisplayName } from '../../store/actionsStudioStore'
import { Input } from '../Form'
import { getActionTypeColors } from '../../theme/tokens'

interface BlocksPaletteProps {
  isRTL: boolean
}

interface DraggableBlockProps {
  actionType: FlowActionType
  isRTL: boolean
}

const ACTION_ICONS: Record<FlowActionType, LucideIcon> = {
  play_genre: Music,
  play_content: FileAudio,
  play_commercials: Megaphone,
  play_scheduled_commercials: CalendarClock,
  play_show: Radio,
  play_jingle: AudioLines,
  wait: Clock,
  set_volume: Volume2,
  fade_volume: VolumeX,
  announcement: MessageSquare,
  time_check: Timer,
}

const CATEGORY_LABELS = {
  playback: { en: 'Playback', he: 'ניגון' },
  control: { en: 'Control', he: 'בקרה' },
  audio: { en: 'Audio', he: 'אודיו' },
}

const CATEGORIES: { id: 'playback' | 'control' | 'audio'; types: FlowActionType[] }[] = [
  { id: 'playback', types: ['play_genre', 'play_content', 'play_show', 'play_jingle'] },
  { id: 'control', types: ['play_commercials', 'play_scheduled_commercials', 'wait'] },
  { id: 'audio', types: ['set_volume', 'fade_volume', 'announcement', 'time_check'] },
]

function DraggableBlock({ actionType, isRTL }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${actionType}`,
    data: {
      type: 'palette',
      actionType,
    },
  })

  const Icon = ACTION_ICONS[actionType]
  const colors = getActionTypeColors(actionType)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing
        transition-all duration-200 select-none
        ${colors.bg} ${colors.border} ${colors.text}
        ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.02] hover:shadow-glow-sm'}
      `}
    >
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="opacity-50" />
        <Icon size={18} />
      </div>
      <span className="text-sm font-medium">{getActionDisplayName(actionType, isRTL)}</span>
    </div>
  )
}

export default function BlocksPalette({ isRTL }: BlocksPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['playback', 'control', 'audio'])
  )

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Filter categories based on search
  const filteredCategories = CATEGORIES.map((category) => ({
    ...category,
    types: category.types.filter((type) => {
      if (!searchQuery) return true
      const name = getActionDisplayName(type, isRTL).toLowerCase()
      return name.includes(searchQuery.toLowerCase())
    }),
  })).filter((category) => category.types.length > 0)

  return (
    <div className="w-60 flex-shrink-0 glass-sidebar flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <h2 className="font-semibold text-dark-100 mb-3">
          {isRTL ? 'אבני בניין' : 'Building Blocks'}
        </h2>

        {/* Search */}
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isRTL ? 'חפש...' : 'Search...'}
          icon={Search}
          size="sm"
        />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {filteredCategories.map((category) => (
          <div key={category.id} className="space-y-2">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center gap-2 text-xs font-semibold text-dark-400 uppercase tracking-wide hover:text-dark-200 transition-colors"
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <span>{isRTL ? CATEGORY_LABELS[category.id].he : CATEGORY_LABELS[category.id].en}</span>
              <span className="text-dark-500">({category.types.length})</span>
            </button>

            {/* Category Blocks */}
            {expandedCategories.has(category.id) && (
              <div className="space-y-2 pl-2">
                {category.types.map((type) => (
                  <DraggableBlock key={type} actionType={type} isRTL={isRTL} />
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredCategories.length === 0 && searchQuery && (
          <div className="text-center py-8 text-dark-400">
            <p className="text-sm">{isRTL ? 'לא נמצאו תוצאות' : 'No results found'}</p>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="p-3 border-t border-white/5 bg-dark-800/30">
        <p className="text-xs text-dark-400 text-center">
          {isRTL
            ? 'גרור בלוקים לאזור העבודה'
            : 'Drag blocks to the canvas'}
        </p>
      </div>
    </div>
  )
}

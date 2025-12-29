import { LucideIcon } from 'lucide-react'
import {
  Music,
  FileAudio,
  Megaphone,
  Radio,
  Clock,
  Volume2,
  MessageSquare,
  AlertCircle,
  GripVertical,
} from 'lucide-react'
import { StudioAction, FlowActionType, getActionDisplayName, getActionDuration } from '../../store/actionsStudioStore'
import { getActionTypeColors } from '../../theme/tokens'

interface ActionBlockCardProps {
  action: StudioAction
  isRTL: boolean
  isDragging?: boolean
  isSelected?: boolean
  showDragHandle?: boolean
  dragHandleProps?: any
}

const ACTION_ICONS: Record<FlowActionType, LucideIcon> = {
  play_genre: Music,
  play_content: FileAudio,
  play_commercials: Megaphone,
  play_show: Radio,
  wait: Clock,
  set_volume: Volume2,
  announcement: MessageSquare,
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function getActionSummary(action: StudioAction, isRTL: boolean): string {
  switch (action.action_type) {
    case 'play_genre':
      if (action.genre) {
        const duration = action.duration_minutes
          ? `${action.duration_minutes}m`
          : action.song_count
          ? `${action.song_count} ${isRTL ? 'שירים' : 'songs'}`
          : ''
        return `${action.genre}${duration ? ` • ${duration}` : ''}`
      }
      return isRTL ? 'בחר ז\'אנר' : 'Select genre'

    case 'play_content':
    case 'play_show':
      return action.content_title || (isRTL ? 'בחר תוכן' : 'Select content')

    case 'play_commercials':
      const count = action.commercial_count || 0
      return `${count} ${isRTL ? 'פרסומות' : 'ads'}`

    case 'wait':
      return action.duration_minutes
        ? `${action.duration_minutes} ${isRTL ? 'דקות' : 'min'}`
        : isRTL ? 'הגדר משך' : 'Set duration'

    case 'set_volume':
      return action.volume_level !== undefined
        ? `${action.volume_level}%`
        : isRTL ? 'הגדר עוצמה' : 'Set level'

    case 'announcement':
      if (action.announcement_text) {
        const preview = action.announcement_text.substring(0, 30)
        return preview + (action.announcement_text.length > 30 ? '...' : '')
      }
      return isRTL ? 'הזן טקסט' : 'Enter text'

    default:
      return ''
  }
}

export default function ActionBlockCard({
  action,
  isRTL,
  isDragging = false,
  isSelected = false,
  showDragHandle = false,
  dragHandleProps,
}: ActionBlockCardProps) {
  const Icon = ACTION_ICONS[action.action_type]
  const colorClass = ACTION_COLORS[action.action_type]
  const iconColorClass = ACTION_ICON_COLORS[action.action_type]
  const duration = getActionDuration(action)
  const summary = getActionSummary(action, isRTL)

  return (
    <div
      className={`
        relative p-4 rounded-xl border transition-all duration-200
        ${colorClass}
        ${isDragging ? 'opacity-70 scale-105 shadow-lg rotate-2' : ''}
        ${isSelected ? 'ring-2 ring-primary-500 border-primary-500/50' : ''}
        ${!isDragging && !isSelected ? 'hover:shadow-glass-sm' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        {showDragHandle && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-dark-500 hover:text-dark-300 transition-colors mt-0.5"
          >
            <GripVertical size={16} />
          </div>
        )}

        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColorClass}`}>
          <Icon size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-dark-100 text-sm">
              {action.description || getActionDisplayName(action.action_type, isRTL)}
            </h4>
            {!action.isValid && (
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-dark-400 mt-0.5 truncate">{summary}</p>
        </div>

        {/* Duration Badge */}
        {duration > 0 && (
          <div className="flex-shrink-0 text-xs text-dark-400 bg-dark-800/50 px-2 py-1 rounded-lg">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {!action.isValid && action.validationErrors.length > 0 && (
        <div className="mt-2 pt-2 border-t border-red-500/20">
          <p className="text-xs text-red-400">
            {action.validationErrors[0]}
          </p>
        </div>
      )}
    </div>
  )
}

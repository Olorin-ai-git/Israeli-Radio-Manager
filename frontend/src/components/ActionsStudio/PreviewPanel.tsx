import { useMemo, useEffect, useRef } from 'react'
import { LucideIcon } from 'lucide-react'
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Clock,
  Music,
  FileAudio,
  Megaphone,
  Radio,
  Volume2,
  MessageSquare,
  AudioLines,
  VolumeX,
  Timer,
  CalendarClock,
} from 'lucide-react'
import {
  useActionsStudioStore,
  getActionDuration,
  FlowActionType,
  StudioAction,
} from '../../store/actionsStudioStore'
import { getActionTypeColors } from '../../theme/tokens'

interface PreviewPanelProps {
  isRTL: boolean
}

// Solid colors for timeline visualization (matching token colors but without opacity)
const ACTION_SOLID_COLORS: Record<FlowActionType, string> = {
  play_genre: 'bg-sky-500',
  play_content: 'bg-blue-500',
  play_commercials: 'bg-orange-500',
  play_scheduled_commercials: 'bg-amber-500',
  play_show: 'bg-purple-500',
  play_jingle: 'bg-pink-500',
  wait: 'bg-gray-500',
  set_volume: 'bg-emerald-500',
  fade_volume: 'bg-teal-500',
  announcement: 'bg-amber-500',
  time_check: 'bg-indigo-500',
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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function getActionPreviewText(action: StudioAction, isRTL: boolean): string {
  switch (action.action_type) {
    case 'play_genre':
      return action.genre
        ? (isRTL ? `מנגן מוזיקת ${action.genre}` : `Playing ${action.genre} music`)
        : (isRTL ? 'מנגן מוזיקה' : 'Playing music')
    case 'play_content':
      return action.content_title || (isRTL ? 'מנגן תוכן' : 'Playing content')
    case 'play_commercials':
      return isRTL
        ? `מנגן ${action.commercial_count || 0} פרסומות`
        : `Playing ${action.commercial_count || 0} commercials`
    case 'play_scheduled_commercials':
      return isRTL
        ? 'מנגן פרסומות מתוזמנות מקמפיינים'
        : 'Playing scheduled commercials from campaigns'
    case 'play_show':
      return action.content_title || (isRTL ? 'מנגן תוכנית' : 'Playing show')
    case 'wait':
      return isRTL
        ? `ממתין ${action.duration_minutes || 0} דקות`
        : `Waiting ${action.duration_minutes || 0} minutes`
    case 'set_volume':
      return isRTL
        ? `מגדיר עוצמה ל-${action.volume_level || 0}%`
        : `Setting volume to ${action.volume_level || 0}%`
    case 'announcement':
      return action.announcement_text?.substring(0, 50) || (isRTL ? 'הכרזה' : 'Announcement')
    case 'play_jingle':
      return isRTL
        ? `מנגן ג'ינגל: ${action.content_title || 'לא נבחר'}`
        : `Playing jingle: ${action.content_title || 'not selected'}`
    case 'fade_volume':
      return isRTL
        ? `דעיכה ל-${action.target_volume || 0}% במשך ${action.fade_duration_seconds || 0} שניות`
        : `Fading to ${action.target_volume || 0}% over ${action.fade_duration_seconds || 0}s`
    case 'time_check':
      return isRTL ? 'מכריז את השעה' : 'Announcing current time'
    default:
      return ''
  }
}

export default function PreviewPanel({ isRTL }: PreviewPanelProps) {
  const {
    actions,
    simulatorState,
    currentSimStep,
    startSimulation,
    pauseSimulation,
    stepSimulation,
    resetSimulation,
  } = useActionsStudioStore()

  // Calculate total duration and timeline segments
  const { totalDuration, segments } = useMemo(() => {
    let total = 0
    const segs: { action: StudioAction; start: number; duration: number }[] = []

    actions.forEach((action) => {
      const duration = getActionDuration(action)
      segs.push({ action, start: total, duration })
      total += duration
    })

    return { totalDuration: total, segments: segs }
  }, [actions])

  // Calculate elapsed time up to current step
  const elapsedTime = useMemo(() => {
    let elapsed = 0
    for (let i = 0; i < currentSimStep; i++) {
      if (actions[i]) {
        elapsed += getActionDuration(actions[i])
      }
    }
    return elapsed
  }, [actions, currentSimStep])

  const currentAction = actions[currentSimStep]
  const hasActions = actions.length > 0

  // Auto-advance simulation when playing
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (simulatorState === 'playing' && currentAction) {
      // Get duration for current action (use a scaled-down time for preview)
      const actionDuration = getActionDuration(currentAction)
      // Scale: 1 second of real time = 10 seconds of simulated time (or minimum 1 second)
      const scaledDuration = Math.max(1000, (actionDuration / 10) * 1000)

      intervalRef.current = setTimeout(() => {
        stepSimulation()
      }, scaledDuration)

      return () => {
        if (intervalRef.current) {
          clearTimeout(intervalRef.current)
        }
      }
    }
  }, [simulatorState, currentSimStep, currentAction, stepSimulation])

  return (
    <div className="w-80 flex-shrink-0 glass-sidebar flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <h2 className="font-semibold text-dark-100">
          {isRTL ? 'תצוגה מקדימה' : 'Preview'}
        </h2>
        <p className="text-xs text-dark-400 mt-1">
          {isRTL ? 'סימולטור שלב-אחר-שלב' : 'Step-by-step simulator'}
        </p>
      </div>

      {/* Timeline */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between text-xs text-dark-400 mb-2">
          <span>{formatTime(elapsedTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>

        {/* Timeline Bar */}
        <div className="h-12 bg-dark-800/50 rounded-lg overflow-hidden relative">
          {totalDuration > 0 ? (
            <>
              {/* Segments */}
              <div className="absolute inset-0 flex">
                {segments.map((seg, idx) => {
                  const width = (seg.duration / totalDuration) * 100
                  const colorClass = ACTION_SOLID_COLORS[seg.action.action_type]
                  const isActive = idx === currentSimStep && simulatorState === 'playing'
                  const isPast = idx < currentSimStep

                  return (
                    <div
                      key={seg.action.id}
                      className={`
                        h-full flex items-center justify-center transition-all
                        ${colorClass}
                        ${isPast ? 'opacity-40' : 'opacity-70'}
                        ${isActive ? 'opacity-100 animate-pulse' : ''}
                      `}
                      style={{ width: `${width}%` }}
                    >
                      {width > 8 && (
                        <span className="text-[10px] font-medium text-white truncate px-1">
                          {seg.action.action_type.split('_')[0]}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-glow transition-all duration-300"
                style={{ left: `${(elapsedTime / totalDuration) * 100}%` }}
              />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-dark-500 text-xs">
              {isRTL ? 'אין פעולות' : 'No actions'}
            </div>
          )}
        </div>
      </div>

      {/* Current Step */}
      <div className="flex-1 p-4 overflow-auto">
        {currentAction ? (
          <div className="space-y-4">
            {/* Step Counter */}
            <div className="text-center">
              <span className="text-xs text-dark-400">
                {isRTL ? 'שלב' : 'Step'} {currentSimStep + 1} {isRTL ? 'מתוך' : 'of'} {actions.length}
              </span>
            </div>

            {/* Current Action Card */}
            {(() => {
              const colors = getActionTypeColors(currentAction.action_type)
              const Icon = ACTION_ICONS[currentAction.action_type]
              return (
                <div className={`p-4 rounded-xl ${colors.bg} ${colors.border}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${ACTION_SOLID_COLORS[currentAction.action_type]}/30`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100 text-sm">
                        {currentAction.description || currentAction.action_type}
                      </h4>
                      <p className="text-xs text-dark-400">
                        {formatTime(getActionDuration(currentAction))}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-dark-200">
                    {getActionPreviewText(currentAction, isRTL)}
                  </p>
                </div>
              )
            })()}

            {/* Next Up */}
            {currentSimStep < actions.length - 1 && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-xs text-dark-500 mb-2">
                  {isRTL ? 'הבא:' : 'Next:'}
                </p>
                <div className="flex items-center gap-2 text-dark-400">
                  {(() => {
                    const nextAction = actions[currentSimStep + 1]
                    const NextIcon = ACTION_ICONS[nextAction.action_type]
                    return (
                      <>
                        <NextIcon size={14} />
                        <span className="text-xs truncate">
                          {nextAction.description || nextAction.action_type}
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-dark-400">
            <Clock size={32} className="mb-2 opacity-50" />
            <p className="text-sm text-center">
              {isRTL
                ? 'הוסף פעולות לראות תצוגה מקדימה'
                : 'Add actions to see preview'}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-white/5 bg-dark-800/30">
        <div className="flex items-center justify-center gap-2">
          {/* Reset */}
          <div className="tooltip-trigger">
            <button
              onClick={resetSimulation}
              disabled={!hasActions || simulatorState === 'idle'}
              className="p-2 glass-button disabled:opacity-30"
            >
              <RotateCcw size={18} />
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'אפס' : 'Reset'}
            </div>
          </div>

          {/* Play/Pause */}
          <div className="tooltip-trigger">
            <button
              onClick={() => {
                if (simulatorState === 'playing') {
                  pauseSimulation()
                } else {
                  startSimulation()
                }
              }}
              disabled={!hasActions}
              className="p-3 glass-button-primary disabled:opacity-30"
            >
              {simulatorState === 'playing' ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div className="tooltip tooltip-top">
              {simulatorState === 'playing' ? (isRTL ? 'השהה' : 'Pause') : (isRTL ? 'הפעל' : 'Play')}
            </div>
          </div>

          {/* Step Forward */}
          <div className="tooltip-trigger">
            <button
              onClick={stepSimulation}
              disabled={!hasActions || currentSimStep >= actions.length - 1}
              className="p-2 glass-button disabled:opacity-30"
            >
              <SkipForward size={18} />
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'שלב הבא' : 'Next Step'}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-3 text-center">
          <span className={`text-xs ${
            simulatorState === 'playing' ? 'text-green-400' :
            simulatorState === 'paused' ? 'text-amber-400' :
            simulatorState === 'finished' ? 'text-primary-400' :
            'text-dark-500'
          }`}>
            {simulatorState === 'playing' && (isRTL ? 'מריץ...' : 'Running...')}
            {simulatorState === 'paused' && (isRTL ? 'מושהה' : 'Paused')}
            {simulatorState === 'finished' && (isRTL ? 'הסתיים' : 'Finished')}
            {simulatorState === 'idle' && (isRTL ? 'מוכן' : 'Ready')}
          </span>
        </div>
      </div>
    </div>
  )
}

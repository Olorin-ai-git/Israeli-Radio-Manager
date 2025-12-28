import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
  Loader2,
  AlertCircle,
  ListMusic,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical
} from 'lucide-react'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../services/api'
import { toast } from '../../store/toastStore'
import { usePlayerStore } from '../../store/playerStore'

interface Track {
  _id: string
  title: string
  artist?: string
  type: string
  duration_seconds?: number
}

interface AudioPlayerProps {
  track?: Track | null
  onTrackEnd?: () => void
  onNext?: () => void
  onPrevious?: () => void
  autoPlay?: boolean
}

// Sortable Queue Item Component
function SortableQueueItem({
  item,
  index,
  isRTL,
  onRemove,
  formatDuration
}: {
  item: Track
  index: number
  isRTL: boolean
  onRemove: () => void
  formatDuration: (seconds?: number) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 rounded-lg bg-dark-700/30 hover:bg-dark-700/50 transition-colors group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors"
        title={isRTL ? 'גרור לסידור מחדש' : 'Drag to reorder'}
      >
        <GripVertical size={16} className="text-dark-500" />
      </button>
      <span className="text-xs text-dark-500 w-5 text-center">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-200 truncate" dir="auto">
          {item.title}
        </p>
        <p className="text-xs text-dark-500 truncate" dir="auto">
          {item.artist || (isRTL ? 'אמן לא ידוע' : 'Unknown Artist')}
        </p>
      </div>
      <span className="text-xs text-dark-500 tabular-nums">
        {formatDuration(item.duration_seconds)}
      </span>
      <button
        onClick={onRemove}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
        title={isRTL ? 'הסר מהתור' : 'Remove from queue'}
      >
        <X size={14} className="text-dark-400 hover:text-red-400" />
      </button>
    </div>
  )
}

// Fade duration constants
const FADE_IN_DURATION = 2000 // 2 seconds fade in
const FADE_OUT_DURATION = 3000 // 3 seconds fade out
const FADE_OUT_BEFORE_END = 4 // Start fade out 4 seconds before track ends

export default function AudioPlayer({
  track,
  onTrackEnd,
  onNext,
  onPrevious,
  autoPlay = true
}: AudioPlayerProps) {
  const { i18n } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const fadeAnimationRef = useRef<number | null>(null)
  const isFadingOutRef = useRef(false)
  const needsFadeInRef = useRef(false) // Track if new track needs fade in
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [queueExpanded, setQueueExpanded] = useState(false)
  const [isFading, setIsFading] = useState(false)

  const { queue, removeFromQueue, clearQueue, reorderQueue } = usePlayerStore()
  const isRTL = i18n.language === 'he'

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
      const oldIndex = queue.findIndex((item) => item._id === active.id)
      const newIndex = queue.findIndex((item) => item._id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderQueue(oldIndex, newIndex)
      }
    }
  }

  // Cancel any ongoing fade animation
  const cancelFade = () => {
    if (fadeAnimationRef.current) {
      cancelAnimationFrame(fadeAnimationRef.current)
      fadeAnimationRef.current = null
    }
  }

  // Fade in function - smoothly increases volume from 0 to target
  const fadeIn = () => {
    if (!audioRef.current) return

    cancelFade()
    isFadingOutRef.current = false
    setIsFading(true)

    const targetVolume = isMuted ? 0 : volume / 100
    const startTime = performance.now()
    audioRef.current.volume = 0

    const animate = (currentTime: number) => {
      if (!audioRef.current) return

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / FADE_IN_DURATION, 1)
      // Use easeOutCubic for smoother fade in
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      audioRef.current.volume = targetVolume * easedProgress

      if (progress < 1) {
        fadeAnimationRef.current = requestAnimationFrame(animate)
      } else {
        setIsFading(false)
        fadeAnimationRef.current = null
      }
    }

    fadeAnimationRef.current = requestAnimationFrame(animate)
  }

  // Fade out function - smoothly decreases volume to 0
  const fadeOut = (callback?: () => void) => {
    if (!audioRef.current) return

    cancelFade()
    isFadingOutRef.current = true
    setIsFading(true)

    const startTime = performance.now()
    const startVolume = audioRef.current.volume

    const animate = (currentTime: number) => {
      if (!audioRef.current) {
        callback?.()
        return
      }

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / FADE_OUT_DURATION, 1)
      // Use easeInCubic for smoother fade out
      const easedProgress = Math.pow(progress, 3)

      audioRef.current.volume = startVolume * (1 - easedProgress)

      if (progress < 1) {
        fadeAnimationRef.current = requestAnimationFrame(animate)
      } else {
        setIsFading(false)
        isFadingOutRef.current = false
        fadeAnimationRef.current = null
        callback?.()
      }
    }

    fadeAnimationRef.current = requestAnimationFrame(animate)
  }

  // Cleanup fade animation on unmount
  useEffect(() => {
    return () => {
      cancelFade()
    }
  }, [])

  // Auto-expand queue when items are added
  useEffect(() => {
    if (queue.length > 0 && !queueExpanded) {
      setQueueExpanded(true)
    }
  }, [queue.length])

  // Load new track when track changes
  useEffect(() => {
    if (track && audioRef.current) {
      // Cancel any ongoing fade from previous track and reset all fade state
      cancelFade()
      isFadingOutRef.current = false
      needsFadeInRef.current = true // Mark that this new track needs fade in
      setIsFading(false) // Reset fading state

      const streamUrl = api.getStreamUrl(track._id)
      audioRef.current.src = streamUrl
      audioRef.current.volume = 0 // Start at 0 for fade in
      setIsLoading(true)
      setHasError(false)
      setCurrentTime(0)

      if (autoPlay) {
        audioRef.current.play().catch((error) => {
          console.error('Playback error:', error)
          setIsLoading(false)
          setHasError(true)
          needsFadeInRef.current = false // Don't fade in if error
          const errorMsg = isRTL
            ? `לא ניתן לנגן: ${track.title}. הקובץ לא נמצא.`
            : `Cannot play: ${track.title}. File not found.`
          toast.error(errorMsg)
        })
      }

      // Log playback start
      api.logPlayStart(track._id).catch(console.error)
    }
  }, [track, autoPlay, isRTL])

  // Handle audio errors
  const handleError = () => {
    if (!track) return
    setIsLoading(false)
    setHasError(true)
    setIsPlaying(false)
    needsFadeInRef.current = false // Don't try to fade in on error
    const errorMsg = isRTL
      ? `שגיאה בניגון: ${track.title}. ייתכן שהקובץ לא קיים או שאין הרשאות גישה.`
      : `Playback error: ${track.title}. File may not exist or access denied.`
    toast.error(errorMsg)
  }

  // Update volume (but don't override during fades)
  useEffect(() => {
    if (audioRef.current && !isFading) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted, isFading])

  const handlePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(console.error)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime
      const total = audioRef.current.duration
      setCurrentTime(current)

      // Start fade out when approaching end of track
      if (total && total > FADE_OUT_BEFORE_END + 1) {
        const timeRemaining = total - current
        if (timeRemaining <= FADE_OUT_BEFORE_END && !isFadingOutRef.current && isPlaying) {
          fadeOut()
        }
      }
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      setIsLoading(false)
    }
  }

  const handleEnded = () => {
    // Reset fade state before next track starts
    cancelFade()
    isFadingOutRef.current = false
    setIsFading(false)
    setIsPlaying(false)
    onTrackEnd?.()
  }

  // Handle skip with quick fade out (faster than natural end)
  const handleSkipNext = () => {
    if (!onNext) return

    // If already fading out or nearly at end, just skip immediately
    if (isFadingOutRef.current || (audioRef.current && duration - currentTime < 1)) {
      cancelFade()
      isFadingOutRef.current = false
      setIsFading(false)
      onNext()
      return
    }

    // Quick fade out (500ms) before skipping
    if (audioRef.current) {
      cancelFade()
      isFadingOutRef.current = true
      setIsFading(true)

      const startTime = performance.now()
      const startVolume = audioRef.current.volume
      const quickFadeDuration = 500 // Quick fade for skips

      const animate = (currentTime: number) => {
        if (!audioRef.current) {
          isFadingOutRef.current = false
          setIsFading(false)
          onNext()
          return
        }

        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / quickFadeDuration, 1)
        audioRef.current.volume = startVolume * (1 - progress)

        if (progress < 1) {
          fadeAnimationRef.current = requestAnimationFrame(animate)
        } else {
          setIsFading(false)
          isFadingOutRef.current = false
          fadeAnimationRef.current = null
          onNext()
        }
      }

      fadeAnimationRef.current = requestAnimationFrame(animate)
    } else {
      onNext()
    }
  }

  const handleSkipPrevious = () => {
    if (!onPrevious) return

    // Quick volume drop for previous (instant for responsiveness)
    cancelFade()
    isFadingOutRef.current = false
    setIsFading(false)
    if (audioRef.current) {
      audioRef.current.volume = 0
    }
    onPrevious()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value))
    setIsMuted(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="glass-card">
      {/* Queue Panel - Expandable */}
      {queueExpanded && (
        <div className="border-b border-white/5 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
              <ListMusic size={16} className="text-primary-400" />
              {isRTL ? 'תור השמעה' : 'Play Queue'}
              <span className="px-2 py-0.5 text-xs bg-dark-700 rounded-full text-dark-400">
                {queue.length}
              </span>
            </h3>
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs text-dark-400 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 size={12} />
                {isRTL ? 'נקה הכל' : 'Clear all'}
              </button>
            )}
          </div>

          {queue.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map(item => item._id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {queue.map((item, index) => (
                    <SortableQueueItem
                      key={item._id}
                      item={item}
                      index={index}
                      isRTL={isRTL}
                      onRemove={() => removeFromQueue(index)}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-6 text-dark-500">
              <ListMusic size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">{isRTL ? 'התור ריק' : 'Queue is empty'}</p>
              <p className="text-xs text-dark-600 mt-1">
                {isRTL ? 'לחץ על + ליד שיר כדי להוסיף' : 'Click + next to a song to add it'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hidden audio element */}
      <div className="p-4">
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => {
            setIsPlaying(true)
            // For resume from pause (not new track), fade in
            if (!needsFadeInRef.current && !isFadingOutRef.current && audioRef.current) {
              fadeIn()
            }
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onCanPlay={() => {
            setIsLoading(false)
            setHasError(false)
            // Trigger fade in for new tracks when audio is ready
            if (needsFadeInRef.current) {
              needsFadeInRef.current = false
              fadeIn()
            }
          }}
          onWaiting={() => setIsLoading(true)}
          onError={handleError}
        />

        <div className="flex items-center gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasError ? 'bg-red-500/20' : 'bg-primary-500/20'
          }`}>
            {isLoading ? (
              <Loader2 size={24} className="text-primary-400 animate-spin" />
            ) : hasError ? (
              <AlertCircle size={24} className="text-red-400" />
            ) : (
              <Music size={24} className="text-primary-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-dark-100 truncate" dir="auto">
              {track?.title || (isRTL ? 'לא מנגן' : 'Not Playing')}
            </p>
            <p className="text-sm text-dark-400 truncate" dir="auto">
              {track?.artist || (track?.type === 'commercial' ? (isRTL ? 'פרסומת' : 'Commercial') : '')}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSkipPrevious}
            disabled={!onPrevious}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
          >
            <SkipBack size={20} className="text-dark-200" />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={!track}
            className="p-3 bg-primary-500 hover:bg-primary-600 rounded-full transition-colors disabled:opacity-30"
          >
            {isPlaying ? (
              <Pause size={24} className="text-white" />
            ) : (
              <Play size={24} className="text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={handleSkipNext}
            disabled={!onNext}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
          >
            <SkipForward size={20} className="text-dark-200" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-dark-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!track}
            className="flex-1 h-1 bg-dark-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-500
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-xs text-dark-400 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={20} className="text-dark-400" />
            ) : (
              <Volume2 size={20} className="text-dark-200" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-dark-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-dark-400
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        {/* Queue Toggle */}
        <button
          onClick={() => setQueueExpanded(!queueExpanded)}
          className={`p-2 rounded-lg transition-colors relative ${
            queueExpanded ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-white/10 text-dark-300'
          }`}
          title={isRTL ? 'תור השמעה' : 'Play Queue'}
        >
          <ListMusic size={20} />
          {queue.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {queue.length}
            </span>
          )}
        </button>
      </div>
      </div>
    </div>
  )
}

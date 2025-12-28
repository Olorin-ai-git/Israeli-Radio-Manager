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

export default function AudioPlayer({
  track,
  onTrackEnd,
  onNext,
  onPrevious,
  autoPlay = true
}: AudioPlayerProps) {
  const { i18n } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [queueExpanded, setQueueExpanded] = useState(false)

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

  // Auto-expand queue when items are added
  useEffect(() => {
    if (queue.length > 0 && !queueExpanded) {
      setQueueExpanded(true)
    }
  }, [queue.length])

  // Load new track when track changes
  useEffect(() => {
    if (track && audioRef.current) {
      const streamUrl = api.getStreamUrl(track._id)
      audioRef.current.src = streamUrl
      setIsLoading(true)
      setHasError(false)
      setCurrentTime(0)

      if (autoPlay) {
        audioRef.current.play().catch((error) => {
          console.error('Playback error:', error)
          setIsLoading(false)
          setHasError(true)
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
    const errorMsg = isRTL
      ? `שגיאה בניגון: ${track.title}. ייתכן שהקובץ לא קיים או שאין הרשאות גישה.`
      : `Playback error: ${track.title}. File may not exist or access denied.`
    toast.error(errorMsg)
  }

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

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
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      setIsLoading(false)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    onTrackEnd?.()
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
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onCanPlay={() => { setIsLoading(false); setHasError(false); }}
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
            onClick={onPrevious}
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
            onClick={onNext}
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

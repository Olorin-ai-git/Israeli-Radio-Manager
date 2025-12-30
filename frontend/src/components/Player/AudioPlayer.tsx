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
  GripVertical,
  ChevronUp
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
  batches?: number[]
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
  uniqueKey,
  isRTL,
  onRemove,
  formatDuration,
  animationDelay,
  isRemoving
}: {
  item: Track
  index: number
  uniqueKey: string
  isRTL: boolean
  onRemove: () => void
  formatDuration: (seconds?: number) => string
  animationDelay?: number
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

  const isAnimating = animationDelay !== undefined && !isDragging

  const style: React.CSSProperties = {
    // Always apply transform from dnd-kit for drag to work
    transform: isRemoving ? undefined : CSS.Transform.toString(transform),
    transition: isRemoving ? undefined : transition,
    // When dragging, always ensure visibility with explicit opacity and z-index
    ...(isDragging ? {
      opacity: 0.85,
      zIndex: 50
    } : !isAnimating && !isRemoving ? {
      opacity: 1
    } : isAnimating ? {
      // Only set animation delay when actually animating (not dragging)
      animationDelay: `${animationDelay}ms`
    } : {})
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors group ${
        isRemoving ? 'animate-slide-out-fade' : isAnimating ? 'animate-slide-in-fade' : ''
      } ${isDragging
        ? 'bg-dark-600 ring-2 ring-primary-500/50 shadow-lg'
        : 'bg-dark-700/50 hover:bg-dark-600/50'
      }`}
    >
      <div className="group/drag tooltip-trigger flex-shrink-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded transition-colors"
        >
          <GripVertical size={16} className="text-dark-400" />
        </button>
        <div className="tooltip tooltip-top">
          {isRTL ? 'גרור לסידור מחדש' : 'Drag to reorder'}
        </div>
      </div>
      <span className="text-xs text-dark-500 w-5 text-center flex-shrink-0">{index + 1}</span>
      {/* Type badge */}
      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded uppercase ${
        item.type === 'commercial'
          ? 'bg-amber-500/20 text-amber-400'
          : item.type === 'show'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-primary-500/20 text-primary-400'
      }`}>
        {item.type === 'commercial' ? (isRTL ? 'פרסומת' : 'AD') :
         item.type === 'show' ? (isRTL ? 'תוכנית' : 'SHOW') :
         (isRTL ? 'שיר' : 'SONG')}
      </span>
      {/* Batch badge for commercials */}
      {item.type === 'commercial' && item.batches && item.batches.length > 0 && (
        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-500/20 text-orange-400">
          B{item.batches.sort((a, b) => a - b).join(',')}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-200 truncate" dir="auto">
          {item.title || (isRTL ? 'ללא כותרת' : 'Untitled')}
        </p>
        <p className="text-xs text-dark-500 truncate" dir="auto">
          {item.artist || (isRTL ? 'אמן לא ידוע' : 'Unknown Artist')}
        </p>
      </div>
      <span className="text-xs text-dark-500 tabular-nums flex-shrink-0">
        {formatDuration(item.duration_seconds)}
      </span>
      <div className="tooltip-trigger flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-500/20"
        >
          <X size={14} className="text-dark-400 hover:text-red-400" />
        </button>
        <div className="tooltip tooltip-top">
          {isRTL ? 'הסר מהתור' : 'Remove from queue'}
        </div>
      </div>
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
  const currentTrackIdRef = useRef<string | null>(null) // Prevent reloading same track
  const consecutiveErrorsRef = useRef(0) // Track consecutive errors to prevent infinite loops
  const MAX_CONSECUTIVE_ERRORS = 5 // Stop auto-skipping after this many consecutive errors
  const [emergencyMode, setEmergencyMode] = useState(false) // Emergency fallback mode
  const [emergencyPlaylist, setEmergencyPlaylist] = useState<Array<{name: string, url: string}>>([])
  const emergencyIndexRef = useRef(0) // Current position in emergency playlist
  const emergencyErrorsRef = useRef(0) // Track consecutive emergency errors
  const MAX_EMERGENCY_ERRORS = 3 // Stop trying emergency songs after this many failures
  const emergencyRetryIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [queueExpanded, setQueueExpanded] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const [pendingAutoplay, setPendingAutoplay] = useState(false) // Track waiting for user interaction

  // Queue panel height with localStorage persistence
  const [queueHeight, setQueueHeight] = useState(() => {
    const saved = localStorage.getItem('queuePanelHeight')
    return saved ? parseInt(saved) : 240 // Default 240px (same as max-h-60)
  })
  const isResizingQueue = useRef(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)
  const queuePanelRef = useRef<HTMLDivElement>(null)

  const { queue, removeFromQueue, clearQueue, reorderQueue, hasUserInteracted, setUserInteracted } = usePlayerStore()
  const isRTL = i18n.language === 'he'

  // Ref to access current queue in callbacks/timeouts
  const queueRef = useRef(queue)
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Track new items for animation with their order for staggered animation
  const prevQueueLengthRef = useRef<number>(0)
  const prevQueueIdsRef = useRef<Set<string>>(new Set())
  const [newItemsMap, setNewItemsMap] = useState<Map<string, number>>(new Map())

  // Track items being removed for exit animation
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set())

  // Detect newly added items (only animate when queue grows, not on removal/reorder)
  useEffect(() => {
    const currentIds = new Set(queue.map(item => item._id))
    const prevIds = prevQueueIdsRef.current
    const prevLength = prevQueueLengthRef.current

    // Only check for new items if queue length increased
    if (queue.length > prevLength) {
      // Find items that are new (in current but not in previous) with their order
      const newItems = new Map<string, number>()
      let orderIndex = 0
      queue.forEach(item => {
        if (!prevIds.has(item._id)) {
          newItems.set(item._id, orderIndex)
          orderIndex++
        }
      })

      if (newItems.size > 0) {
        setNewItemsMap(newItems)
        // Clear the "new" state after all animations complete
        const totalDuration = 600 + (newItems.size * 150) // Base duration + stagger delays
        setTimeout(() => {
          setNewItemsMap(new Map())
        }, totalDuration)
      }
    }

    prevQueueLengthRef.current = queue.length
    prevQueueIdsRef.current = currentIds
  }, [queue])

  // Show if we have queued items but user hasn't interacted yet
  const showClickToPlay = !track && queue.length > 0 && !hasUserInteracted

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = () => {
    // Clear any ongoing animations when dragging starts
    setNewItemsMap(new Map())
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // Extract index from uniqueKey format (id-index)
      const activeKey = String(active.id)
      const overKey = String(over.id)
      const oldIndex = parseInt(activeKey.split('-').pop() || '-1')
      const newIndex = parseInt(overKey.split('-').pop() || '-1')

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex < queue.length && newIndex < queue.length) {
        reorderQueue(oldIndex, newIndex)
      }
    }
  }

  // Animated remove handler - triggers animation then removes
  const handleAnimatedRemove = (uniqueKey: string, index: number) => {
    // Add to removing set to trigger animation
    setRemovingItems(prev => new Set(prev).add(uniqueKey))

    // After animation completes, actually remove the item
    setTimeout(() => {
      // Use the stored index directly - it's the correct position at time of click
      // We need to recalculate based on how many items before this one were also removed
      const currentQueueLength = queueRef.current.length
      // If queue shrunk, adjust index accordingly
      const adjustedIndex = Math.min(index, currentQueueLength - 1)
      if (adjustedIndex >= 0 && currentQueueLength > 0) {
        removeFromQueue(adjustedIndex)
      }
      setRemovingItems(prev => {
        const next = new Set(prev)
        next.delete(uniqueKey)
        return next
      })
    }, 400) // Match animation duration
  }

  // Animate first queue item before playing next track
  const animateQueuePopThenPlay = (callback?: () => void) => {
    const firstItem = queueRef.current[0]
    if (firstItem) {
      // Use uniqueKey format (id-index) for first item (index is always 0)
      const uniqueKey = `${firstItem._id}-0`
      // Add to removing set to trigger animation
      setRemovingItems(prev => new Set(prev).add(uniqueKey))

      // After animation, call the callback (playNext)
      setTimeout(() => {
        setRemovingItems(prev => {
          const next = new Set(prev)
          next.delete(uniqueKey)
          return next
        })
        callback?.()
      }, 400) // Match animation duration
    } else {
      // No items in queue, just call callback
      callback?.()
    }
  }

  // Queue panel resize handlers
  const handleQueueResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingQueue.current = true
    resizeStartY.current = e.clientY
    resizeStartHeight.current = queueHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  // Global mouse event handlers for queue resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingQueue.current) return
      // Delta-based calculation: drag up = increase height, drag down = decrease height
      const deltaY = resizeStartY.current - e.clientY
      const newHeight = Math.max(120, Math.min(500, resizeStartHeight.current + deltaY))
      setQueueHeight(newHeight)
    }

    const handleMouseUp = () => {
      if (isResizingQueue.current) {
        isResizingQueue.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        localStorage.setItem('queuePanelHeight', queueHeight.toString())
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [queueHeight])

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
      // Skip if same track (prevents duplicate loading from multiple renders)
      if (currentTrackIdRef.current === track._id) {
        console.log('Skipping duplicate track load:', track.title)
        return
      }
      currentTrackIdRef.current = track._id

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
          needsFadeInRef.current = false // Don't fade in if error

          // Check if it's an autoplay policy error
          if (error.name === 'NotAllowedError') {
            // Browser blocked autoplay - show visual indicator
            setPendingAutoplay(true)
            const errorMsg = isRTL
              ? `לחץ על ▶ כדי לנגן: ${track.title}`
              : `Click ▶ to play: ${track.title}`
            toast.info(errorMsg)
            // Don't mark as error - user can click play manually
          } else {
            setHasError(true)
            const errorMsg = isRTL
              ? `לא ניתן לנגן: ${track.title}. הקובץ לא נמצא.`
              : `Cannot play: ${track.title}. File not found.`
            toast.error(errorMsg)
          }
        })
      }

      // Log playback start
      api.logPlayStart(track._id).catch(console.error)
    } else if (!track) {
      // Reset when track is cleared
      currentTrackIdRef.current = null
    }
  }, [track, autoPlay, isRTL])

  // Activate emergency mode - play from fallback playlist
  const activateEmergencyMode = async () => {
    if (emergencyMode) return // Already in emergency mode

    const errorMsg = isRTL
      ? `מעבר למצב חירום - מנגן מרשימת גיבוי...`
      : `Activating emergency mode - playing from backup playlist...`
    toast.info(errorMsg)

    setEmergencyMode(true)

    // Report emergency mode to backend for notifications
    api.reportEmergencyMode().catch(err => {
      console.error('Failed to report emergency mode:', err)
    })

    // Fetch emergency playlist
    try {
      const response = await api.getEmergencyPlaylist()
      if (response.songs && response.songs.length > 0) {
        setEmergencyPlaylist(response.songs)
        emergencyIndexRef.current = 0
        playEmergencySong(0, response.songs)

        // Set up retry interval to check if normal playback can resume
        emergencyRetryIntervalRef.current = setInterval(async () => {
          // Try to resume normal playback every 5 minutes
          if (queueRef.current.length > 0) {
            const testTrack = queueRef.current[0]
            try {
              // Test if we can fetch the stream URL
              const testResponse = await fetch(api.getStreamUrl(testTrack._id), { method: 'HEAD' })
              if (testResponse.ok) {
                exitEmergencyMode()
              }
            } catch {
              // Still in emergency mode
            }
          }
        }, 5 * 60 * 1000) // Every 5 minutes
      } else {
        toast.error(isRTL ? 'אין רשימת חירום זמינה' : 'No emergency playlist available')
      }
    } catch (error) {
      console.error('Failed to load emergency playlist:', error)
      toast.error(isRTL ? 'שגיאה בטעינת רשימת חירום' : 'Failed to load emergency playlist')
    }
  }

  // Play a song from the emergency playlist
  const lastEmergencyToastRef = useRef<number>(0)
  const playEmergencySong = (index: number, playlist: Array<{name: string, url: string}>) => {
    if (!audioRef.current || playlist.length === 0) return

    const song = playlist[index % playlist.length]
    // Convert relative URL to absolute URL with backend base
    const absoluteUrl = api.getEmergencyStreamUrl(song.url)
    audioRef.current.src = absoluteUrl
    audioRef.current.volume = isMuted ? 0 : volume / 100
    audioRef.current.play()
      .then(() => {
        // Reset error counter on successful play
        emergencyErrorsRef.current = 0
      })
      .catch(console.error)
    setIsPlaying(true)
    setHasError(false)

    // Rate limit toasts - only show once every 10 seconds
    const now = Date.now()
    if (now - lastEmergencyToastRef.current > 10000) {
      lastEmergencyToastRef.current = now
      toast.info(isRTL ? `מצב חירום: ${song.name}` : `Emergency: ${song.name}`)
    }
  }

  // Exit emergency mode and resume normal playback
  const exitEmergencyMode = () => {
    setEmergencyMode(false)
    consecutiveErrorsRef.current = 0

    if (emergencyRetryIntervalRef.current) {
      clearInterval(emergencyRetryIntervalRef.current)
      emergencyRetryIntervalRef.current = null
    }

    toast.success(isRTL ? 'חוזר לניגון רגיל' : 'Resuming normal playback')

    // Try to play next from queue
    if (onNext && queueRef.current.length > 0) {
      onNext()
    }
  }

  // Handle emergency track ending - play next in emergency playlist
  const handleEmergencyTrackEnded = () => {
    if (!emergencyMode) return

    emergencyIndexRef.current = (emergencyIndexRef.current + 1) % emergencyPlaylist.length
    playEmergencySong(emergencyIndexRef.current, emergencyPlaylist)
  }

  // Cleanup emergency mode on unmount
  useEffect(() => {
    return () => {
      if (emergencyRetryIntervalRef.current) {
        clearInterval(emergencyRetryIntervalRef.current)
      }
    }
  }, [])

  // Handle audio errors - auto-skip to next track for continuous playback
  const handleError = () => {
    if (!track && !emergencyMode) return
    setIsLoading(false)
    setHasError(true)
    setIsPlaying(false)
    needsFadeInRef.current = false // Don't try to fade in on error

    // In emergency mode, skip to next emergency song (but limit retries)
    if (emergencyMode) {
      emergencyErrorsRef.current++
      if (emergencyErrorsRef.current >= MAX_EMERGENCY_ERRORS) {
        // Too many emergency failures - give up and show error
        toast.error(isRTL
          ? 'מצב חירום נכשל. בבקשה בדוק את החיבור לאינטרנט.'
          : 'Emergency mode failed. Please check your internet connection.')
        setEmergencyMode(false)
        emergencyErrorsRef.current = 0
        if (emergencyRetryIntervalRef.current) {
          clearInterval(emergencyRetryIntervalRef.current)
          emergencyRetryIntervalRef.current = null
        }
        return
      }
      handleEmergencyTrackEnded()
      return
    }

    // Increment consecutive error counter
    consecutiveErrorsRef.current++

    // Check if we've hit too many consecutive errors - activate emergency mode
    if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
      activateEmergencyMode()
      return
    }

    const errorMsg = isRTL
      ? `שגיאה בניגון: ${track?.title || 'Unknown'}. מדלג לשיר הבא...`
      : `Playback error: ${track?.title || 'Unknown'}. Skipping to next...`
    toast.error(errorMsg)

    // Auto-skip to next track after a brief delay (radio must keep playing)
    setTimeout(() => {
      if (onNext && queueRef.current.length > 0) {
        // Skip to next track
        onNext()
      } else if (onTrackEnd) {
        // Try track end handler as fallback
        onTrackEnd()
      } else {
        // No more tracks and no handler - activate emergency mode
        activateEmergencyMode()
      }
    }, 1000) // 1 second delay before auto-skip
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
    // Animate queue item out before calling playNext
    animateQueuePopThenPlay(onTrackEnd)
  }

  // Handle skip with quick fade out (faster than natural end)
  const handleSkipNext = () => {
    if (!onNext) return

    // Start queue item exit animation immediately
    const firstItem = queueRef.current[0]
    const uniqueKey = firstItem ? `${firstItem._id}-0` : null
    if (uniqueKey) {
      setRemovingItems(prev => new Set(prev).add(uniqueKey))
    }

    // If already fading out or nearly at end, just skip immediately
    if (isFadingOutRef.current || (audioRef.current && duration - currentTime < 1)) {
      cancelFade()
      isFadingOutRef.current = false
      setIsFading(false)
      // Wait for queue animation then call onNext
      setTimeout(() => {
        if (uniqueKey) {
          setRemovingItems(prev => {
            const next = new Set(prev)
            next.delete(uniqueKey)
            return next
          })
        }
        onNext()
      }, 400)
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
          // Clear animation state and call onNext
          if (uniqueKey) {
            setRemovingItems(prev => {
              const next = new Set(prev)
              next.delete(uniqueKey)
              return next
            })
          }
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
          // Clear animation state and call onNext
          if (uniqueKey) {
            setRemovingItems(prev => {
              const next = new Set(prev)
              next.delete(uniqueKey)
              return next
            })
          }
          onNext()
        }
      }

      fadeAnimationRef.current = requestAnimationFrame(animate)
    } else {
      // Wait for queue animation then call onNext
      setTimeout(() => {
        if (uniqueKey) {
          setRemovingItems(prev => {
            const next = new Set(prev)
            next.delete(uniqueKey)
            return next
          })
        }
        onNext()
      }, 400)
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
    <div className="glass-card w-full">
      {/* Queue Panel - Expandable with animation */}
      <div
        ref={queuePanelRef}
        className={`bg-dark-800/50 relative flex flex-col overflow-hidden transition-all duration-300 ease-out w-full ${
          queueExpanded ? 'opacity-100 border-b border-white/10' : 'opacity-0 border-b-0'
        }`}
        style={{ height: queueExpanded ? queueHeight : 0 }}
      >
          {/* Resize Handle - at top, drag up to expand, drag down to shrink */}
          <div
            className="flex-shrink-0 h-3 cursor-ns-resize hover:bg-primary-500/20 transition-colors group flex items-center justify-center border-b border-white/5"
            onMouseDown={handleQueueResizeStart}
          >
            <div className="w-16 h-1 bg-dark-500 group-hover:bg-primary-500 rounded-full transition-colors" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 bg-dark-800 px-4 py-3 border-b border-white/5 w-full">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
                <ListMusic size={16} className="text-primary-400" />
                {isRTL ? 'תור השמעה' : 'Play Queue'}
                <span className="px-1.5 py-0.5 text-xs bg-dark-600 rounded-full text-dark-300">
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
          </div>

          {/* Scrollable Queue Content */}
          <div className="flex-1 overflow-y-auto p-4 pt-2 w-full">
          {queue.length > 0 ? (
            <div className="w-full">
            {/* Loading spinner while all items are animating in (initial load) */}
            {newItemsMap.size > 0 && newItemsMap.size === queue.length && (
              <div className="flex items-center justify-center py-4 mb-2">
                <Loader2 size={20} className="animate-spin text-primary-400" />
                <span className="ml-2 text-sm text-dark-400">
                  {isRTL ? 'טוען...' : 'Loading...'}
                </span>
              </div>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map((item, index) => `${item._id}-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1 w-full">
                  {queue.map((item, index) => {
                    // Use compound key to handle potential duplicate IDs
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
                        animationDelay={newItemsMap.has(item._id) ? newItemsMap.get(item._id)! * 150 : undefined}
                        isRemoving={removingItems.has(uniqueKey)}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
            </div>
          ) : (
            <div className="text-center py-4 text-dark-500">
              <ListMusic size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">{isRTL ? 'התור ריק' : 'Queue is empty'}</p>
              <p className="text-xs text-dark-600 mt-0.5">
                {isRTL ? 'לחץ על + ליד שיר כדי להוסיף' : 'Click + next to a song to add it'}
              </p>
            </div>
          )}
          </div>
        </div>

      {/* Hidden audio element */}
      <div className="p-4">
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => {
            setIsPlaying(true)
            setPendingAutoplay(false) // Clear pending state when playback starts
            // Fade in on resume from pause (not for new tracks - those use onCanPlay)
            if (!isFadingOutRef.current && audioRef.current && !needsFadeInRef.current) {
              fadeIn()
            }
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onCanPlay={() => {
            setIsLoading(false)
            setHasError(false)
            // Reset consecutive error counter on successful load
            consecutiveErrorsRef.current = 0
            // Trigger fade in when audio is ready and we need it
            if (needsFadeInRef.current && audioRef.current && !isFadingOutRef.current) {
              needsFadeInRef.current = false
              fadeIn()
            }
          }}
          onWaiting={() => setIsLoading(true)}
          onError={handleError}
        />

        <div className="flex items-center gap-4">
        {/* Track Info */}
        <div
          className={`flex items-center gap-3 flex-1 min-w-0 ${showClickToPlay ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={showClickToPlay ? () => setUserInteracted() : undefined}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasError ? 'bg-red-500/20' : (showClickToPlay || pendingAutoplay) ? 'bg-yellow-500/20 animate-pulse' : 'bg-primary-500/20'
          }`}>
            {isLoading ? (
              <Loader2 size={24} className="text-primary-400 animate-spin" />
            ) : hasError ? (
              <AlertCircle size={24} className="text-red-400" />
            ) : (showClickToPlay || pendingAutoplay) ? (
              <Play size={24} className="text-yellow-400" />
            ) : (
              <Music size={24} className="text-primary-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {showClickToPlay ? (
              <>
                <p className="font-medium text-yellow-400 truncate">
                  {isRTL ? 'לחץ כדי להתחיל' : 'Click to start'}
                </p>
                <p className="text-sm text-dark-400 truncate">
                  {isRTL ? `${queue.length} פריטים בתור` : `${queue.length} items in queue`}
                </p>
              </>
            ) : pendingAutoplay && track ? (
              <>
                <p className="font-medium text-yellow-400 truncate" dir="auto">
                  {track.title}
                </p>
                <p className="text-sm text-yellow-500/80 truncate">
                  {isRTL ? '⏵ לחץ על הכפתור לניגון' : '⏵ Click play to start'}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-dark-100 truncate" dir="auto">
                  {track?.title || (isRTL ? 'לא מנגן' : 'Not Playing')}
                </p>
                <p className="text-sm text-dark-400 truncate" dir="auto">
                  {track?.artist || (track?.type === 'commercial' ? (isRTL ? 'פרסומת' : 'Commercial') : '')}
                </p>
              </>
            )}
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
            className={`p-3 rounded-full transition-colors disabled:opacity-30 ${
              pendingAutoplay
                ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse shadow-lg shadow-yellow-500/50'
                : 'bg-primary-500 hover:bg-primary-600'
            }`}
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
            className="flex-1 h-1 bg-dark-700/50 backdrop-blur-sm rounded-full appearance-none cursor-pointer
              border border-white/5 transition-all duration-200
              hover:bg-dark-700/70
              focus:outline-none focus:ring-2 focus:ring-primary-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-500
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-glow-sm [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-glow
              [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-primary-500
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
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
            className="w-20 h-1 bg-dark-700/50 backdrop-blur-sm rounded-full appearance-none cursor-pointer
              border border-white/5 transition-all duration-200
              hover:bg-dark-700/70
              focus:outline-none focus:ring-2 focus:ring-primary-500/30
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-dark-300
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/10
              [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-thumb]:hover:bg-dark-200
              [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-dark-300
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
          />
        </div>

        {/* Queue Toggle */}
        <div className="tooltip-trigger">
          <button
            onClick={() => setQueueExpanded(!queueExpanded)}
            className={`p-2 rounded-lg transition-all duration-200 relative flex items-center gap-1 ${
              queueExpanded
                ? 'bg-primary-500/20 text-primary-400'
                : 'hover:bg-white/10 text-dark-300'
            }`}
          >
            <ListMusic size={20} />
            <ChevronUp
              size={14}
              className={`transition-transform duration-300 ${
                queueExpanded ? 'rotate-0' : 'rotate-180'
              }`}
            />
            {queue.length > 0 && (
              <span className={`absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold transition-transform duration-200 ${
                queueExpanded ? 'scale-100' : 'scale-110'
              }`}>
                {queue.length}
              </span>
            )}
          </button>
          <div className="tooltip tooltip-top">
            {isRTL ? 'תור השמעה' : 'Play Queue'}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

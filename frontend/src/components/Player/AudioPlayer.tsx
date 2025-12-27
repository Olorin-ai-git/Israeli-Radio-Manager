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
  AlertCircle
} from 'lucide-react'
import { api } from '../../services/api'
import { toast } from '../../store/toastStore'

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

  const isRTL = i18n.language === 'he'

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

  return (
    <div className="glass-card p-4">
      {/* Hidden audio element */}
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
      </div>
    </div>
  )
}

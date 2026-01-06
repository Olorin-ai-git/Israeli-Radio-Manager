import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Music, ListMusic } from 'lucide-react'
import { useService } from '../../services'
import { usePlayerStore } from '../../store/playerStore'

interface CompactNowPlayingBarProps {
  onQueueClick?: () => void
}

export default function CompactNowPlayingBar({ onQueueClick }: CompactNowPlayingBarProps) {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState(false)
  const service = useService()

  const { currentTrack, queue, isPlaying } = usePlayerStore()

  // Load album cover when track changes
  useEffect(() => {
    if (currentTrack?._id) {
      setCoverUrl(service.getCoverUrl(currentTrack._id))
      setCoverError(false)
    } else {
      setCoverUrl(null)
      setCoverError(false)
    }
  }, [currentTrack?._id, service])

  const formatTime = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'song':
        return { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30', label: isRTL ? 'שיר' : 'Song' }
      case 'commercial':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: isRTL ? 'פרסומת' : 'Ad' }
      case 'show':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: isRTL ? 'תוכנית' : 'Show' }
      case 'jingle':
        return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', label: isRTL ? "ג'ינגל" : 'Jingle' }
      default:
        return { bg: 'bg-dark-500/20', text: 'text-dark-400', border: 'border-dark-500/30', label: type || '' }
    }
  }

  const typeBadge = getTypeBadge(currentTrack?.type)

  return (
    <div className={`glass-card overflow-hidden ${isPlaying ? 'ring-1 ring-primary-500/30' : ''}`}>
      <div className="bg-gradient-to-r from-primary-500/20 to-primary-600/10 px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Album Art */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden bg-dark-700/50 flex-shrink-0 ${isPlaying ? 'glow-animate' : ''}`}>
            {coverUrl && !coverError ? (
              <img
                src={coverUrl}
                alt="Album cover"
                className="w-full h-full object-cover"
                onError={() => setCoverError(true)}
              />
            ) : isPlaying ? (
              <div className="flex items-end gap-0.5 h-5 is-playing">
                <div className="w-1 bg-primary-400 audio-bar h-2 rounded-full"></div>
                <div className="w-1 bg-primary-400 audio-bar h-3 rounded-full"></div>
                <div className="w-1 bg-primary-400 audio-bar h-4 rounded-full"></div>
                <div className="w-1 bg-primary-400 audio-bar h-3 rounded-full"></div>
              </div>
            ) : (
              <Music size={20} className="text-dark-500" />
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {currentTrack ? (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-dark-100 truncate text-sm" dir="auto">
                      {currentTrack.title}
                    </h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}>
                      {typeBadge.label}
                    </span>
                  </div>
                  <p className="text-dark-400 text-xs truncate" dir="auto">
                    {currentTrack.artist || (isRTL ? 'אמן לא ידוע' : 'Unknown Artist')}
                    {currentTrack.duration_seconds && (
                      <span className="text-dark-500 mx-1">
                        {formatTime(currentTrack.duration_seconds)}
                      </span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="text-dark-400 text-sm">{t('dashboard.noTrack')}</p>
                <p className="text-dark-500 text-xs">
                  {isRTL ? 'בחר שיר מהספרייה' : 'Select from library'}
                </p>
              </div>
            )}
          </div>

          {/* Queue Badge Button */}
          <button
            onClick={onQueueClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-700/50 hover:bg-dark-600/50 border border-white/5 transition-colors"
          >
            <ListMusic size={16} className="text-dark-300" />
            <span className={`text-xs font-medium ${queue.length > 0 ? 'text-primary-400' : 'text-dark-400'}`}>
              {queue.length}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

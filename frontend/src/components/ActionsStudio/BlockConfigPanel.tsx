import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LucideIcon } from 'lucide-react'
import {
  X,
  Music,
  FileAudio,
  Megaphone,
  Radio,
  Clock,
  Volume2,
  MessageSquare,
  Search,
  Check,
} from 'lucide-react'
import { StudioAction, FlowActionType, useActionsStudioStore } from '../../store/actionsStudioStore'
import { api } from '../../services/api'

interface BlockConfigPanelProps {
  action: StudioAction
  isRTL: boolean
  onClose: () => void
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

// Available genres
const GENRES = [
  'hasidi', 'mizrahi', 'happy', 'israeli', 'pop', 'rock',
  'mediterranean', 'classic', 'hebrew', 'mixed', 'all'
]

export default function BlockConfigPanel({ action, isRTL, onClose }: BlockConfigPanelProps) {
  const { updateAction } = useActionsStudioStore()

  // Local state for form
  const [genre, setGenre] = useState(action.genre || '')
  const [durationMinutes, setDurationMinutes] = useState(action.duration_minutes || 30)
  const [songCount, setSongCount] = useState(action.song_count || 0)
  const [useDuration, setUseDuration] = useState(!action.song_count)
  const [commercialCount, setCommercialCount] = useState(action.commercial_count || 2)
  const [volumeLevel, setVolumeLevel] = useState(action.volume_level ?? 80)
  const [announcementText, setAnnouncementText] = useState(action.announcement_text || '')
  const [description, setDescription] = useState(action.description || '')
  const [contentSearch, setContentSearch] = useState('')
  const [selectedContentId, setSelectedContentId] = useState(action.content_id || '')
  const [selectedContentTitle, setSelectedContentTitle] = useState(action.content_title || '')

  // Fetch content for content/show picker
  const { data: contentItems } = useQuery({
    queryKey: ['content', action.action_type],
    queryFn: () => action.action_type === 'play_show'
      ? api.getShows()
      : api.getContent(),
    enabled: action.action_type === 'play_content' || action.action_type === 'play_show',
  })

  // Filter content locally by search
  const filteredContent = (Array.isArray(contentItems) ? contentItems : []).filter((item: any) => {
    if (!contentSearch) return true
    const searchLower = contentSearch.toLowerCase()
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.artist?.toLowerCase().includes(searchLower)
    )
  })

  // Fetch commercials
  const { data: commercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: api.getCommercials,
    enabled: action.action_type === 'play_commercials',
  })

  // Update action when form values change
  const handleSave = () => {
    const updates: Partial<StudioAction> = {
      description: description || undefined,
    }

    switch (action.action_type) {
      case 'play_genre':
        updates.genre = genre || undefined
        if (useDuration) {
          updates.duration_minutes = durationMinutes
          updates.song_count = undefined
        } else {
          updates.song_count = songCount
          updates.duration_minutes = undefined
        }
        break
      case 'play_content':
      case 'play_show':
        updates.content_id = selectedContentId || undefined
        updates.content_title = selectedContentTitle || undefined
        break
      case 'play_commercials':
        updates.commercial_count = commercialCount
        break
      case 'wait':
        updates.duration_minutes = durationMinutes
        break
      case 'set_volume':
        updates.volume_level = volumeLevel
        break
      case 'announcement':
        updates.announcement_text = announcementText
        break
    }

    updateAction(action.id, updates)
    onClose()
  }

  const Icon = ACTION_ICONS[action.action_type]

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      <div className="glass-card mx-4 mb-4 p-6 max-w-2xl mx-auto rounded-2xl shadow-glass-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-xl">
              <Icon size={24} className="text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'הגדרות בלוק' : 'Block Settings'}
              </h3>
              <p className="text-xs text-dark-400">{action.action_type.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Config Fields */}
        <div className="space-y-4 max-h-[50vh] overflow-auto">
          {/* Description (common to all) */}
          <div>
            <label className="block text-sm text-dark-300 mb-2">
              {isRTL ? 'תיאור' : 'Description'}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isRTL ? 'תיאור אופציונלי' : 'Optional description'}
              className="w-full glass-input"
            />
          </div>

          {/* Play Genre Config */}
          {action.action_type === 'play_genre' && (
            <>
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  {isRTL ? 'ז\'אנר' : 'Genre'} *
                </label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        genre === g
                          ? 'bg-primary-500 text-white'
                          : 'glass-button hover:bg-white/10'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={useDuration}
                      onChange={() => setUseDuration(true)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-dark-300">
                      {isRTL ? 'לפי משך זמן' : 'By duration'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!useDuration}
                      onChange={() => setUseDuration(false)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-dark-300">
                      {isRTL ? 'לפי מספר שירים' : 'By song count'}
                    </span>
                  </label>
                </div>

                {useDuration ? (
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">
                      {isRTL ? 'משך בדקות' : 'Duration (minutes)'}
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={180}
                      step={5}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-dark-400 mt-1">
                      <span>5</span>
                      <span className="text-primary-400 font-medium">{durationMinutes} {isRTL ? 'דקות' : 'min'}</span>
                      <span>180</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">
                      {isRTL ? 'מספר שירים' : 'Number of songs'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={songCount}
                      onChange={(e) => setSongCount(parseInt(e.target.value) || 1)}
                      className="w-24 glass-input"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Play Content / Show Config */}
          {(action.action_type === 'play_content' || action.action_type === 'play_show') && (
            <div>
              <label className="block text-sm text-dark-300 mb-2">
                {isRTL ? 'חפש תוכן' : 'Search content'}
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                  placeholder={isRTL ? 'חפש לפי שם...' : 'Search by name...'}
                  className="w-full glass-input pl-9"
                />
              </div>

              {selectedContentTitle && (
                <div className="mt-2 p-2 bg-primary-500/20 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-primary-400">{selectedContentTitle}</span>
                  <button
                    onClick={() => {
                      setSelectedContentId('')
                      setSelectedContentTitle('')
                    }}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {Array.isArray(filteredContent) && filteredContent.length > 0 && (
                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                  {filteredContent.slice(0, 10).map((item: any) => (
                    <button
                      key={item._id}
                      onClick={() => {
                        setSelectedContentId(item._id)
                        setSelectedContentTitle(item.title)
                        setContentSearch('')
                      }}
                      className="w-full p-2 text-left hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-dark-200">{item.title}</p>
                        {item.artist && (
                          <p className="text-xs text-dark-400">{item.artist}</p>
                        )}
                      </div>
                      {selectedContentId === item._id && (
                        <Check size={16} className="text-primary-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Play Commercials Config */}
          {action.action_type === 'play_commercials' && (
            <div>
              <label className="block text-sm text-dark-300 mb-2">
                {isRTL ? 'מספר פרסומות' : 'Number of commercials'}
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCommercialCount(n)}
                    className={`w-10 h-10 rounded-lg transition-all ${
                      commercialCount === n
                        ? 'bg-primary-500 text-white'
                        : 'glass-button'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {commercials && (
                <p className="text-xs text-dark-400 mt-2">
                  {commercials.length} {isRTL ? 'פרסומות זמינות' : 'commercials available'}
                </p>
              )}
            </div>
          )}

          {/* Wait Config */}
          {action.action_type === 'wait' && (
            <div>
              <label className="block text-sm text-dark-300 mb-2">
                {isRTL ? 'משך המתנה (דקות)' : 'Wait duration (minutes)'}
              </label>
              <input
                type="range"
                min={1}
                max={60}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-dark-400 mt-1">
                <span>1</span>
                <span className="text-primary-400 font-medium">{durationMinutes} {isRTL ? 'דקות' : 'min'}</span>
                <span>60</span>
              </div>
            </div>
          )}

          {/* Set Volume Config */}
          {action.action_type === 'set_volume' && (
            <div>
              <label className="block text-sm text-dark-300 mb-2">
                {isRTL ? 'עוצמת קול' : 'Volume level'}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={volumeLevel}
                onChange={(e) => setVolumeLevel(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-dark-400 mt-1">
                <span>0%</span>
                <span className="text-primary-400 font-medium">{volumeLevel}%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Announcement Config */}
          {action.action_type === 'announcement' && (
            <div>
              <label className="block text-sm text-dark-300 mb-2">
                {isRTL ? 'טקסט ההכרזה' : 'Announcement text'} *
              </label>
              <textarea
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder={isRTL ? 'הזן את טקסט ההכרזה...' : 'Enter announcement text...'}
                rows={4}
                className="w-full glass-input resize-none"
              />
              <p className="text-xs text-dark-400 mt-1">
                {announcementText.length} {isRTL ? 'תווים' : 'characters'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 glass-button"
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 glass-button-primary"
          >
            {isRTL ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

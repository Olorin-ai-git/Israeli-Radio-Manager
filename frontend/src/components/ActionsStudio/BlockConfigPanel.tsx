import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LucideIcon } from 'lucide-react'
import {
  X,
  Music,
  FileAudio,
  Megaphone,
  Radio as RadioIcon,
  Clock,
  Volume2,
  MessageSquare,
  Search,
  Check,
  AudioLines,
  VolumeX,
  Timer,
  CalendarClock,
} from 'lucide-react'
import { StudioAction, FlowActionType, useActionsStudioStore } from '../../store/actionsStudioStore'
import { api } from '../../services/api'
import { Input, Textarea, Slider, ButtonGroup, Radio, RadioGroup } from '../Form'

interface BlockConfigPanelProps {
  action: StudioAction
  isRTL: boolean
  onClose: () => void
}

const ACTION_ICONS: Record<FlowActionType, LucideIcon> = {
  play_genre: Music,
  play_content: FileAudio,
  play_commercials: Megaphone,
  play_scheduled_commercials: CalendarClock,
  play_show: RadioIcon,
  play_jingle: AudioLines,
  wait: Clock,
  set_volume: Volume2,
  fade_volume: VolumeX,
  announcement: MessageSquare,
  time_check: Timer,
}

// Available genres
const GENRES = [
  'hasidi', 'mizrahi', 'happy', 'israeli', 'pop', 'rock',
  'mediterranean', 'classic', 'hebrew', 'mixed', 'all'
]

// Commercial batch letters
const BATCH_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
type BatchLetter = typeof BATCH_LETTERS[number] | 'all'

// Convert batch number to letter (1 -> A, 2 -> B, etc.)
const batchNumberToLetter = (num: number | undefined): BatchLetter => {
  if (!num || num < 1 || num > BATCH_LETTERS.length) return 'all'
  return BATCH_LETTERS[num - 1]
}

// Convert batch letter to number (A -> 1, B -> 2, etc.)
const batchLetterToNumber = (letter: BatchLetter): number | undefined => {
  if (letter === 'all') return undefined
  const index = BATCH_LETTERS.indexOf(letter as typeof BATCH_LETTERS[number])
  return index >= 0 ? index + 1 : undefined
}

export default function BlockConfigPanel({ action, isRTL, onClose }: BlockConfigPanelProps) {
  const { updateAction } = useActionsStudioStore()

  // Local state for form
  const [genre, setGenre] = useState(action.genre || '')
  const [durationMinutes, setDurationMinutes] = useState(action.duration_minutes || 30)
  const [songCount, setSongCount] = useState(action.song_count || 0)
  const [useDuration, setUseDuration] = useState(!action.song_count)
  const [commercialCount, setCommercialCount] = useState(action.commercial_count || 1)
  const [batchLetter, setBatchLetter] = useState<BatchLetter>(batchNumberToLetter(action.batch_number))
  const [volumeLevel, setVolumeLevel] = useState(action.volume_level ?? 80)
  const [announcementText, setAnnouncementText] = useState(action.announcement_text || '')
  const [description, setDescription] = useState(action.description || '')
  const [contentSearch, setContentSearch] = useState('')
  const [selectedContentId, setSelectedContentId] = useState(action.content_id || '')
  const [selectedContentTitle, setSelectedContentTitle] = useState(action.content_title || '')
  // For play_scheduled_commercials
  const [maxCommercialDuration, setMaxCommercialDuration] = useState(action.max_commercial_duration_seconds || 0)
  const [maxCommercialCount, setMaxCommercialCount] = useState(action.max_commercial_count || 0)
  const [includeCampaignTypes, setIncludeCampaignTypes] = useState(action.include_campaign_types?.join(', ') || '')
  const [excludeCampaignTypes, setExcludeCampaignTypes] = useState(action.exclude_campaign_types?.join(', ') || '')

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

  // Fetch jingles for jingle picker
  const { data: jingles } = useQuery({
    queryKey: ['jingles'],
    queryFn: api.getJingles,
    enabled: action.action_type === 'play_jingle',
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
        updates.batch_number = batchLetterToNumber(batchLetter)
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
      case 'play_jingle':
        updates.content_id = selectedContentId || undefined
        updates.content_title = selectedContentTitle || undefined
        break
      case 'play_scheduled_commercials':
        updates.max_commercial_duration_seconds = maxCommercialDuration > 0 ? maxCommercialDuration : undefined
        updates.max_commercial_count = maxCommercialCount > 0 ? maxCommercialCount : undefined
        updates.include_campaign_types = includeCampaignTypes.trim()
          ? includeCampaignTypes.split(',').map(s => s.trim()).filter(Boolean)
          : undefined
        updates.exclude_campaign_types = excludeCampaignTypes.trim()
          ? excludeCampaignTypes.split(',').map(s => s.trim()).filter(Boolean)
          : undefined
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
          <Input
            label={isRTL ? 'תיאור' : 'Description'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isRTL ? 'תיאור אופציונלי' : 'Optional description'}
          />

          {/* Play Genre Config */}
          {action.action_type === 'play_genre' && (
            <>
              <ButtonGroup
                label={`${isRTL ? 'ז\'אנר' : 'Genre'} *`}
                value={genre}
                onChange={setGenre}
                options={GENRES.map((g) => ({ value: g, label: g }))}
              />

              <RadioGroup>
                <Radio
                  label={isRTL ? 'לפי משך זמן' : 'By duration'}
                  checked={useDuration}
                  onChange={() => setUseDuration(true)}
                  name="playback-mode"
                />
                <Radio
                  label={isRTL ? 'לפי מספר שירים' : 'By song count'}
                  checked={!useDuration}
                  onChange={() => setUseDuration(false)}
                  name="playback-mode"
                />
              </RadioGroup>

              {useDuration ? (
                <Slider
                  label={isRTL ? 'משך בדקות' : 'Duration'}
                  value={durationMinutes}
                  onChange={setDurationMinutes}
                  min={5}
                  max={180}
                  step={5}
                  unit={isRTL ? 'דקות' : 'min'}
                />
              ) : (
                <Input
                  type="number"
                  label={isRTL ? 'מספר שירים' : 'Number of songs'}
                  value={songCount.toString()}
                  onChange={(e) => setSongCount(parseInt(e.target.value) || 1)}
                  min={1}
                  max={50}
                />
              )}
            </>
          )}

          {/* Play Content / Show Config */}
          {(action.action_type === 'play_content' || action.action_type === 'play_show') && (
            <div>
              <Input
                label={isRTL ? 'חפש תוכן' : 'Search content'}
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                placeholder={isRTL ? 'חפש לפי שם...' : 'Search by name...'}
                icon={Search}
              />

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
            <>
              <ButtonGroup
                label={isRTL ? 'באצ\' פרסומות' : 'Commercial Batch'}
                value={batchLetter}
                onChange={(value) => setBatchLetter(value as BatchLetter)}
                options={[
                  { value: 'all', label: isRTL ? 'הכל' : 'All' },
                  ...BATCH_LETTERS.map((letter) => ({ value: letter, label: letter }))
                ]}
              />
              <ButtonGroup
                label={isRTL ? 'מספר חזרות' : 'Repeat count'}
                value={commercialCount}
                onChange={setCommercialCount}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}x` }))}
              />
              {commercials && (
                <p className="text-xs text-dark-400">
                  {commercials.length} {isRTL ? 'פרסומות זמינות' : 'commercials available'}
                  {batchLetter !== 'all' && (
                    <span className="text-primary-400">
                      {' '}• {isRTL ? `באצ' ${batchLetter}` : `Batch ${batchLetter}`}
                    </span>
                  )}
                </p>
              )}
            </>
          )}

          {/* Wait Config */}
          {action.action_type === 'wait' && (
            <Slider
              label={isRTL ? 'משך המתנה (דקות)' : 'Wait duration (minutes)'}
              value={durationMinutes}
              onChange={setDurationMinutes}
              min={1}
              max={60}
              step={1}
              unit={isRTL ? 'דקות' : 'min'}
            />
          )}

          {/* Set Volume Config */}
          {action.action_type === 'set_volume' && (
            <Slider
              label={isRTL ? 'עוצמת קול' : 'Volume level'}
              value={volumeLevel}
              onChange={setVolumeLevel}
              min={0}
              max={100}
              step={1}
              unit="%"
            />
          )}

          {/* Announcement Config */}
          {action.action_type === 'announcement' && (
            <Textarea
              label={`${isRTL ? 'טקסט ההכרזה' : 'Announcement text'} *`}
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder={isRTL ? 'הזן את טקסט ההכרזה...' : 'Enter announcement text...'}
              rows={4}
              showCount
            />
          )}

          {/* Play Scheduled Commercials Config */}
          {action.action_type === 'play_scheduled_commercials' && (
            <>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400">
                  {isRTL
                    ? 'פעולה זו מנגנת פרסומות מקמפיינים פעילים לפי לוח הזמנים שהוגדר במנהל הקמפיינים.'
                    : 'This action plays commercials from active campaigns based on the schedule defined in Campaign Manager.'}
                </p>
              </div>

              <Input
                type="number"
                label={isRTL ? 'מקסימום משך (שניות)' : 'Max Duration (seconds)'}
                value={maxCommercialDuration.toString()}
                onChange={(e) => setMaxCommercialDuration(parseInt(e.target.value) || 0)}
                placeholder={isRTL ? '0 = ללא הגבלה' : '0 = no limit'}
                min={0}
                max={600}
              />

              <Input
                type="number"
                label={isRTL ? 'מקסימום פרסומות' : 'Max Commercials'}
                value={maxCommercialCount.toString()}
                onChange={(e) => setMaxCommercialCount(parseInt(e.target.value) || 0)}
                placeholder={isRTL ? '0 = ללא הגבלה' : '0 = no limit'}
                min={0}
                max={20}
              />

              <Input
                label={isRTL ? 'כלול סוגי קמפיין (מופרדים בפסיק)' : 'Include Campaign Types (comma-separated)'}
                value={includeCampaignTypes}
                onChange={(e) => setIncludeCampaignTypes(e.target.value)}
                placeholder={isRTL ? 'למשל: ספונסר, חג' : 'e.g., sponsor, holiday'}
              />

              <Input
                label={isRTL ? 'החרג סוגי קמפיין (מופרדים בפסיק)' : 'Exclude Campaign Types (comma-separated)'}
                value={excludeCampaignTypes}
                onChange={(e) => setExcludeCampaignTypes(e.target.value)}
                placeholder={isRTL ? 'למשל: בדיקה' : 'e.g., test'}
              />
            </>
          )}

          {/* Play Jingle Config */}
          {action.action_type === 'play_jingle' && (
            <div>
              <Input
                label={isRTL ? "חפש ג'ינגל" : 'Search jingle'}
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                placeholder={isRTL ? 'חפש לפי שם...' : 'Search by name...'}
                icon={Search}
              />

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

              {Array.isArray(jingles) && jingles.length > 0 && (
                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                  {jingles
                    .filter((item: any) => {
                      if (!contentSearch) return true
                      const searchLower = contentSearch.toLowerCase()
                      return item.title?.toLowerCase().includes(searchLower)
                    })
                    .slice(0, 10)
                    .map((item: any) => (
                      <button
                        key={item._id}
                        onClick={() => {
                          setSelectedContentId(item._id)
                          setSelectedContentTitle(item.title || item.google_drive_path)
                          setContentSearch('')
                        }}
                        className="w-full p-2 text-left hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm text-dark-200">{item.title || item.google_drive_path}</p>
                        </div>
                        {selectedContentId === item._id && (
                          <Check size={16} className="text-primary-400" />
                        )}
                      </button>
                    ))}
                </div>
              )}

              {jingles && (
                <p className="text-xs text-dark-400 mt-2">
                  {jingles.length} {isRTL ? "ג'ינגלים זמינים" : 'jingles available'}
                </p>
              )}
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

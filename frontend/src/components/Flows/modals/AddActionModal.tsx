/**
 * Modal for adding a new action to a flow
 */

import { useState, useEffect, FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { Checkbox, Input, Select, Slider, Textarea } from '../../Form'
import { useService } from '../../../services'
import { FlowAction } from '../types'
import { FLOW_GENRES, ACTION_TYPE_OPTIONS, JINGLE_STYLE_OPTIONS, TIME_FORMAT_OPTIONS, TIME_LANGUAGE_OPTIONS, TTS_LANGUAGE_OPTIONS } from '../constants'

interface AddActionModalProps {
  isOpen: boolean
  isRTL: boolean
  onClose: () => void
  onAdd: (action: FlowAction) => void
}

const BATCH_OPTIONS = [
  { value: 'all', label: 'All Batches', label_he: 'כל האצוות' },
  { value: 'A', label: 'Batch A', label_he: 'אצווה A' },
  { value: 'B', label: 'Batch B', label_he: 'אצווה B' },
  { value: 'C', label: 'Batch C', label_he: 'אצווה C' },
  { value: 'D', label: 'Batch D', label_he: 'אצווה D' },
  { value: 'E', label: 'Batch E', label_he: 'אצווה E' },
]

export default function AddActionModal({
  isOpen,
  isRTL,
  onClose,
  onAdd,
}: AddActionModalProps) {
  const service = useService()
  const [selectedActionType, setSelectedActionType] = useState('play_genre')
  const [genre, setGenre] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [description, setDescription] = useState('')
  const [batchLetter, setBatchLetter] = useState('all')
  const [commercialCount, setCommercialCount] = useState(1)
  const [volumeLevel, setVolumeLevel] = useState(80)
  const [announcementText, setAnnouncementText] = useState('')
  const [songCount, setSongCount] = useState(0)
  const [useDuration, setUseDuration] = useState(true)
  // New action states
  const [selectedJingleId, setSelectedJingleId] = useState('')
  const [targetVolume, setTargetVolume] = useState(80)
  const [fadeDurationSeconds, setFadeDurationSeconds] = useState(5)
  const [timeFormat, setTimeFormat] = useState('24h')
  const [timeLanguage, setTimeLanguage] = useState('he')
  // TTS states
  const [voicePreset, setVoicePreset] = useState('default')
  const [ttsLanguage, setTtsLanguage] = useState<'he' | 'en'>('he')
  const [exaggeration, setExaggeration] = useState(1.0)
  const [useTts, setUseTts] = useState(true)
  // Generate jingle states
  const [jingleText, setJingleText] = useState('')
  const [jingleStyle, setJingleStyle] = useState<'station_id' | 'bumper' | 'transition' | 'promo'>('station_id')
  const [saveAsContent, setSaveAsContent] = useState(false)

  // Fetch commercials for selection
  const { data: commercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: () => service.getCommercials(),
    enabled: isOpen && selectedActionType === 'play_commercials'
  })

  // Fetch jingles for selection
  const { data: jingles } = useQuery({
    queryKey: ['jingles'],
    queryFn: () => service.getJingles(),
    enabled: isOpen && selectedActionType === 'play_jingle'
  })

  // Fetch voice presets for TTS actions
  const { data: voicePresets } = useQuery({
    queryKey: ['voicePresets'],
    queryFn: async () => {
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const baseUrl = isLocalDev ? '' : 'https://israeli-radio-manager-534446777606.us-east1.run.app'
      const response = await fetch(`${baseUrl}/api/voices/`)
      if (!response.ok) return []
      return response.json()
    },
    enabled: isOpen && ['announcement', 'time_check', 'generate_jingle'].includes(selectedActionType)
  })

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedActionType('play_genre')
      setGenre('')
      setDurationMinutes(30)
      setDescription('')
      setBatchLetter('all')
      setCommercialCount(1)
      setVolumeLevel(80)
      setAnnouncementText('')
      setSongCount(0)
      setUseDuration(true)
      // Reset new action states
      setSelectedJingleId('')
      setTargetVolume(80)
      setFadeDurationSeconds(5)
      setTimeFormat('24h')
      setTimeLanguage('he')
      // Reset TTS states
      setVoicePreset('default')
      setTtsLanguage('he')
      setExaggeration(1.0)
      setUseTts(true)
      setJingleText('')
      setJingleStyle('station_id')
      setSaveAsContent(false)
    }
  }, [isOpen])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    const action: FlowAction = {
      action_type: selectedActionType,
      description: description || getDefaultDescription(),
    }

    switch (selectedActionType) {
      case 'play_genre':
        action.genre = genre || 'mixed'
        if (useDuration) {
          action.duration_minutes = durationMinutes
        } else {
          action.song_count = songCount || 10
        }
        break
      case 'play_commercials':
        action.commercial_count = commercialCount
        if (batchLetter !== 'all') {
          action.batch_number = batchLetter.charCodeAt(0) - 64 // A=1, B=2, etc.
        }
        break
      case 'wait':
        action.duration_minutes = durationMinutes
        break
      case 'set_volume':
        action.volume_level = volumeLevel
        break
      case 'announcement':
        action.announcement_text = announcementText
        action.voice_preset = voicePreset
        action.tts_language = ttsLanguage
        action.exaggeration = exaggeration
        action.use_tts = useTts
        break
      case 'play_jingle':
        action.content_id = selectedJingleId
        break
      case 'fade_volume':
        action.target_volume = targetVolume
        action.fade_duration_seconds = fadeDurationSeconds
        break
      case 'time_check':
        action.time_format = timeFormat
        action.time_language = timeLanguage
        action.voice_preset = voicePreset
        action.use_tts = useTts
        break
      case 'generate_jingle':
        action.jingle_text = jingleText
        action.jingle_style = jingleStyle
        action.voice_preset = voicePreset
        action.tts_language = ttsLanguage
        action.exaggeration = exaggeration
        action.save_as_content = saveAsContent
        break
    }

    onAdd(action)
    onClose()
  }

  const getDefaultDescription = () => {
    switch (selectedActionType) {
      case 'play_genre':
        return `Play ${genre || 'mixed'} music`
      case 'play_commercials':
        return `Play ${batchLetter !== 'all' ? `Batch ${batchLetter}` : 'all'} commercials`
      case 'wait':
        return `Wait ${durationMinutes} minutes`
      case 'set_volume':
        return `Set volume to ${volumeLevel}%`
      case 'announcement':
        return 'Announcement'
      case 'play_jingle':
        const selectedJingle = jingles?.find((j: any) => j._id === selectedJingleId)
        return selectedJingle ? `Play jingle: ${selectedJingle.title}` : 'Play jingle'
      case 'fade_volume':
        return `Fade volume to ${targetVolume}% over ${fadeDurationSeconds}s`
      case 'time_check':
        return `Announce time (${timeFormat}, ${timeLanguage === 'he' ? 'Hebrew' : 'English'})`
      case 'generate_jingle':
        return `Generate ${jingleStyle.replace('_', ' ')} jingle`
      default:
        return selectedActionType
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="glass-card p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-dark-100">
            {isRTL ? 'הוסף פעולה' : 'Add Action'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Type */}
          <Select
            label={isRTL ? 'סוג פעולה' : 'Action Type'}
            value={selectedActionType}
            onChange={setSelectedActionType}
            options={ACTION_TYPE_OPTIONS.map(opt => ({
              value: opt.value,
              label: isRTL ? opt.label_he : opt.label,
            }))}
          />

          {/* Description */}
          <Input
            label={isRTL ? 'תיאור' : 'Description'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isRTL ? 'תיאור אופציונלי' : 'Optional description'}
          />

          {/* Play Genre Fields */}
          {selectedActionType === 'play_genre' && (
            <>
              <Select
                label={isRTL ? 'ז\'אנר' : 'Genre'}
                value={genre}
                onChange={setGenre}
                options={[
                  { value: '', label: isRTL ? 'בחר ז\'אנר' : 'Select genre' },
                  ...FLOW_GENRES.map(g => ({ value: g, label: g })),
                ]}
              />

              <div className="flex items-center gap-4 p-3 bg-dark-800/30 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={useDuration}
                    onChange={() => setUseDuration(true)}
                    className="text-primary-500"
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
                    className="text-primary-500"
                  />
                  <span className="text-sm text-dark-300">
                    {isRTL ? 'לפי מספר שירים' : 'By song count'}
                  </span>
                </label>
              </div>

              {useDuration ? (
                <Slider
                  label={isRTL ? 'משך (דקות)' : 'Duration (minutes)'}
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

          {/* Play Commercials Fields */}
          {selectedActionType === 'play_commercials' && (
            <>
              <Select
                label={isRTL ? 'אצווה' : 'Batch'}
                value={batchLetter}
                onChange={setBatchLetter}
                options={BATCH_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: isRTL ? opt.label_he : opt.label,
                }))}
              />

              <Slider
                label={isRTL ? 'מספר חזרות' : 'Repeat count'}
                value={commercialCount}
                onChange={setCommercialCount}
                min={1}
                max={5}
                step={1}
                unit="x"
              />

              {commercials && (
                <p className="text-xs text-dark-400">
                  {commercials.length} {isRTL ? 'פרסומות זמינות' : 'commercials available'}
                </p>
              )}
            </>
          )}

          {/* Wait Fields */}
          {selectedActionType === 'wait' && (
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

          {/* Set Volume Fields */}
          {selectedActionType === 'set_volume' && (
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

          {/* Announcement Fields */}
          {selectedActionType === 'announcement' && (
            <>
              <Textarea
                label={isRTL ? 'טקסט ההכרזה' : 'Announcement text'}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder={isRTL ? 'הזן את טקסט ההכרזה...' : 'Enter announcement text...'}
                rows={4}
                showCount
              />
              {/* TTS Options */}
              <div className="p-3 bg-dark-800/30 rounded-lg">
                <Checkbox
                  checked={useTts}
                  onChange={(e) => setUseTts(e.target.checked)}
                  label={isRTL ? 'השתמש ב-TTS (יצירת קול)' : 'Use TTS (generate audio)'}
                />
              </div>
              {useTts && (
                <>
                  <Select
                    label={isRTL ? 'קול' : 'Voice'}
                    value={voicePreset}
                    onChange={setVoicePreset}
                    options={[
                      { value: 'default', label: isRTL ? 'ברירת מחדל' : 'Default' },
                      ...(voicePresets || []).map((v: { name: string; display_name?: string }) => ({
                        value: v.name,
                        label: v.display_name || v.name,
                      })),
                    ]}
                  />
                  <Select
                    label={isRTL ? 'שפה' : 'Language'}
                    value={ttsLanguage}
                    onChange={(val) => setTtsLanguage(val as 'he' | 'en')}
                    options={TTS_LANGUAGE_OPTIONS.map(opt => ({
                      value: opt.value,
                      label: isRTL ? opt.label_he : opt.label,
                    }))}
                  />
                  <Slider
                    label={isRTL ? 'אקספרסיביות' : 'Expressiveness'}
                    value={exaggeration}
                    onChange={setExaggeration}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    unit=""
                  />
                </>
              )}
            </>
          )}

          {/* Play Jingle Fields */}
          {selectedActionType === 'play_jingle' && (
            <>
              <Select
                label={isRTL ? "בחר ג'ינגל" : 'Select Jingle'}
                value={selectedJingleId}
                onChange={setSelectedJingleId}
                options={[
                  { value: '', label: isRTL ? "בחר ג'ינגל..." : 'Select a jingle...' },
                  ...(jingles || []).map((j: any) => ({
                    value: j._id,
                    label: j.title || 'Untitled',
                  })),
                ]}
              />
              {jingles && (
                <p className="text-xs text-dark-400">
                  {jingles.length} {isRTL ? "ג'ינגלים זמינים" : 'jingles available'}
                </p>
              )}
            </>
          )}

          {/* Fade Volume Fields */}
          {selectedActionType === 'fade_volume' && (
            <>
              <Slider
                label={isRTL ? 'עוצמה סופית' : 'Target volume'}
                value={targetVolume}
                onChange={setTargetVolume}
                min={0}
                max={100}
                step={1}
                unit="%"
              />
              <Slider
                label={isRTL ? 'משך דעיכה (שניות)' : 'Fade duration (seconds)'}
                value={fadeDurationSeconds}
                onChange={setFadeDurationSeconds}
                min={1}
                max={30}
                step={1}
                unit={isRTL ? 'שניות' : 'sec'}
              />
            </>
          )}

          {/* Time Check Fields */}
          {selectedActionType === 'time_check' && (
            <>
              <Select
                label={isRTL ? 'פורמט שעה' : 'Time Format'}
                value={timeFormat}
                onChange={setTimeFormat}
                options={TIME_FORMAT_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: isRTL ? opt.label_he : opt.label,
                }))}
              />
              <Select
                label={isRTL ? 'שפה' : 'Language'}
                value={timeLanguage}
                onChange={setTimeLanguage}
                options={TIME_LANGUAGE_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: isRTL ? opt.label_he : opt.label,
                }))}
              />
              {/* TTS Options */}
              <div className="p-3 bg-dark-800/30 rounded-lg">
                <Checkbox
                  checked={useTts}
                  onChange={(e) => setUseTts(e.target.checked)}
                  label={isRTL ? 'השתמש ב-TTS (יצירת קול)' : 'Use TTS (generate audio)'}
                />
              </div>
              {useTts && (
                <Select
                  label={isRTL ? 'קול' : 'Voice'}
                  value={voicePreset}
                  onChange={setVoicePreset}
                  options={[
                    { value: 'default', label: isRTL ? 'ברירת מחדל' : 'Default' },
                    ...(voicePresets || []).map((v: { name: string; display_name?: string }) => ({
                      value: v.name,
                      label: v.display_name || v.name,
                    })),
                  ]}
                />
              )}
            </>
          )}

          {/* Generate Jingle (TTS) Fields */}
          {selectedActionType === 'generate_jingle' && (
            <>
              <Textarea
                label={isRTL ? 'טקסט הג\'ינגל' : 'Jingle text'}
                value={jingleText}
                onChange={(e) => setJingleText(e.target.value)}
                placeholder={isRTL ? 'רדיו קול חי - המוזיקה שלך!' : 'Radio Kol Chai - Your Music!'}
                rows={3}
                showCount
              />
              <Select
                label={isRTL ? 'סגנון' : 'Style'}
                value={jingleStyle}
                onChange={(val) => setJingleStyle(val as 'station_id' | 'bumper' | 'transition' | 'promo')}
                options={JINGLE_STYLE_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: isRTL ? opt.label_he : opt.label,
                }))}
              />
              <Select
                label={isRTL ? 'קול' : 'Voice'}
                value={voicePreset}
                onChange={setVoicePreset}
                options={[
                  { value: 'default', label: isRTL ? 'ברירת מחדל' : 'Default' },
                  ...(voicePresets || []).map((v: { name: string; display_name?: string }) => ({
                    value: v.name,
                    label: v.display_name || v.name,
                  })),
                ]}
              />
              <Select
                label={isRTL ? 'שפה' : 'Language'}
                value={ttsLanguage}
                onChange={(val) => setTtsLanguage(val as 'he' | 'en')}
                options={TTS_LANGUAGE_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: isRTL ? opt.label_he : opt.label,
                }))}
              />
              <Slider
                label={isRTL ? 'אקספרסיביות' : 'Expressiveness'}
                value={exaggeration}
                onChange={setExaggeration}
                min={0.5}
                max={2.0}
                step={0.1}
                unit=""
              />
              <div className="p-3 bg-dark-800/30 rounded-lg">
                <Checkbox
                  checked={saveAsContent}
                  onChange={(e) => setSaveAsContent(e.target.checked)}
                  label={isRTL ? 'שמור בספריית התוכן' : 'Save to content library'}
                />
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 glass-button py-2"
            >
              {isRTL ? 'ביטול' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>{isRTL ? 'הוסף' : 'Add'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

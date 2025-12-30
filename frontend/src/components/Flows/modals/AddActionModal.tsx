/**
 * Modal for adding a new action to a flow
 */

import { useState, useEffect, FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { Input, Select, Slider, Textarea } from '../../Form'
import { api } from '../../../services/api'
import { FlowAction } from '../types'
import { FLOW_GENRES, ACTION_TYPE_OPTIONS } from '../constants'

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

  // Fetch commercials for selection
  const { data: commercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: api.getCommercials,
    enabled: isOpen && selectedActionType === 'play_commercials'
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
            <Textarea
              label={isRTL ? 'טקסט ההכרזה' : 'Announcement text'}
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder={isRTL ? 'הזן את טקסט ההכרזה...' : 'Enter announcement text...'}
              rows={4}
              showCount
            />
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

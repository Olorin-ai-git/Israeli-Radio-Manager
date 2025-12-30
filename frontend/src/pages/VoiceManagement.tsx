/**
 * Voice Management Page - TTS voice presets for Chatterbox
 */

import { useState, useRef, ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Mic,
  Plus,
  Trash2,
  Play,
  Star,
  Upload,
  Loader2,
  AlertCircle,
  Check,
  Volume2,
} from 'lucide-react'
import Input from '../components/Form/Input'
import { useToastStore } from '../store/toastStore'

interface VoicePreset {
  _id: string
  name: string
  display_name: string
  display_name_he?: string
  language: string
  is_default: boolean
  created_at: string
}

interface TTSStatus {
  available: boolean
  model?: string
  device?: string
  voice_presets_count?: number
  reason?: string
}

// Use Cloud Run backend in production, local proxy in development
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API_BASE_URL = isLocalDev
  ? ''
  : 'https://israeli-radio-manager-534446777606.us-east1.run.app'

export default function VoiceManagement() {
  const { i18n } = useTranslation()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isRTL = i18n.language === 'he'

  // Form state
  const [showCloneForm, setShowCloneForm] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneDisplayName, setCloneDisplayName] = useState('')
  const [cloneLanguage, setCloneLanguage] = useState('he')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewText, setPreviewText] = useState('שלום, זה קול הניסיון שלי')
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)

  // Fetch TTS status
  const { data: ttsStatus, isLoading: statusLoading } = useQuery<TTSStatus>({
    queryKey: ['ttsStatus'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/voices/status`)
      if (!response.ok) throw new Error('Failed to fetch TTS status')
      return response.json()
    },
  })

  // Fetch voice presets
  const { data: voices, isLoading: voicesLoading } = useQuery<VoicePreset[]>({
    queryKey: ['voicePresets'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/voices/`)
      if (!response.ok) return []
      return response.json()
    },
  })

  // Clone voice mutation
  const cloneMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`${API_BASE_URL}/api/voices/clone`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to clone voice')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voicePresets'] })
      queryClient.invalidateQueries({ queryKey: ['ttsStatus'] })
      addToast(isRTL ? 'קול שוכפל בהצלחה' : 'Voice cloned successfully', 'success')
      resetCloneForm()
    },
    onError: (error: Error) => {
      addToast(error.message, 'error')
    },
  })

  // Delete voice mutation
  const deleteMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/voices/${voiceId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to delete voice')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voicePresets'] })
      queryClient.invalidateQueries({ queryKey: ['ttsStatus'] })
      addToast(isRTL ? 'קול נמחק' : 'Voice deleted', 'success')
    },
    onError: (error: Error) => {
      addToast(error.message, 'error')
    },
  })

  // Set default voice mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/voices/${voiceId}/set-default`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to set default voice')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voicePresets'] })
      addToast(isRTL ? 'קול ברירת מחדל עודכן' : 'Default voice updated', 'success')
    },
    onError: (error: Error) => {
      addToast(error.message, 'error')
    },
  })

  const resetCloneForm = () => {
    setShowCloneForm(false)
    setCloneName('')
    setCloneDisplayName('')
    setCloneLanguage('he')
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleClone = () => {
    if (!cloneName || !cloneDisplayName || !selectedFile) {
      addToast(isRTL ? 'נא למלא את כל השדות' : 'Please fill all fields', 'error')
      return
    }

    const formData = new FormData()
    formData.append('name', cloneName)
    formData.append('display_name', cloneDisplayName)
    formData.append('language', cloneLanguage)
    formData.append('reference_audio', selectedFile)

    cloneMutation.mutate(formData)
  }

  const handlePreview = async (voiceId: string) => {
    setPreviewingVoice(voiceId)
    try {
      const formData = new FormData()
      formData.append('text', previewText)

      const response = await fetch(`${API_BASE_URL}/api/voices/${voiceId}/preview`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to generate preview')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch (error) {
      addToast(isRTL ? 'נכשל ביצירת תצוגה מקדימה' : 'Failed to generate preview', 'error')
    } finally {
      setPreviewingVoice(null)
    }
  }

  if (statusLoading || voicesLoading) {
    return (
      <div className="p-6 max-w-4xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">
        {isRTL ? 'סטודיו קולות' : 'Voice Studio'}
      </h1>

      {/* TTS Status */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            ttsStatus?.available
              ? 'bg-green-500/20 border-green-500/30'
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            <Volume2 size={20} className={ttsStatus?.available ? 'text-green-400' : 'text-red-400'} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-dark-100">
              {isRTL ? 'סטטוס שירות TTS' : 'TTS Service Status'}
            </h2>
            <p className={`text-sm ${ttsStatus?.available ? 'text-green-400' : 'text-red-400'}`}>
              {ttsStatus?.available
                ? (isRTL ? 'זמין' : 'Available')
                : (isRTL ? 'לא זמין' : 'Unavailable')}
            </p>
          </div>
        </div>

        {ttsStatus?.available ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-dark-800/30 rounded-lg">
              <p className="text-dark-400">{isRTL ? 'מודל' : 'Model'}</p>
              <p className="text-dark-100 font-medium">{ttsStatus.model}</p>
            </div>
            <div className="p-3 bg-dark-800/30 rounded-lg">
              <p className="text-dark-400">{isRTL ? 'מכשיר' : 'Device'}</p>
              <p className="text-dark-100 font-medium">{ttsStatus.device}</p>
            </div>
            <div className="p-3 bg-dark-800/30 rounded-lg">
              <p className="text-dark-400">{isRTL ? 'קולות' : 'Voices'}</p>
              <p className="text-dark-100 font-medium">{ttsStatus.voice_presets_count}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 p-3 rounded-lg">
            <AlertCircle size={16} />
            <span className="text-sm">{ttsStatus?.reason || 'TTS service not configured'}</span>
          </div>
        )}
      </div>

      {/* Clone Voice Form */}
      {showCloneForm ? (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/30">
              <Mic size={20} className="text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">
              {isRTL ? 'שכפל קול חדש' : 'Clone New Voice'}
            </h2>
          </div>

          <div className="space-y-4">
            <Input
              label={isRTL ? 'מזהה קול (באנגלית)' : 'Voice ID (English)'}
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value.toLowerCase().replace(/\s/g, '_'))}
              placeholder="morning_dj"
            />
            <Input
              label={isRTL ? 'שם תצוגה' : 'Display Name'}
              value={cloneDisplayName}
              onChange={(e) => setCloneDisplayName(e.target.value)}
              placeholder={isRTL ? 'קריין בוקר' : 'Morning DJ'}
            />
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                {isRTL ? 'שפה' : 'Language'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCloneLanguage('he')}
                  className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                    cloneLanguage === 'he'
                      ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                      : 'border-white/10 text-dark-300 hover:border-white/20'
                  }`}
                >
                  {isRTL ? 'עברית' : 'Hebrew'}
                </button>
                <button
                  type="button"
                  onClick={() => setCloneLanguage('en')}
                  className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                    cloneLanguage === 'en'
                      ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                      : 'border-white/10 text-dark-300 hover:border-white/20'
                  }`}
                >
                  {isRTL ? 'אנגלית' : 'English'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                {isRTL ? 'קובץ אודיו לדוגמה (3-10 שניות)' : 'Reference Audio (3-10 seconds)'}
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-primary-500/30 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload size={32} className="mx-auto mb-2 text-dark-400" />
                {selectedFile ? (
                  <p className="text-dark-100">{selectedFile.name}</p>
                ) : (
                  <p className="text-dark-400">
                    {isRTL ? 'לחץ להעלאת קובץ אודיו' : 'Click to upload audio file'}
                  </p>
                )}
                <p className="text-xs text-dark-500 mt-1">WAV, MP3, OGG</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetCloneForm}
                className="flex-1 glass-button py-2"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleClone}
                disabled={cloneMutation.isPending || !cloneName || !cloneDisplayName || !selectedFile}
                className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cloneMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mic size={16} />
                )}
                {isRTL ? 'שכפל קול' : 'Clone Voice'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCloneForm(true)}
          disabled={!ttsStatus?.available}
          className="w-full glass-button-primary py-3 mb-6 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus size={20} />
          {isRTL ? 'שכפל קול חדש' : 'Clone New Voice'}
        </button>
      )}

      {/* Preview Text Input */}
      <div className="glass-card p-4 mb-6">
        <Input
          label={isRTL ? 'טקסט לתצוגה מקדימה' : 'Preview Text'}
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder={isRTL ? 'הזן טקסט לניסיון...' : 'Enter text to test...'}
        />
      </div>

      {/* Voice Presets List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-dark-100 mb-4">
          {isRTL ? 'קולות זמינים' : 'Available Voices'}
        </h2>

        {voices && voices.length > 0 ? (
          voices.map((voice) => (
            <div
              key={voice._id}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                voice.is_default
                  ? 'bg-primary-500/20 border-primary-500/30'
                  : 'bg-dark-700/50 border-white/10'
              }`}>
                <Mic size={24} className={voice.is_default ? 'text-primary-400' : 'text-dark-400'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-dark-100 truncate">
                    {isRTL && voice.display_name_he ? voice.display_name_he : voice.display_name}
                  </h3>
                  {voice.is_default && (
                    <span className="px-2 py-0.5 text-xs bg-primary-500/20 text-primary-400 rounded-full border border-primary-500/30">
                      {isRTL ? 'ברירת מחדל' : 'Default'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-dark-400">
                  {voice.name} • {voice.language === 'he' ? (isRTL ? 'עברית' : 'Hebrew') : (isRTL ? 'אנגלית' : 'English')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePreview(voice._id)}
                  disabled={previewingVoice !== null || !ttsStatus?.available}
                  className="p-2 glass-button rounded-lg disabled:opacity-50"
                  title={isRTL ? 'נגן תצוגה מקדימה' : 'Play Preview'}
                >
                  {previewingVoice === voice._id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Play size={18} />
                  )}
                </button>

                {!voice.is_default && (
                  <>
                    <button
                      onClick={() => setDefaultMutation.mutate(voice._id)}
                      disabled={setDefaultMutation.isPending}
                      className="p-2 glass-button rounded-lg disabled:opacity-50"
                      title={isRTL ? 'הגדר כברירת מחדל' : 'Set as Default'}
                    >
                      <Star size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(isRTL ? 'האם למחוק קול זה?' : 'Delete this voice?')) {
                          deleteMutation.mutate(voice._id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 glass-button rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      title={isRTL ? 'מחק' : 'Delete'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}

                {voice.is_default && (
                  <div className="p-2 text-green-400">
                    <Check size={18} />
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card p-8 text-center">
            <Mic size={48} className="mx-auto mb-4 text-dark-500" />
            <p className="text-dark-400">
              {isRTL ? 'אין קולות זמינים' : 'No voices available'}
            </p>
            <p className="text-sm text-dark-500 mt-1">
              {isRTL ? 'שכפל קול חדש להתחלה' : 'Clone a new voice to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

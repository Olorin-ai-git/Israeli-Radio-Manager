import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload as UploadIcon, File, CheckCircle, XCircle, Loader2, X, Music, Radio, Megaphone, Disc, AudioLines, Newspaper } from 'lucide-react'
import { useService } from '../services'

interface UploadedFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  result?: any
  error?: string
}

interface PendingUpload {
  _id: string
  filename: string
  metadata: {
    title?: string
    artist?: string
    genre?: string
    duration_seconds?: number
  }
  suggested_type: string
  suggested_genre?: string
  status: string
  created_at: string
}

type ContentType = 'song' | 'commercial' | 'show' | 'jingle' | 'sample' | 'newsflash'

interface EditFormData {
  content_type: ContentType
  genre: string
  title: string
  artist: string
}

const contentTypeOptions = [
  { value: 'song', label: 'Song', labelHe: 'שיר', icon: Music },
  { value: 'show', label: 'Show', labelHe: 'תוכנית', icon: Radio },
  { value: 'commercial', label: 'Commercial', labelHe: 'פרסומת', icon: Megaphone },
  { value: 'jingle', label: 'Jingle', labelHe: "ג'ינגל", icon: Disc },
  { value: 'sample', label: 'Sample', labelHe: 'סאמפל', icon: AudioLines },
  { value: 'newsflash', label: 'Newsflash', labelHe: 'מבזק חדשות', icon: Newspaper },
]

export default function Upload() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const queryClient = useQueryClient()
  const service = useService()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [editingUpload, setEditingUpload] = useState<PendingUpload | null>(null)
  const [editForm, setEditForm] = useState<EditFormData>({
    content_type: 'song',
    genre: '',
    title: '',
    artist: '',
  })

  const { data: pendingUploads } = useQuery({
    queryKey: ['pendingUploads'],
    queryFn: () => service.getPendingUploads(),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => service.uploadFile(file, { auto_categorize: true }),
    onSuccess: (result, file) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: 'success', result } : f
        )
      )
      queryClient.invalidateQueries({ queryKey: ['pendingUploads'] })
    },
    onError: (error: any, file) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file ? { ...f, status: 'error', error: error.message } : f
        )
      )
    },
  })

  const confirmMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditFormData }) =>
      service.confirmUpload(id, {
        content_type: data.content_type,
        genre: data.genre || undefined,
        title: data.title || undefined,
        artist: data.artist || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUploads'] })
      queryClient.invalidateQueries({ queryKey: ['content'] })
      setEditingUpload(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => service.cancelPendingUpload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUploads'] })
    },
  })

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const handleFiles = (newFiles: File[]) => {
    const audioFiles = newFiles.filter((f) =>
      ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/aac', 'audio/ogg'].includes(f.type) ||
      f.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)
    )

    const uploadFiles: UploadedFile[] = audioFiles.map((file) => ({
      file,
      status: 'pending',
      progress: 0,
    }))

    setFiles((prev) => [...prev, ...uploadFiles])

    // Start uploading
    uploadFiles.forEach((uf) => {
      setFiles((prev) =>
        prev.map((f) => (f.file === uf.file ? { ...f, status: 'uploading' } : f))
      )
      uploadMutation.mutate(uf.file)
    })
  }

  const openEditModal = (upload: PendingUpload) => {
    setEditForm({
      content_type: (upload.suggested_type as ContentType) || 'song',
      genre: upload.suggested_genre || upload.metadata?.genre || '',
      title: upload.metadata?.title || upload.filename.replace(/\.[^/.]+$/, ''),
      artist: upload.metadata?.artist || '',
    })
    setEditingUpload(upload)
  }

  const handleApprove = (upload: PendingUpload) => {
    confirmMutation.mutate({
      id: upload._id,
      data: {
        content_type: (upload.suggested_type as ContentType) || 'song',
        genre: upload.suggested_genre || upload.metadata?.genre || '',
        title: upload.metadata?.title || upload.filename.replace(/\.[^/.]+$/, ''),
        artist: upload.metadata?.artist || '',
      },
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUpload) return
    confirmMutation.mutate({
      id: editingUpload._id,
      data: editForm,
    })
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 size={20} className="animate-spin text-primary-400" />
      case 'success':
        return <CheckCircle size={20} className="text-emerald-400" />
      case 'error':
        return <XCircle size={20} className="text-primary-400" />
      default:
        return <File size={20} className="text-dark-400" />
    }
  }

  const getContentTypeIcon = (type: string) => {
    const option = contentTypeOptions.find((o) => o.value === type)
    if (!option) return <Music size={16} />
    const Icon = option.icon
    return <Icon size={16} />
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('upload.title')}</h1>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`glass-card border-2 border-dashed p-12 text-center transition-all ${
          dragActive
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-dark-600 hover:border-dark-500'
        }`}
      >
        <input
          type="file"
          id="file-input"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
          dragActive ? 'bg-primary-500/20 border border-primary-500/30' : 'bg-dark-700/50 border border-white/10'
        }`}>
          <UploadIcon size={40} className={dragActive ? 'text-primary-400' : 'text-dark-400'} />
        </div>
        <p className="text-lg font-medium text-dark-100 mb-2">{t('upload.dragDrop')}</p>
        <p className="text-dark-400 mb-4">{t('upload.orClick')}</p>
        <label
          htmlFor="file-input"
          className="inline-block px-6 py-2.5 glass-button-primary cursor-pointer"
        >
          {isRTL ? 'בחר קבצים' : 'Browse Files'}
        </label>
      </div>

      {/* Upload List */}
      {files.length > 0 && (
        <div className="mt-6 glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-medium text-dark-100">{isRTL ? 'העלאות' : 'Uploads'}</h2>
          </div>
          <div className="divide-y divide-white/5">
            {files.map((uf, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                {getStatusIcon(uf.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dark-100 truncate">{uf.file.name}</p>
                  <p className="text-sm text-dark-400">
                    {(uf.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <span className={`text-sm font-medium ${
                  uf.status === 'success' ? 'text-emerald-400' :
                  uf.status === 'error' ? 'text-primary-400' :
                  uf.status === 'uploading' ? 'text-sky-400' : 'text-dark-400'
                }`}>
                  {uf.status === 'uploading' ? t('upload.uploading') :
                   uf.status === 'success' ? t('upload.success') :
                   uf.status === 'error' ? t('upload.error') : (isRTL ? 'ממתין' : 'Pending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Categorization */}
      {Array.isArray(pendingUploads) && pendingUploads.length > 0 && (
        <div className="mt-6 glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-amber-500/10">
            <h2 className="font-medium text-amber-400">
              {isRTL ? 'ממתין לסיווג' : 'Pending Categorization'}
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {pendingUploads.map((upload: PendingUpload) => (
              <div key={upload._id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {getContentTypeIcon(upload.suggested_type)}
                  <div>
                    <p className="font-medium text-dark-100">{upload.filename}</p>
                    <p className="text-sm text-dark-400">
                      {isRTL ? 'הצעת AI:' : 'AI Suggestion:'} {upload.suggested_type}
                      {upload.suggested_genre && ` - ${upload.suggested_genre}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(upload)}
                    disabled={confirmMutation.isPending}
                    className="px-3 py-1.5 text-sm glass-button-primary disabled:opacity-50"
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      isRTL ? 'אשר' : 'Approve'
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(upload)}
                    className="px-3 py-1.5 text-sm glass-button"
                  >
                    {isRTL ? 'ערוך' : 'Edit'}
                  </button>
                  <button
                    onClick={() => cancelMutation.mutate(upload._id)}
                    disabled={cancelMutation.isPending}
                    className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    {isRTL ? 'בטל' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
              <h3 className="text-lg font-semibold text-dark-100">
                {isRTL ? 'סיווג קובץ' : 'Categorize File'}
              </h3>
              <button
                onClick={() => setEditingUpload(null)}
                className="p-2 text-dark-400 hover:text-dark-200 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {/* Filename */}
              <div className="p-3 bg-dark-700/50 rounded-lg">
                <p className="text-sm text-dark-400">{isRTL ? 'קובץ' : 'File'}</p>
                <p className="font-medium text-dark-100">{editingUpload.filename}</p>
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? 'סוג תוכן' : 'Content Type'} *
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {contentTypeOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, content_type: option.value as any })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                          editForm.content_type === option.value
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-dark-600 text-dark-400 hover:border-dark-500'
                        }`}
                      >
                        <Icon size={24} />
                        <span className="text-sm">{isRTL ? option.labelHe : option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? 'כותרת' : 'Title'}
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:border-primary-500"
                  placeholder={isRTL ? 'הכנס כותרת' : 'Enter title'}
                />
              </div>

              {/* Artist */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? 'אמן' : 'Artist'}
                </label>
                <input
                  type="text"
                  value={editForm.artist}
                  onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:border-primary-500"
                  placeholder={isRTL ? 'הכנס שם אמן' : 'Enter artist name'}
                />
              </div>

              {/* Genre */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? "ז'אנר" : 'Genre'}
                </label>
                <input
                  type="text"
                  value={editForm.genre}
                  onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:border-primary-500"
                  placeholder={isRTL ? "הכנס ז'אנר" : 'Enter genre'}
                />
              </div>

              {/* Error display */}
              {confirmMutation.isError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">
                    {(confirmMutation.error as any)?.response?.data?.detail || (isRTL ? 'שגיאה בסיווג' : 'Error categorizing')}
                  </p>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUpload(null)}
                  className="px-4 py-2 text-sm text-dark-300 hover:text-dark-100 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={confirmMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {confirmMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{isRTL ? 'שומר...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <span>{isRTL ? 'שמור ואשר' : 'Save & Confirm'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

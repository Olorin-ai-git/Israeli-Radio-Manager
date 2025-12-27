import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload as UploadIcon, File, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api } from '../services/api'

interface UploadedFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  result?: any
  error?: string
}

export default function Upload() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)

  const { data: pendingUploads } = useQuery({
    queryKey: ['pendingUploads'],
    queryFn: api.getPendingUploads,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadFile(file, { auto_categorize: true }),
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

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 size={20} className="animate-spin text-primary-500" />
      case 'success':
        return <CheckCircle size={20} className="text-green-500" />
      case 'error':
        return <XCircle size={20} className="text-red-500" />
      default:
        return <File size={20} className="text-gray-400" />
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('upload.title')}</h1>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
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

        <UploadIcon size={48} className={`mx-auto mb-4 ${dragActive ? 'text-primary-500' : 'text-gray-400'}`} />
        <p className="text-lg font-medium text-gray-700 mb-2">{t('upload.dragDrop')}</p>
        <p className="text-gray-500 mb-4">{t('upload.orClick')}</p>
        <label
          htmlFor="file-input"
          className="inline-block px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 cursor-pointer transition-colors"
        >
          Browse Files
        </label>
      </div>

      {/* Upload List */}
      {files.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-medium text-gray-900">Uploads</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {files.map((uf, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                {getStatusIcon(uf.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{uf.file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(uf.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <span className={`text-sm font-medium ${
                  uf.status === 'success' ? 'text-green-600' :
                  uf.status === 'error' ? 'text-red-600' :
                  uf.status === 'uploading' ? 'text-primary-600' : 'text-gray-500'
                }`}>
                  {uf.status === 'uploading' ? t('upload.uploading') :
                   uf.status === 'success' ? t('upload.success') :
                   uf.status === 'error' ? t('upload.error') : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Categorization */}
      {pendingUploads && pendingUploads.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-yellow-50">
            <h2 className="font-medium text-yellow-800">Pending Categorization</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingUploads.map((upload: any) => (
              <div key={upload._id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">{upload.filename}</p>
                  <p className="text-sm text-gray-500">AI Suggestion: {upload.suggested_type}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600">
                    {t('agent.approve')}
                  </button>
                  <button className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

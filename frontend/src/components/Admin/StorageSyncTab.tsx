import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HardDrive, RefreshCw, Trash2, AlertTriangle, Cloud, FolderOpen } from 'lucide-react'
import api from '../../services/api'
import { toast } from '../../store/toastStore'

interface StorageSyncTabProps {
  isRTL: boolean
}

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export default function StorageSyncTab({ isRTL }: StorageSyncTabProps) {
  const queryClient = useQueryClient()

  const { data: storageStats, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'storage', 'stats'],
    queryFn: api.getAdminStorageStats,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false
  })

  const { data: orphanedFiles } = useQuery({
    queryKey: ['admin', 'storage', 'orphaned'],
    queryFn: api.getAdminOrphanedFiles,
    retry: false
  })

  const clearCacheMutation = useMutation({
    mutationFn: api.clearAdminCache,
    onSuccess: (data) => {
      toast.success(isRTL
        ? `נוקו ${data.files_deleted} קבצים (${formatBytes(data.bytes_freed)})`
        : `Cleared ${data.files_deleted} files (${formatBytes(data.bytes_freed)})`
      )
      refetch()
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בניקוי מטמון' : `Error clearing cache: ${error.response?.data?.detail || error.message}`)
    }
  })

  const syncMutation = useMutation({
    mutationFn: api.startSync,
    onSuccess: () => {
      toast.success(isRTL ? 'הסנכרון החל' : 'Sync started')
      refetch()
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בהתחלת סנכרון' : `Error starting sync: ${error.response?.data?.detail || error.message}`)
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-amber-400" size={48} />
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {isRTL ? 'נדרשת הרשאת מנהל' : 'Admin Authorization Required'}
          </h3>
          <p className="text-sm text-dark-400">
            {isRTL ? 'עליך להתחבר עם חשבון מנהל כדי לצפות בדף זה' : 'Please sign in with an admin account to view this page'}
          </p>
        </div>
      </div>
    )
  }

  const totalOrphaned = (orphanedFiles?.cache?.length || 0) + (orphanedFiles?.gcs?.length || 0)

  return (
    <div className="space-y-6">
      {/* Storage Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Local Cache */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-dark-100">
              {isRTL ? 'מטמון מקומי' : 'Local Cache'}
            </h3>
            <HardDrive size={20} className="text-blue-400" />
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-dark-100">
              {formatBytes(storageStats?.cache?.size_bytes || 0)}
            </div>
            <div className="text-sm text-dark-400">
              {storageStats?.cache?.file_count || 0} {isRTL ? 'קבצים' : 'files'}
            </div>
            {storageStats?.cache?.exists === false && (
              <div className="text-xs text-amber-400">
                {isRTL ? 'לא קיים' : 'Not exists'}
              </div>
            )}
          </div>
        </div>

        {/* GCS Bucket */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-dark-100">
              {isRTL ? 'GCS Bucket' : 'GCS Bucket'}
            </h3>
            <Cloud size={20} className="text-emerald-400" />
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-dark-100">
              {formatBytes(storageStats?.gcs?.size_bytes || 0)}
            </div>
            <div className="text-sm text-dark-400">
              {storageStats?.gcs?.file_count || 0} {isRTL ? 'קבצים' : 'files'}
            </div>
            {storageStats?.gcs?.error && (
              <div className="text-xs text-red-400">
                {isRTL ? 'שגיאה' : 'Error'}: {storageStats.gcs.error}
              </div>
            )}
          </div>
        </div>

        {/* Google Drive */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-dark-100">
              {isRTL ? 'Google Drive' : 'Google Drive'}
            </h3>
            <FolderOpen size={20} className="text-amber-400" />
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-dark-100">
              {formatBytes(storageStats?.drive?.used_bytes || 0)}
            </div>
            <div className="text-sm text-dark-400">
              {storageStats?.drive?.usage_percentage?.toFixed(1) || 0}% {isRTL ? 'בשימוש' : 'used'}
            </div>
            {storageStats?.drive?.error && (
              <div className="text-xs text-red-400">
                {isRTL ? 'שגיאה' : 'Error'}: {storageStats.drive.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Actions */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-dark-100 mb-4">
          {isRTL ? 'סנכרון ותחזוקה' : 'Sync & Maintenance'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="glass-button-primary flex items-center justify-center gap-2 px-4 py-3 disabled:opacity-50"
          >
            <RefreshCw size={18} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending
              ? (isRTL ? 'מסנכרן...' : 'Syncing...')
              : (isRTL ? 'סנכרון ידני מ-Drive' : 'Manual Sync from Drive')
            }
          </button>
          <button
            onClick={() => {
              const confirmed = confirm(isRTL ? 'לנקות את כל קבצי המטמון?' : 'Clear all cached files?')
              if (confirmed) {
                clearCacheMutation.mutate()
              }
            }}
            disabled={clearCacheMutation.isPending}
            className="glass-button flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border-red-500/30 disabled:opacity-50"
          >
            <Trash2 size={18} />
            {clearCacheMutation.isPending
              ? (isRTL ? 'מנקה...' : 'Clearing...')
              : (isRTL ? 'נקה מטמון' : 'Clear Cache')
            }
          </button>
        </div>
      </div>

      {/* Orphaned Files */}
      {totalOrphaned > 0 && (
        <div className="glass-card p-6 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-amber-400" size={20} />
            <h3 className="font-semibold text-amber-400">
              {totalOrphaned} {isRTL ? 'קבצים יתומים נמצאו' : 'Orphaned Files Found'}
            </h3>
          </div>
          <div className="space-y-4">
            {orphanedFiles?.cache && orphanedFiles.cache.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-100 mb-2">
                  {isRTL ? 'מטמון' : 'Cache'} ({orphanedFiles.cache.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {orphanedFiles.cache.slice(0, 10).map((file: string, idx: number) => (
                    <div key={idx} className="text-xs text-dark-400 font-mono truncate">
                      {file}
                    </div>
                  ))}
                  {orphanedFiles.cache.length > 10 && (
                    <div className="text-xs text-dark-500">
                      ... {orphanedFiles.cache.length - 10} {isRTL ? 'נוספים' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}
            {orphanedFiles?.gcs && orphanedFiles.gcs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-100 mb-2">
                  GCS ({orphanedFiles.gcs.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {orphanedFiles.gcs.slice(0, 10).map((file: string, idx: number) => (
                    <div key={idx} className="text-xs text-dark-400 font-mono truncate">
                      {file}
                    </div>
                  ))}
                  {orphanedFiles.gcs.length > 10 && (
                    <div className="text-xs text-dark-500">
                      ... {orphanedFiles.gcs.length - 10} {isRTL ? 'נוספים' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

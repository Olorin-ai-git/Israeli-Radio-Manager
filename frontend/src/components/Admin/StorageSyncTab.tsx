import { useQuery, useMutation } from '@tanstack/react-query'
import { HardDrive, RefreshCw, Trash2, AlertTriangle, Cloud, FolderOpen, Upload, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { useService } from '../../services'
import { toast } from '../../store/toastStore'

interface SyncLogEntry {
  time: string
  level: 'INFO' | 'FILE' | 'GCS' | 'ERROR'
  message: string
}

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

// Helper function to format time ago
const formatTimeAgo = (isoString: string | null): string => {
  if (!isoString) return 'Never'
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// Helper function to format log time
const formatLogTime = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Log level colors and icons
const logLevelStyles: Record<string, { color: string; bg: string }> = {
  'INFO': { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'FILE': { color: 'text-dark-300', bg: 'bg-dark-600/50' },
  'GCS': { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'ERROR': { color: 'text-red-400', bg: 'bg-red-500/10' },
}

export default function StorageSyncTab({ isRTL }: StorageSyncTabProps) {
  const service = useService()

  const { data: storageStats, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'storage', 'stats'],
    queryFn: () => service.getAdminStorageStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false
  })

  const { data: orphanedFiles } = useQuery({
    queryKey: ['admin', 'storage', 'orphaned'],
    queryFn: () => service.getAdminOrphanedFiles(),
    retry: false
  })

  const { data: syncSchedulerStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ['admin', 'sync', 'scheduler', 'status'],
    queryFn: () => service.getSyncSchedulerStatus(),
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false
  })

  const { data: syncProgress } = useQuery({
    queryKey: ['admin', 'sync', 'progress'],
    queryFn: () => service.getSyncProgress(),
    refetchInterval: (query) => query.state.data?.is_syncing ? 1000 : 5000, // Poll faster during sync
    retry: false
  })

  const clearCacheMutation = useMutation({
    mutationFn: () => service.clearAdminCache(),
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
    mutationFn: () => service.startSync(),
    onSuccess: () => {
      toast.success(isRTL ? 'הסנכרון החל' : 'Sync started')
      refetch()
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בהתחלת סנכרון' : `Error starting sync: ${error.response?.data?.detail || error.message}`)
    }
  })

  const gcsSyncMutation = useMutation({
    mutationFn: () => service.triggerGcsSync(),
    onSuccess: () => {
      toast.success(isRTL ? 'סנכרון GCS החל' : 'GCS sync started')
      refetchSyncStatus()
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בסנכרון GCS' : `Error starting GCS sync: ${error.response?.data?.detail || error.message}`)
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
    const axiosError = error as any
    const status = axiosError?.response?.status
    const detail = axiosError?.response?.data?.detail || axiosError?.message || 'Unknown error'
    const isAuthError = status === 401 || status === 403

    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-amber-400" size={48} />
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {isAuthError
              ? (isRTL ? 'נדרשת הרשאת מנהל' : 'Admin Authorization Required')
              : (isRTL ? 'שגיאה בטעינת נתונים' : 'Error Loading Data')
            }
          </h3>
          <p className="text-sm text-dark-400">
            {isAuthError
              ? (isRTL ? 'עליך להתחבר עם חשבון מנהל כדי לצפות בדף זה' : 'Please sign in with an admin account to view this page')
              : detail
            }
          </p>
          {!isAuthError && status && (
            <p className="text-xs text-dark-500 mt-2">Status: {status}</p>
          )}
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

      {/* GCS Sync Status */}
      {syncSchedulerStatus && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-dark-100">
              {isRTL ? 'סנכרון לאחסון ענן (GCS)' : 'Cloud Storage Sync (GCS)'}
            </h3>
            <div className="flex items-center gap-2">
              {syncProgress?.is_syncing ? (
                <span className="flex items-center gap-1 text-xs text-sky-400">
                  <Loader2 size={12} className="animate-spin" />
                  {isRTL ? 'מסנכרן...' : 'Syncing...'}
                </span>
              ) : syncSchedulerStatus.running ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  {isRTL ? 'פעיל' : 'Active'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                  {isRTL ? 'מושבת' : 'Disabled'}
                </span>
              )}
            </div>
          </div>

          {/* GCS Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-dark-700/50 rounded-lg p-3">
              <div className="text-xs text-dark-400 mb-1">{isRTL ? 'סה"כ תוכן' : 'Total Content'}</div>
              <div className="text-lg font-semibold text-dark-100">
                {syncSchedulerStatus.gcs_stats?.total_content || 0}
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <div className="text-xs text-dark-400 mb-1">{isRTL ? 'מסונכרן ל-GCS' : 'Synced to GCS'}</div>
              <div className="text-lg font-semibold text-emerald-400">
                {syncSchedulerStatus.gcs_stats?.with_gcs_path || 0}
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <div className="text-xs text-dark-400 mb-1">{isRTL ? 'ממתין להעלאה' : 'Pending Upload'}</div>
              <div className="text-lg font-semibold text-amber-400">
                {syncSchedulerStatus.gcs_stats?.pending_upload || 0}
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg p-3">
              <div className="text-xs text-dark-400 mb-1">{isRTL ? 'אחוז סינכרון' : 'Sync %'}</div>
              <div className="text-lg font-semibold text-dark-100">
                {syncSchedulerStatus.gcs_stats?.percent_synced || 0}%
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mb-4">
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${syncSchedulerStatus.gcs_stats?.percent_synced || 0}%` }}
              />
            </div>
          </div>

          {/* Active Sync Progress */}
          {syncProgress?.is_syncing && (
            <div className="mb-4 p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-sky-400" />
                  <span className="text-sm font-medium text-sky-400">{syncProgress.phase}</span>
                </div>
                <span className="text-sm text-dark-300">
                  {syncProgress.processed_files}/{syncProgress.total_files} ({syncProgress.percent_complete}%)
                </span>
              </div>
              {/* Current file progress bar */}
              <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${syncProgress.percent_complete}%` }}
                />
              </div>
              {syncProgress.current_file && (
                <div className="text-xs text-dark-400 truncate">
                  {isRTL ? 'קובץ נוכחי:' : 'Current:'} {syncProgress.current_file}
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-dark-400">
                <span className="text-emerald-400">{syncProgress.uploaded_to_gcs} {isRTL ? 'הועלו' : 'uploaded'}</span>
                {syncProgress.errors > 0 && (
                  <span className="text-red-400">{syncProgress.errors} {isRTL ? 'שגיאות' : 'errors'}</span>
                )}
                <span>{syncProgress.elapsed_seconds}s</span>
              </div>
            </div>
          )}

          {/* Last Sync Info */}
          <div className="flex items-center justify-between text-sm text-dark-400 mb-4">
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>
                {isRTL ? 'סנכרון אחרון:' : 'Last sync:'}{' '}
                {formatTimeAgo(syncSchedulerStatus.last_sync_time)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{isRTL ? 'מרווח:' : 'Interval:'} {Math.round(syncSchedulerStatus.sync_interval_seconds / 60)}m</span>
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={() => gcsSyncMutation.mutate(undefined)}
            disabled={gcsSyncMutation.isPending || syncProgress?.is_syncing}
            className="w-full glass-button flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 disabled:opacity-50"
          >
            {syncProgress?.is_syncing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} className={gcsSyncMutation.isPending ? 'animate-pulse' : ''} />
            )}
            {syncProgress?.is_syncing
              ? (isRTL ? 'סנכרון בתהליך...' : 'Sync in progress...')
              : gcsSyncMutation.isPending
                ? (isRTL ? 'מתחיל סנכרון...' : 'Starting sync...')
                : (isRTL ? 'סנכרון ידני ל-GCS' : 'Manual Sync to GCS')
            }
          </button>

          {/* Rolling Sync Log */}
          {syncProgress?.log && syncProgress.log.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-dark-300">
                  {isRTL ? 'לוג סנכרון' : 'Sync Log'}
                </h4>
                <span className="text-xs text-dark-500">
                  {syncProgress.log.length} {isRTL ? 'רשומות' : 'entries'}
                </span>
              </div>
              <div className="bg-dark-900/50 rounded-lg border border-dark-600 max-h-48 overflow-y-auto">
                <div className="divide-y divide-dark-700/50">
                  {[...syncProgress.log].reverse().map((entry: SyncLogEntry, idx: number) => {
                    const style = logLevelStyles[entry.level] || logLevelStyles['INFO']
                    return (
                      <div key={idx} className={`flex items-start gap-2 px-3 py-1.5 text-xs ${style.bg}`}>
                        <span className="text-dark-500 font-mono shrink-0">
                          {formatLogTime(entry.time)}
                        </span>
                        <span className={`font-medium shrink-0 w-12 ${style.color}`}>
                          {entry.level}
                        </span>
                        <span className="text-dark-300 truncate">
                          {entry.message}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Last Sync Result (when not syncing and no log) */}
          {!syncProgress?.is_syncing && (!syncProgress?.log || syncProgress.log.length === 0) && syncSchedulerStatus.last_sync_result && (
            <div className="mt-4 p-3 bg-dark-700/50 rounded-lg">
              <div className="text-xs text-dark-400 mb-2">{isRTL ? 'תוצאת סנכרון אחרון:' : 'Last sync result:'}</div>
              {syncSchedulerStatus.last_sync_result.error ? (
                <div className="text-sm text-red-400">{syncSchedulerStatus.last_sync_result.error}</div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle size={14} />
                  <span>
                    {syncSchedulerStatus.last_sync_result.files_found || syncSchedulerStatus.last_sync_result.total_synced || 0} {isRTL ? 'קבצים נמצאו' : 'files found'}
                    {(syncSchedulerStatus.last_sync_result.files_uploaded_gcs || syncSchedulerStatus.last_sync_result.gcs_uploaded) > 0 && (
                      <>, {syncSchedulerStatus.last_sync_result.files_uploaded_gcs || syncSchedulerStatus.last_sync_result.gcs_uploaded} {isRTL ? 'הועלו ל-GCS' : 'uploaded to GCS'}</>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Content by Type Breakdown */}
          {syncSchedulerStatus.by_type && Object.keys(syncSchedulerStatus.by_type).length > 0 && (
            <div className="mt-4 p-3 bg-dark-700/50 rounded-lg">
              <div className="text-xs text-dark-400 mb-2">{isRTL ? 'לפי סוג תוכן:' : 'By content type:'}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(syncSchedulerStatus.by_type).map(([type, stats]: [string, any]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="text-dark-300 capitalize">{type}</span>
                    <span className="text-dark-400">
                      <span className="text-emerald-400">{stats.with_gcs}</span>
                      <span className="text-dark-500">/{stats.total}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Actions */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-dark-100 mb-4">
          {isRTL ? 'סנכרון ותחזוקה' : 'Sync & Maintenance'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => syncMutation.mutate(undefined)}
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
                clearCacheMutation.mutate(undefined)
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

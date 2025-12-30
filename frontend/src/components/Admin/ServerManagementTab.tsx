import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Server, Activity, Cpu, HardDrive, RefreshCw, Power, Trash2, AlertTriangle } from 'lucide-react'
import api from '../../services/api'
import { toast } from '../../store/toastStore'

interface ServerManagementTabProps {
  isRTL: boolean
}

export default function ServerManagementTab({ isRTL }: ServerManagementTabProps) {
  const queryClient = useQueryClient()
  const [includeLogs, setIncludeLogs] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['server', 'health'],
    queryFn: api.getServerHealth,
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false
  })

  const clearCacheMutation = useMutation({
    mutationFn: () => api.clearCache(undefined, includeLogs),
    onSuccess: (data) => {
      const message = includeLogs && data.logs_deleted > 0
        ? isRTL
          ? `נוקו ${data.files_deleted} קבצי cache ו-${data.logs_deleted} קבצי לוג`
          : `Cleared ${data.files_deleted} cache files and ${data.logs_deleted} log files`
        : isRTL
        ? `נוקו ${data.files_deleted} קבצי cache`
        : `Cleared ${data.files_deleted} cache files`

      toast.success(message)
      refetch()
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בניקוי cache' : `Error: ${error.response?.data?.detail || error.message}`)
    }
  })

  const restartServerMutation = useMutation({
    mutationFn: api.restartServer,
    onSuccess: () => {
      toast.warning(isRTL ? 'השרת מתאתחל...' : 'Server restarting...')
      setShowRestartConfirm(false)

      // Poll for server availability
      setTimeout(() => {
        const checkHealth = setInterval(async () => {
          try {
            await api.getServerHealth()
            toast.success(isRTL ? 'השרת חזר לפעילות' : 'Server back online')
            clearInterval(checkHealth)
            queryClient.invalidateQueries()
          } catch (e) {
            // Still offline, keep polling
          }
        }, 3000)
      }, 10000) // Wait 10s before starting to poll
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה באתחול השרת' : `Error: ${error.response?.data?.detail || error.message}`)
      setShowRestartConfirm(false)
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500 bg-green-500/10 border-green-500/20'
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20'
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20'
    }
  }

  const formatUptime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`
    if (hours < 24) return `${hours.toFixed(1)} hours`
    return `${(hours / 24).toFixed(1)} days`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-accent-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">
            {isRTL ? 'ניהול שרת' : 'Server Management'}
          </h2>
          <p className="text-dark-300 mt-1">
            {isRTL ? 'ניטור וניהול שרת היישום' : 'Monitor and manage application server'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          title={isRTL ? 'רענן נתונים' : 'Refresh'}
        >
          <RefreshCw size={20} className="text-dark-300" />
        </button>
      </div>

      {/* Overall Status */}
      {health && (
        <div className={`p-6 rounded-2xl border backdrop-blur-xl ${getStatusColor(health.status)}`}>
          <div className="flex items-center gap-4">
            <Activity size={32} />
            <div>
              <div className="text-sm opacity-70">{isRTL ? 'סטטוס כללי' : 'Overall Status'}</div>
              <div className="text-2xl font-bold capitalize">{health.status}</div>
            </div>
            <div className={`ml-auto text-right ${isRTL ? 'ml-0 mr-auto text-left' : ''}`}>
              <div className="text-sm opacity-70">{isRTL ? 'זמן פעילות' : 'Uptime'}</div>
              <div className="text-xl font-semibold">{formatUptime(health.uptime.hours)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CPU */}
          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <Cpu size={24} className="text-accent-500" />
              <div className="text-lg font-semibold text-dark-100">{isRTL ? 'מעבד' : 'CPU'}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-300">{isRTL ? 'שימוש' : 'Usage'}</span>
                <span className={`font-semibold ${health.cpu.percent > 80 ? 'text-red-500' : 'text-dark-100'}`}>
                  {health.cpu.percent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${health.cpu.percent > 80 ? 'bg-red-500' : 'bg-accent-500'}`}
                  style={{ width: `${Math.min(health.cpu.percent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-dark-400">
                {health.cpu.count} {isRTL ? 'ליבות' : 'cores'}
              </div>
            </div>
          </div>

          {/* Memory */}
          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <Server size={24} className="text-accent-500" />
              <div className="text-lg font-semibold text-dark-100">{isRTL ? 'זיכרון' : 'Memory'}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-300">{isRTL ? 'שימוש' : 'Usage'}</span>
                <span className={`font-semibold ${health.memory.percent > 85 ? 'text-red-500' : 'text-dark-100'}`}>
                  {health.memory.percent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${health.memory.percent > 85 ? 'bg-red-500' : 'bg-accent-500'}`}
                  style={{ width: `${Math.min(health.memory.percent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-dark-400">
                {health.memory.used_gb.toFixed(1)} GB / {health.memory.total_gb.toFixed(1)} GB
              </div>
            </div>
          </div>

          {/* Disk */}
          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive size={24} className="text-accent-500" />
              <div className="text-lg font-semibold text-dark-100">{isRTL ? 'דיסק' : 'Disk'}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-300">{isRTL ? 'שימוש' : 'Usage'}</span>
                <span className={`font-semibold ${health.disk.percent > 90 ? 'text-red-500' : 'text-dark-100'}`}>
                  {health.disk.percent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${health.disk.percent > 90 ? 'bg-red-500' : 'bg-accent-500'}`}
                  style={{ width: `${Math.min(health.disk.percent, 100)}%` }}
                />
              </div>
              <div className="text-xs text-dark-400">
                {health.disk.used_gb.toFixed(1)} GB / {health.disk.total_gb.toFixed(1)} GB
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clear Cache */}
        <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 size={24} className="text-accent-500" />
            <div>
              <div className="text-lg font-semibold text-dark-100">
                {isRTL ? 'ניקוי Cache' : 'Clear Cache'}
              </div>
              <div className="text-sm text-dark-400">
                {isRTL ? 'מחק קבצי cache וקבצי לוג ישנים' : 'Delete old cache and log files'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="includeLogs"
              checked={includeLogs}
              onChange={(e) => setIncludeLogs(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-accent-500 focus:ring-accent-500"
            />
            <label htmlFor="includeLogs" className="text-sm text-dark-300 cursor-pointer">
              {isRTL ? 'כלול קבצי לוג (*.log)' : 'Include log files (*.log)'}
            </label>
          </div>

          <button
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
            className="w-full btn btn-secondary"
          >
            {clearCacheMutation.isPending ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Trash2 size={18} />
            )}
            {isRTL ? 'נקה Cache' : 'Clear Cache'}
          </button>
        </div>

        {/* Server Restart */}
        <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <Power size={24} className="text-red-500" />
            <div>
              <div className="text-lg font-semibold text-dark-100">
                {isRTL ? 'אתחול שרת' : 'Server Restart'}
              </div>
              <div className="text-sm text-dark-400">
                {isRTL ? 'אתחל את שרת היישום' : 'Restart application server'}
              </div>
            </div>
          </div>

          {showRestartConfirm ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-dark-200">
                  {isRTL ? 'פעולה זו תנתק את כל החיבורים הפעילים. להמשיך?' : 'This will disconnect all active connections. Continue?'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => restartServerMutation.mutate()}
                  disabled={restartServerMutation.isPending}
                  className="flex-1 btn bg-red-500 hover:bg-red-600 text-white border-0"
                >
                  {isRTL ? 'כן, אתחל' : 'Yes, Restart'}
                </button>
                <button
                  onClick={() => setShowRestartConfirm(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowRestartConfirm(true)}
              className="w-full btn bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20"
            >
              <Power size={18} />
              {isRTL ? 'אתחל שרת' : 'Restart Server'}
            </button>
          )}
        </div>
      </div>

      {/* System Info */}
      {health?.system && (
        <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700 backdrop-blur-xl">
          <div className="text-lg font-semibold text-dark-100 mb-4">
            {isRTL ? 'מידע על המערכת' : 'System Information'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-dark-400">{isRTL ? 'פלטפורמה' : 'Platform'}</div>
              <div className="text-dark-100 font-medium">{health.system.platform}</div>
            </div>
            <div>
              <div className="text-dark-400">{isRTL ? 'ארכיטקטורה' : 'Architecture'}</div>
              <div className="text-dark-100 font-medium">{health.system.architecture}</div>
            </div>
            <div>
              <div className="text-dark-400">{isRTL ? 'Python' : 'Python'}</div>
              <div className="text-dark-100 font-medium">{health.system.python_version}</div>
            </div>
            <div>
              <div className="text-dark-400">{isRTL ? 'שם מארח' : 'Hostname'}</div>
              <div className="text-dark-100 font-medium">{health.system.hostname}</div>
            </div>
            <div className="col-span-2">
              <div className="text-dark-400">{isRTL ? 'גרסת מערכת' : 'System Version'}</div>
              <div className="text-dark-100 font-medium text-xs">{health.system.platform_version}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

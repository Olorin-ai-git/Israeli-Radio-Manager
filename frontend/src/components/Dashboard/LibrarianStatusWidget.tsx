import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Library, CheckCircle2, AlertCircle, Activity, ChevronRight, ChevronLeft, Clock } from 'lucide-react'
import axios from 'axios'
import { getIdToken } from '../../lib/firebase'

// API Base URL
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API_BASE_URL = isLocalDev
  ? '/api'
  : 'https://israeli-radio-manager-534446777606.us-east1.run.app/api'

interface LibrarianStatus {
  last_audit_date: string | null
  last_audit_status: string | null
  total_audits_last_30_days: number
  avg_execution_time: number
  total_issues_fixed: number
  system_health: string
}

interface AuditReport {
  _id: string
  audit_id: string
  audit_type: string
  audit_date: string
  status: string
  issues_count: number
  fixes_count: number
  execution_time: number
}

export default function LibrarianStatusWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const navigate = useNavigate()

  const { data: librarianStatus } = useQuery<LibrarianStatus>({
    queryKey: ['librarianStatus'],
    queryFn: async () => {
      const token = await getIdToken()
      const response = await axios.get(`${API_BASE_URL}/admin/librarian/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      return response.data
    },
    refetchInterval: 60000, // Refresh every minute
  })

  const { data: recentReports = [] } = useQuery<AuditReport[]>({
    queryKey: ['librarianReports'],
    queryFn: async () => {
      const token = await getIdToken()
      const response = await axios.get(`${API_BASE_URL}/admin/librarian/reports?limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      return response.data
    },
    refetchInterval: 60000,
  })

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', label: isRTL ? 'מצוין' : 'Excellent' }
      case 'good':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400', label: isRTL ? 'טוב' : 'Good' }
      case 'fair':
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400', label: isRTL ? 'בינוני' : 'Fair' }
      case 'poor':
        return { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400', label: isRTL ? 'חלש' : 'Poor' }
      default:
        return { bg: 'bg-dark-600/50', text: 'text-dark-400', dot: 'bg-dark-500', label: isRTL ? 'לא ידוע' : 'Unknown' }
    }
  }

  const getAuditTypeLabel = (type: string) => {
    const types: Record<string, { en: string; he: string }> = {
      'daily_incremental': { en: 'Daily', he: 'יומי' },
      'weekly_full': { en: 'Weekly', he: 'שבועי' },
      'manual': { en: 'Manual', he: 'ידני' },
      'ai_agent': { en: 'AI Agent', he: 'AI סוכן' },
    }
    return isRTL ? types[type]?.he || type : types[type]?.en || type
  }

  const getAuditIcon = (type: string) => {
    switch (type) {
      case 'daily_incremental':
        return '📅'
      case 'weekly_full':
        return '📊'
      case 'manual':
        return '👤'
      case 'ai_agent':
        return '🤖'
      default:
        return '📋'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={12} className="text-emerald-400" />
      case 'failed':
        return <AlertCircle size={12} className="text-red-400" />
      default:
        return <Activity size={12} className="text-blue-400" />
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return isRTL ? 'עכשיו' : 'just now'
    if (diffMins < 60) return isRTL ? `לפני ${diffMins} דק'` : `${diffMins}m ago`
    if (diffHours < 24) return isRTL ? `לפני ${diffHours} שע'` : `${diffHours}h ago`
    if (diffDays < 7) return isRTL ? `לפני ${diffDays} ימים` : `${diffDays}d ago`
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
  }

  const formatExecutionTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    return `${Math.round(seconds / 60)}m`
  }

  const healthColors = getHealthColor(librarianStatus?.system_health || 'unknown')

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <Library size={16} className="text-purple-400" />
          {isRTL ? 'סוכן ספרן AI' : 'Librarian AI Agent'}
        </h3>
        <button
          onClick={() => navigate('/admin')}
          className="text-[10px] text-dark-400 hover:text-purple-400 transition-colors flex items-center gap-0.5"
        >
          {isRTL ? 'ניהול' : 'Manage'}
          <ChevronIcon size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Left: Status & Stats */}
        <div className="space-y-3">
          {/* System Health */}
          <div className={`p-3 rounded-xl border ${healthColors.bg} border-white/10`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${healthColors.dot} animate-pulse`}></span>
                <span className={`text-sm font-medium ${healthColors.text}`}>
                  {healthColors.label}
                </span>
              </div>
              <Activity size={14} className={healthColors.text} />
            </div>
            <p className="text-[10px] text-dark-400 mt-1">
              {isRTL ? 'בריאות המערכת' : 'System Health'}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-1 text-dark-400">
                <Activity size={12} />
                <span className="text-[10px]">{isRTL ? 'ביקורות (30 יום)' : 'Audits (30d)'}</span>
              </div>
              <p className="text-lg font-bold text-dark-100 mt-0.5">
                {librarianStatus?.total_audits_last_30_days || 0}
              </p>
            </div>

            <div className="p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-1 text-dark-400">
                <CheckCircle2 size={12} />
                <span className="text-[10px]">{isRTL ? 'תוקנו' : 'Fixed'}</span>
              </div>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">
                {librarianStatus?.total_issues_fixed || 0}
              </p>
            </div>
          </div>

          {/* Last Audit Info */}
          {librarianStatus?.last_audit_date && (
            <div className="p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-1 text-dark-400 mb-1">
                <Clock size={12} />
                <span className="text-[10px]">{isRTL ? 'ביקורת אחרונה' : 'Last Audit'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-200">
                  {formatTimeAgo(librarianStatus.last_audit_date)}
                </span>
                <span className="text-[9px] text-dark-400">
                  {librarianStatus.avg_execution_time > 0 && `~${formatExecutionTime(librarianStatus.avg_execution_time)}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent Audits */}
        <div>
          <h4 className="text-xs font-medium text-dark-300 mb-2 flex items-center gap-1">
            <Activity size={12} />
            {isRTL ? 'ביקורות אחרונות' : 'Recent Audits'}
          </h4>

          {recentReports.length > 0 ? (
            <div className="space-y-1">
              {recentReports.slice(0, 4).map((report) => (
                <div
                  key={report._id}
                  className="flex items-center gap-2 p-1.5 bg-dark-700/30 rounded-lg hover:bg-dark-700/50 transition-colors cursor-pointer"
                  onClick={() => navigate('/admin')}
                >
                  <span className="text-sm flex-shrink-0">{getAuditIcon(report.audit_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(report.status)}
                      <span className="text-[10px] text-dark-200">
                        {getAuditTypeLabel(report.audit_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-emerald-400">
                        {report.fixes_count > 0 && `✓ ${report.fixes_count}`}
                      </span>
                      {report.issues_count > report.fixes_count && (
                        <span className="text-[9px] text-amber-400">
                          ⚠ {report.issues_count - report.fixes_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] text-dark-500 flex-shrink-0">
                    {formatTimeAgo(report.audit_date)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-dark-500">
              <Library size={24} className="mb-1 opacity-40" />
              <p className="text-xs">{isRTL ? 'אין ביקורות אחרונות' : 'No recent audits'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bot, Zap, Clock, Activity, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import { api } from '../../services/api'

interface AgentStatus {
  active: boolean
  mode: 'full_automation' | 'prompt'
  pending_actions: number
  decisions_today?: number
}

interface Decision {
  _id: string
  action_type: string
  reasoning: string
  result: string
  created_at: string
}

export default function AgentStatusWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const navigate = useNavigate()

  const { data: agentStatus } = useQuery<AgentStatus>({
    queryKey: ['agentStatus'],
    queryFn: api.getAgentStatus,
    refetchInterval: 10000,
  })

  const { data: recentDecisions = [] } = useQuery<Decision[]>({
    queryKey: ['agentDecisions'],
    queryFn: () => api.getDecisions(5),
    refetchInterval: 30000,
  })

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  const getModeLabel = () => {
    if (!agentStatus?.active) return isRTL ? 'כבוי' : 'Inactive'
    return agentStatus?.mode === 'full_automation'
      ? (isRTL ? 'אוטומטי מלא' : 'Full Automation')
      : (isRTL ? 'מצב אישור' : 'Prompt Mode')
  }

  const getStatusColor = () => {
    if (!agentStatus?.active) return { bg: 'bg-dark-600/50', text: 'text-dark-400', dot: 'bg-dark-500' }
    return agentStatus?.mode === 'full_automation'
      ? { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' }
      : { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' }
  }

  const colors = getStatusColor()

  const getDecisionIcon = (actionType: string) => {
    switch (actionType) {
      case 'play_song':
      case 'select_song':
        return '🎵'
      case 'run_flow':
        return '▶️'
      case 'schedule':
        return '📅'
      case 'commercial':
        return '📢'
      default:
        return '🤖'
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffMins < 1) return isRTL ? 'עכשיו' : 'just now'
    if (diffMins < 60) return isRTL ? `לפני ${diffMins} דק'` : `${diffMins}m ago`
    if (diffHours < 24) return isRTL ? `לפני ${diffHours} שע'` : `${diffHours}h ago`
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <Bot size={16} className="text-primary-400" />
          {isRTL ? 'סוכן AI' : 'AI Agent'}
        </h3>
        <button
          onClick={() => navigate('/agent')}
          className="text-[10px] text-dark-400 hover:text-primary-400 transition-colors flex items-center gap-0.5"
        >
          {isRTL ? 'ניהול' : 'Manage'}
          <ChevronIcon size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Left: Status */}
        <div className="space-y-3">
          {/* Mode & Status */}
          <div className={`p-3 rounded-xl border ${colors.bg} border-white/10`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors.dot} ${agentStatus?.active ? 'animate-pulse' : ''}`}></span>
                <span className={`text-sm font-medium ${colors.text}`}>
                  {getModeLabel()}
                </span>
              </div>
              <Zap size={14} className={colors.text} />
            </div>
            <p className="text-[10px] text-dark-400 mt-1">
              {agentStatus?.mode === 'full_automation'
                ? (isRTL ? 'מבצע פעולות אוטומטית' : 'Executing actions automatically')
                : (isRTL ? 'ממתין לאישור פעולות' : 'Awaiting action approval')}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-1 text-dark-400">
                <Activity size={12} />
                <span className="text-[10px]">{isRTL ? 'היום' : 'Today'}</span>
              </div>
              <p className="text-lg font-bold text-dark-100 mt-0.5">
                {recentDecisions.filter(d => {
                  const today = new Date()
                  const decisionDate = new Date(d.created_at)
                  return decisionDate.toDateString() === today.toDateString()
                }).length}
              </p>
            </div>

            <div className="p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
              <div className="flex items-center gap-1 text-dark-400">
                <Clock size={12} />
                <span className="text-[10px]">{isRTL ? 'ממתינות' : 'Pending'}</span>
              </div>
              <p className={`text-lg font-bold mt-0.5 ${(agentStatus?.pending_actions || 0) > 0 ? 'text-amber-400' : 'text-dark-100'}`}>
                {agentStatus?.pending_actions || 0}
              </p>
            </div>
          </div>

          {/* Pending Alert */}
          {(agentStatus?.pending_actions || 0) > 0 && (
            <button
              onClick={() => navigate('/agent')}
              className="w-full p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 hover:bg-amber-500/20 transition-colors"
            >
              <AlertCircle size={14} className="text-amber-400" />
              <span className="text-xs text-amber-400 flex-1 text-start">
                {agentStatus?.pending_actions} {isRTL ? 'פעולות ממתינות לאישור' : 'actions awaiting approval'}
              </span>
              <ChevronIcon size={12} className="text-amber-400" />
            </button>
          )}
        </div>

        {/* Right: Recent Decisions */}
        <div>
          <h4 className="text-xs font-medium text-dark-300 mb-2 flex items-center gap-1">
            <Activity size={12} />
            {isRTL ? 'החלטות אחרונות' : 'Recent Decisions'}
          </h4>

          {recentDecisions.length > 0 ? (
            <div className="space-y-1">
              {recentDecisions.slice(0, 4).map((decision) => (
                <div
                  key={decision._id}
                  className="flex items-center gap-2 p-1.5 bg-dark-700/30 rounded-lg"
                >
                  <span className="text-sm flex-shrink-0">{getDecisionIcon(decision.action_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-dark-200 truncate" dir="auto">
                      {decision.reasoning?.slice(0, 50) || decision.action_type}
                    </p>
                  </div>
                  <span className="text-[9px] text-dark-500 flex-shrink-0">
                    {formatTimeAgo(decision.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-dark-500">
              <Bot size={24} className="mb-1 opacity-40" />
              <p className="text-xs">{isRTL ? 'אין החלטות אחרונות' : 'No recent decisions'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

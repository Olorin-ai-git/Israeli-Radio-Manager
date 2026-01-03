import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Zap, Hand, Check, X, Clock, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import { useDemoMode } from '../hooks/useDemoMode'
import { toast } from '../store/toastStore'

export default function AgentControl() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const queryClient = useQueryClient()
  const { isViewer, isDemoHost } = useDemoMode()
  const isInDemoMode = isViewer && isDemoHost

  const { data: config } = useQuery({
    queryKey: ['agentConfig'],
    queryFn: api.getAgentConfig,
  })

  const { data: status } = useQuery({
    queryKey: ['agentStatus'],
    queryFn: api.getAgentStatus,
    refetchInterval: 5000,
  })

  const { data: pendingActions } = useQuery({
    queryKey: ['pendingActions'],
    queryFn: api.getPendingActions,
    refetchInterval: 10000,
  })

  const { data: decisions } = useQuery({
    queryKey: ['agentDecisions'],
    queryFn: () => api.getDecisions(20),
  })

  const setModeMutation = useMutation({
    mutationFn: (mode: 'full_automation' | 'prompt') => api.setAgentMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] })
      queryClient.invalidateQueries({ queryKey: ['agentStatus'] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingActions'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingActions'] })
    },
  })

  const currentMode = config?.mode || 'prompt'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('agent.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mode Selection */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('agent.mode')}</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Full Automation Mode */}
            <button
              onClick={() => {
                if (isInDemoMode) {
                  toast.info(isRTL ? 'מצב הדגמה - שינויים בסוכן לא נשמרים' : 'Demo mode - agent changes are not saved')
                  return
                }
                setModeMutation.mutate('full_automation')
              }}
              disabled={isInDemoMode}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                currentMode === 'full_automation'
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/10 hover:border-white/20 bg-dark-700/30'
              } ${isInDemoMode ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  currentMode === 'full_automation' ? 'bg-primary-500/30 text-primary-400 border border-primary-500/30' : 'bg-dark-600/50 text-dark-400 border border-white/10'
                }`}>
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">{t('agent.fullAuto')}</h3>
                  {currentMode === 'full_automation' && (
                    <span className="text-xs text-primary-400 font-medium">Active</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-dark-400">
                AI makes all decisions automatically without human intervention. 24/7 autonomous operation.
              </p>
            </button>

            {/* Prompt Mode */}
            <button
              onClick={() => {
                if (isInDemoMode) {
                  toast.info(isRTL ? 'מצב הדגמה - שינויים בסוכן לא נשמרים' : 'Demo mode - agent changes are not saved')
                  return
                }
                setModeMutation.mutate('prompt')
              }}
              disabled={isInDemoMode}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                currentMode === 'prompt'
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/10 hover:border-white/20 bg-dark-700/30'
              } ${isInDemoMode ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  currentMode === 'prompt' ? 'bg-primary-500/30 text-primary-400 border border-primary-500/30' : 'bg-dark-600/50 text-dark-400 border border-white/10'
                }`}>
                  <Hand size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">{t('agent.promptMode')}</h3>
                  {currentMode === 'prompt' && (
                    <span className="text-xs text-primary-400 font-medium">Active</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-dark-400">
                AI requests confirmation for certain actions. You control which decisions need approval.
              </p>
            </button>
          </div>
        </div>

        {/* Status Card */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('agent.status')}</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <span className="text-dark-400">Status</span>
              <span className={`flex items-center gap-2 font-medium ${
                status?.active ? 'text-emerald-400' : 'text-dark-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${status?.active ? 'bg-emerald-500' : 'bg-dark-500'}`} />
                {status?.active ? t('agent.active') : t('agent.inactive')}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <span className="text-dark-400">Mode</span>
              <span className="font-medium text-dark-100">
                {status?.mode === 'full_automation' ? t('agent.fullAuto') : t('agent.promptMode')}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <span className="text-dark-400">Pending</span>
              <span className={`font-medium ${status?.pending_actions > 0 ? 'text-amber-400' : 'text-dark-100'}`}>
                {status?.pending_actions || 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-dark-700/30 rounded-xl border border-white/5">
              <span className="text-dark-400">Decisions Today</span>
              <span className="font-medium text-dark-100">{status?.decisions_today || 0}</span>
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark-100">{t('agent.pendingActions')}</h2>
            {Array.isArray(pendingActions) && pendingActions.length > 0 && (
              <span className="badge badge-warning">
                {pendingActions.length} pending
              </span>
            )}
          </div>

          {Array.isArray(pendingActions) && pendingActions.length > 0 ? (
            <div className="divide-y divide-white/5">
              {pendingActions.map((action: any) => (
                <div key={action._id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={16} className="text-amber-400" />
                        <span className="font-medium text-dark-100">
                          {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </span>
                      </div>
                      <p className="text-sm text-dark-400 mb-2">{action.description}</p>
                      <p className="text-xs text-dark-500 flex items-center gap-1">
                        <Clock size={12} />
                        Expires: {new Date(action.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          if (isInDemoMode) {
                            toast.info(isRTL ? 'מצב הדגמה - שינויים בסוכן לא נשמרים' : 'Demo mode - agent changes are not saved')
                            return
                          }
                          approveMutation.mutate(action._id)
                        }}
                        disabled={approveMutation.isPending || isInDemoMode}
                        className={`flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-xl border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors ${isInDemoMode ? 'cursor-not-allowed' : ''}`}
                      >
                        <Check size={14} />
                        {t('agent.approve')}
                      </button>
                      <button
                        onClick={() => {
                          if (isInDemoMode) {
                            toast.info(isRTL ? 'מצב הדגמה - שינויים בסוכן לא נשמרים' : 'Demo mode - agent changes are not saved')
                            return
                          }
                          rejectMutation.mutate(action._id)
                        }}
                        disabled={rejectMutation.isPending || isInDemoMode}
                        className={`flex items-center gap-1 px-3 py-1.5 glass-button text-sm font-medium disabled:opacity-50 ${isInDemoMode ? 'cursor-not-allowed' : ''}`}
                      >
                        <X size={14} />
                        {t('agent.reject')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bot size={48} className="mx-auto mb-4 text-dark-600" />
              <p className="text-dark-400">{t('agent.noActions')}</p>
            </div>
          )}
        </div>

        {/* Decision Log */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-dark-100">{t('agent.decisionLog')}</h2>
          </div>

          {Array.isArray(decisions) && decisions.length > 0 ? (
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {decisions.map((decision: any) => (
                <div key={decision._id} className="p-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-dark-500">
                      {new Date(decision.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-dark-200">{decision.action_type}</p>
                  <p className="text-xs text-dark-500 truncate">{decision.reasoning}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-dark-500 text-sm">No decisions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

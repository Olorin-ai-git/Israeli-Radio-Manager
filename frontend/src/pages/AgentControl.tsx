import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Zap, Hand, Check, X, Clock, AlertCircle } from 'lucide-react'
import { api } from '../services/api'

export default function AgentControl() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('agent.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mode Selection */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('agent.mode')}</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Full Automation Mode */}
            <button
              onClick={() => setModeMutation.mutate('full_automation')}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                currentMode === 'full_automation'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentMode === 'full_automation' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t('agent.fullAuto')}</h3>
                  {currentMode === 'full_automation' && (
                    <span className="text-xs text-primary-600 font-medium">Active</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                AI makes all decisions automatically without human intervention. 24/7 autonomous operation.
              </p>
            </button>

            {/* Prompt Mode */}
            <button
              onClick={() => setModeMutation.mutate('prompt')}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                currentMode === 'prompt'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentMode === 'prompt' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Hand size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t('agent.promptMode')}</h3>
                  {currentMode === 'prompt' && (
                    <span className="text-xs text-primary-600 font-medium">Active</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                AI requests confirmation for certain actions. You control which decisions need approval.
              </p>
            </button>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('agent.status')}</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`flex items-center gap-2 font-medium ${
                status?.active ? 'text-green-600' : 'text-gray-500'
              }`}>
                <span className={`w-2 h-2 rounded-full ${status?.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                {status?.active ? t('agent.active') : t('agent.inactive')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Mode</span>
              <span className="font-medium text-gray-900">
                {status?.mode === 'full_automation' ? t('agent.fullAuto') : t('agent.promptMode')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Pending</span>
              <span className={`font-medium ${status?.pending_actions > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                {status?.pending_actions || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Decisions Today</span>
              <span className="font-medium text-gray-900">{status?.decisions_today || 0}</span>
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t('agent.pendingActions')}</h2>
            {pendingActions && pendingActions.length > 0 && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
                {pendingActions.length} pending
              </span>
            )}
          </div>

          {pendingActions && pendingActions.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {pendingActions.map((action: any) => (
                <div key={action._id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={16} className="text-yellow-500" />
                        <span className="font-medium text-gray-900">
                          {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={12} />
                        Expires: {new Date(action.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => approveMutation.mutate(action._id)}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
                      >
                        <Check size={14} />
                        {t('agent.approve')}
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(action._id)}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
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
              <Bot size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">{t('agent.noActions')}</p>
            </div>
          )}
        </div>

        {/* Decision Log */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('agent.decisionLog')}</h2>
          </div>

          {decisions && decisions.length > 0 ? (
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {decisions.map((decision: any) => (
                <div key={decision._id} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">
                      {new Date(decision.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">{decision.action_type}</p>
                  <p className="text-xs text-gray-500 truncate">{decision.reasoning}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No decisions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Settings as SettingsIcon, Bell, Cpu, Key, Eye, EyeOff, Trash2 } from 'lucide-react'
import { useService } from '../../services'
import { toast } from '../../store/toastStore'
import { Select } from '../Form'

interface AgentSettingsTabProps {
  isRTL: boolean
}

interface LLMModel {
  id: string
  name: string
  tier: string
}

interface LLMConfig {
  model: string
  has_custom_api_key: boolean
  has_env_api_key: boolean
  api_key_source: 'custom' | 'environment' | 'none'
  available_models: LLMModel[]
}

export default function AgentSettingsTab({ isRTL }: AgentSettingsTabProps) {
  const queryClient = useQueryClient()
  const service = useService()
  const [showApiKey, setShowApiKey] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')

  const { data: agentConfig, isLoading, error } = useQuery({
    queryKey: ['agent', 'config'],
    queryFn: () => service.getAgentConfig(),
    retry: false
  })

  const { data: llmConfig, isLoading: llmLoading } = useQuery<LLMConfig>({
    queryKey: ['agent', 'llm-config'],
    queryFn: () => service.getLLMConfig(),
    retry: false
  })

  const updateMutation = useMutation({
    mutationFn: (config: any) => service.updateAgentConfig(config),
    onSuccess: () => {
      toast.success(isRTL ? 'הגדרות AI עודכנו' : 'Agent settings updated')
      queryClient.invalidateQueries({ queryKey: ['agent', 'config'] })
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בעדכון הגדרות' : `Error: ${error.response?.data?.detail || error.message}`)
    }
  })

  const updateLLMMutation = useMutation({
    mutationFn: (config: { model?: string; api_key?: string }) => service.updateLLMConfig(config),
    onSuccess: () => {
      toast.success(isRTL ? 'הגדרות LLM עודכנו' : 'LLM settings updated')
      queryClient.invalidateQueries({ queryKey: ['agent', 'llm-config'] })
      setNewApiKey('')
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בעדכון הגדרות LLM' : `Error: ${error.response?.data?.detail || error.message}`)
    }
  })

  const clearApiKeyMutation = useMutation({
    mutationFn: () => service.clearCustomApiKey(),
    onSuccess: () => {
      toast.success(isRTL ? 'מפתח API מותאם נמחק' : 'Custom API key cleared')
      queryClient.invalidateQueries({ queryKey: ['agent', 'llm-config'] })
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה במחיקת מפתח' : `Error: ${error.response?.data?.detail || error.message}`)
    }
  })

  const handleModeChange = (mode: 'full_automation' | 'prompt') => {
    updateMutation.mutate({ ...agentConfig, mode })
  }

  const handleModelChange = (model: string) => {
    updateLLMMutation.mutate({ model })
  }

  const handleApiKeySubmit = () => {
    if (newApiKey.trim()) {
      updateLLMMutation.mutate({ api_key: newApiKey.trim() })
    }
  }

  const handleClearApiKey = () => {
    if (confirm(isRTL ? 'האם אתה בטוח שברצונך למחוק את המפתח המותאם?' : 'Are you sure you want to clear the custom API key?')) {
      clearApiKeyMutation.mutate()
    }
  }

  const handleAutomationRuleChange = (key: string, value: number) => {
    updateMutation.mutate({
      ...agentConfig,
      automation_rules: {
        ...agentConfig?.automation_rules,
        [key]: value
      }
    })
  }

  const handleNotificationLevelChange = (level: string) => {
    updateMutation.mutate({ ...agentConfig, notification_level: level })
  }

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
          <Bot className="mx-auto mb-4 text-amber-400" size={48} />
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {isAuthError
              ? (isRTL ? 'נדרשת הרשאת מנהל' : 'Admin Authorization Required')
              : (isRTL ? 'שגיאה בטעינת הגדרות' : 'Error Loading Settings')
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

  return (
    <div className="space-y-6">
      {/* Agent Mode */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={20} className="text-primary-400" />
          <h3 className="font-semibold text-dark-100">
            {isRTL ? 'מצב AI' : 'Agent Mode'}
          </h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-dark-700 cursor-pointer hover:bg-white/5">
            <input
              type="radio"
              name="mode"
              value="full_automation"
              checked={agentConfig?.mode === 'full_automation'}
              onChange={(e) => handleModeChange(e.target.value as 'full_automation')}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-dark-100">
                {isRTL ? 'אוטומציה מלאה' : 'Full Automation'}
              </div>
              <div className="text-sm text-dark-400">
                {isRTL ? 'ה-AI מקבל את כל ההחלטות באופן אוטומטי' : 'AI makes all decisions automatically'}
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-dark-700 cursor-pointer hover:bg-white/5">
            <input
              type="radio"
              name="mode"
              value="prompt"
              checked={agentConfig?.mode === 'prompt'}
              onChange={(e) => handleModeChange(e.target.value as 'prompt')}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-dark-100">
                {isRTL ? 'מצב בקשה' : 'Prompt Mode'}
              </div>
              <div className="text-sm text-dark-400">
                {isRTL ? 'ה-AI מבקש אישור לפעולות' : 'AI requests approval for actions'}
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* LLM Configuration */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={20} className="text-primary-400" />
          <h3 className="font-semibold text-dark-100">
            {isRTL ? 'הגדרות LLM' : 'LLM Configuration'}
          </h3>
        </div>

        {llmLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-400"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Model Selection */}
            <div>
              <Select
                label={isRTL ? 'מודל' : 'Model'}
                value={llmConfig?.model || ''}
                onChange={handleModelChange}
                disabled={updateLLMMutation.isPending}
                options={llmConfig?.available_models?.map((model) => ({
                  value: model.id,
                  label: model.name,
                  description: model.tier === 'premium' ? (isRTL ? 'פרימיום' : 'Premium') : (isRTL ? 'רגיל' : 'Standard')
                })) || []}
              />
            </div>

            {/* API Key Status */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                <div className="flex items-center gap-2">
                  <Key size={16} />
                  {isRTL ? 'מפתח API' : 'API Key'}
                </div>
              </label>

              {/* Current Status */}
              <div className="mb-3 p-3 rounded-lg bg-dark-800 border border-dark-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-dark-300">
                    {isRTL ? 'מקור:' : 'Source:'}
                  </span>
                  <span className={`text-sm font-medium ${
                    llmConfig?.api_key_source === 'custom' ? 'text-green-400' :
                    llmConfig?.api_key_source === 'environment' ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {llmConfig?.api_key_source === 'custom' ? (isRTL ? 'מותאם אישית' : 'Custom') :
                     llmConfig?.api_key_source === 'environment' ? (isRTL ? 'משתנה סביבה' : 'Environment Variable') :
                     (isRTL ? 'לא מוגדר' : 'Not Set')}
                  </span>
                </div>
                {llmConfig?.has_custom_api_key && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-dark-400">sk-ant-••••••••••••</span>
                    <button
                      onClick={handleClearApiKey}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                      title={isRTL ? 'מחק מפתח מותאם' : 'Clear custom key'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Set New API Key */}
              <div className="space-y-2">
                <label className="block text-xs text-dark-400">
                  {isRTL ? 'הגדר מפתח API חדש (אופציונלי):' : 'Set new API key (optional):'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full px-4 py-2 pr-10 rounded-lg bg-dark-800 border border-dark-700 text-dark-100 focus:border-primary-500 focus:outline-none font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={handleApiKeySubmit}
                    disabled={!newApiKey.trim() || updateLLMMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRTL ? 'שמור' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Automation Rules */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon size={20} className="text-primary-400" />
          <h3 className="font-semibold text-dark-100">
            {isRTL ? 'כללי אוטומציה' : 'Automation Rules'}
          </h3>
        </div>
        <div className="space-y-6">
          {/* Commercial Interval */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-dark-200">
                {isRTL ? 'מרווח פרסומות (דקות)' : 'Commercial Interval (minutes)'}
              </label>
              <span className="text-sm text-primary-400 font-semibold">
                {agentConfig?.automation_rules?.commercial_interval_minutes || 15} {isRTL ? 'דקות' : 'min'}
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={agentConfig?.automation_rules?.commercial_interval_minutes || 15}
              onChange={(e) => handleAutomationRuleChange('commercial_interval_minutes', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-dark-400 mt-1">
              <span>5</span>
              <span>60</span>
            </div>
          </div>

          {/* Max Song Repeat Hours */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-dark-200">
                {isRTL ? 'מקסימום שעות לשיר חוזר' : 'Max Song Repeat Hours'}
              </label>
              <span className="text-sm text-primary-400 font-semibold">
                {agentConfig?.automation_rules?.max_song_repeat_hours || 4} {isRTL ? 'שעות' : 'hrs'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={agentConfig?.automation_rules?.max_song_repeat_hours || 4}
              onChange={(e) => handleAutomationRuleChange('max_song_repeat_hours', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-dark-400 mt-1">
              <span>1</span>
              <span>24</span>
            </div>
          </div>

          {/* Auto-Categorize Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-dark-200">
                {isRTL ? 'סף קטגוריזציה אוטומטית' : 'Auto-Categorize Threshold'}
              </label>
              <span className="text-sm text-primary-400 font-semibold">
                {((agentConfig?.automation_rules?.auto_categorize_threshold || 0.8) * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={agentConfig?.automation_rules?.auto_categorize_threshold || 0.8}
              onChange={(e) => handleAutomationRuleChange('auto_categorize_threshold', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-dark-400 mt-1">
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Level */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={20} className="text-primary-400" />
          <h3 className="font-semibold text-dark-100">
            {isRTL ? 'רמת התראות' : 'Notification Level'}
          </h3>
        </div>
        <Select
          value={agentConfig?.notification_level || 'all'}
          onChange={handleNotificationLevelChange}
          options={[
            { value: 'all', label: isRTL ? 'כל ההתראות' : 'All Notifications', description: isRTL ? 'קבל את כל ההודעות' : 'Receive all messages' },
            { value: 'critical_only', label: isRTL ? 'קריטי בלבד' : 'Critical Only', description: isRTL ? 'רק התראות חשובות' : 'Only important alerts' },
            { value: 'summary_only', label: isRTL ? 'סיכום בלבד' : 'Summary Only', description: isRTL ? 'סיכום יומי בלבד' : 'Daily summary only' }
          ]}
        />
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Edit, Save, Database, Cloud, Bot, Bell, Settings } from 'lucide-react'
import api from '../../services/api'
import { toast } from '../../store/toastStore'

interface SystemConfigTabProps {
  isRTL: boolean
}

export default function SystemConfigTab({ isRTL }: SystemConfigTabProps) {
  const queryClient = useQueryClient()
  const [showSensitive, setShowSensitive] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [configData, setConfigData] = useState<Record<string, Record<string, string>>>({})

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: async () => {
      const data = await api.getAdminEnvConfig()
      setConfigData(data)
      return data
    },
    retry: false
  })

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      return await api.updateAdminEnvConfig(updates)
    },
    onSuccess: () => {
      toast.success(isRTL ? 'תצורה עודכנה בהצלחה' : 'Configuration updated successfully')
      setEditMode(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] })
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בעדכון התצורה' : `Error updating configuration: ${error.response?.data?.detail || error.message}`)
    }
  })

  const categories = [
    { id: 'database', label: isRTL ? 'מסד נתונים' : 'Database', icon: Database },
    { id: 'google', label: isRTL ? 'Google APIs' : 'Google APIs', icon: Cloud },
    { id: 'ai', label: isRTL ? 'שירותי AI' : 'AI Services', icon: Bot },
    { id: 'notifications', label: isRTL ? 'התראות' : 'Notifications', icon: Bell },
    { id: 'system', label: isRTL ? 'מערכת' : 'System', icon: Settings }
  ]

  const isSensitive = (key: string) => {
    return key.includes('***masked***') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')
  }

  const handleConfigChange = (category: string, key: string, value: string) => {
    setConfigData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const handleSave = () => {
    // Flatten the config data for the API
    const updates: Record<string, string> = {}
    Object.entries(configData).forEach(([category, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        if (value !== config?.[category]?.[key] && !isSensitive(key)) {
          updates[key] = value
        }
      })
    })

    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates)
    } else {
      toast.info(isRTL ? 'אין שינויים לשמירה' : 'No changes to save')
      setEditMode(false)
    }
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
          <Settings className="mx-auto mb-4 text-amber-400" size={48} />
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {isAuthError
              ? (isRTL ? 'נדרשת הרשאת מנהל' : 'Admin Authorization Required')
              : (isRTL ? 'שגיאה בטעינת התצורה' : 'Error Loading Configuration')
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
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'הגדרות מערכת' : 'System Configuration'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSensitive(!showSensitive)}
            className="glass-button flex items-center gap-2 px-4 py-2"
          >
            {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{showSensitive ? (isRTL ? 'הסתר רגיש' : 'Hide Sensitive') : (isRTL ? 'הצג רגיש' : 'Show Sensitive')}</span>
          </button>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="glass-button-primary flex items-center gap-2 px-4 py-2"
            >
              <Edit size={16} />
              {isRTL ? 'ערוך' : 'Edit'}
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setConfigData(config || {})
                  setEditMode(false)
                }}
                className="glass-button flex items-center gap-2 px-4 py-2"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="glass-button-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50"
              >
                <Save size={16} />
                {updateMutation.isPending ? (isRTL ? 'שומר...' : 'Saving...') : (isRTL ? 'שמור' : 'Save')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Config by Category */}
      {categories.map(category => {
        const CategoryIcon = category.icon
        const categoryData = configData[category.id] || config?.[category.id] || {}

        return (
          <div key={category.id} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <CategoryIcon size={20} className="text-primary-400" />
              <h3 className="font-medium text-dark-100">{category.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(categoryData).map(([key, value]) => {
                const isValueSensitive = isSensitive(key) || String(value).includes('***masked***')
                const displayValue = (!showSensitive && isValueSensitive) ? '***masked***' : value

                return (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-xs text-dark-400 font-medium">{key}</label>
                    <input
                      type="text"
                      value={displayValue || ''}
                      disabled={!editMode || isValueSensitive}
                      onChange={(e) => handleConfigChange(category.id, key, e.target.value)}
                      className={`px-3 py-2 rounded-lg border ${
                        !editMode || isValueSensitive
                          ? 'bg-dark-800/50 border-dark-700 text-dark-400 cursor-not-allowed'
                          : 'bg-dark-800 border-dark-700 text-dark-100 focus:border-primary-500 focus:outline-none'
                      }`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

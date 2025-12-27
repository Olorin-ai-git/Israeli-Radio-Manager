import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Pause,
  Trash2,
  Music,
  Megaphone,
  Clock,
  Loader2,
  X,
  Edit,
  MoreVertical,
  Calendar
} from 'lucide-react'
import { api } from '../../services/api'

interface FlowAction {
  action_type: string
  genre?: string
  content_id?: string
  commercial_count?: number
  duration_minutes?: number
  description?: string
}

interface Flow {
  _id: string
  name: string
  name_he?: string
  description?: string
  actions: FlowAction[]
  trigger_type: 'scheduled' | 'manual' | 'event'
  schedule?: {
    days_of_week: number[]
    start_time: string
    end_time?: string
  }
  status: 'active' | 'paused' | 'disabled' | 'running'
  priority: number
  loop: boolean
  last_run?: string
  run_count: number
}

interface FlowsPanelProps {
  collapsed: boolean
  onToggle: () => void
}

const ActionIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'play_genre':
      return <Music size={14} className="text-blue-400" />
    case 'play_commercials':
      return <Megaphone size={14} className="text-orange-400" />
    case 'wait':
      return <Clock size={14} className="text-gray-400" />
    default:
      return <Workflow size={14} className="text-primary-400" />
  }
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    disabled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[status as keyof typeof colors] || colors.disabled}`}>
      {status}
    </span>
  )
}

export default function FlowsPanel({ collapsed, onToggle }: FlowsPanelProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRTL = i18n.language === 'he'

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)

  // Fetch flows
  const { data: flows, isLoading } = useQuery<Flow[]>({
    queryKey: ['flows'],
    queryFn: () => api.getFlows(),
  })

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: (flowId: string) => api.toggleFlow(flowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const runMutation = useMutation({
    mutationFn: (flowId: string) => api.runFlow(flowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (flowId: string) => api.deleteFlow(flowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createFlow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      setShowCreateModal(false)
    },
  })

  const handleCreateFlow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = formData.get('name') as string
    const description = formData.get('description') as string

    // Parse actions from description (simple parsing)
    const actions: FlowAction[] = []

    // Simple parsing for demo - in production this would use the /parse-natural endpoint
    const parts = description.split(/,\s*(?:then|אז|ואז)\s*/i)
    for (const part of parts) {
      const lowerPart = part.toLowerCase()

      // Check for genre
      const genreMatch = lowerPart.match(/(?:play|נגן)\s+(\w+)\s+(?:music|מוזיקה)?/)
      if (genreMatch) {
        const durationMatch = lowerPart.match(/(?:for|במשך)\s+(\d+)/)
        actions.push({
          action_type: 'play_genre',
          genre: genreMatch[1],
          duration_minutes: durationMatch ? parseInt(durationMatch[1]) : 30,
          description: `Play ${genreMatch[1]} music`,
        })
        continue
      }

      // Check for commercials
      const commercialMatch = lowerPart.match(/(?:play|נגן)\s+(\d+)\s+(?:commercials?|פרסומות?)/)
      if (commercialMatch) {
        actions.push({
          action_type: 'play_commercials',
          commercial_count: parseInt(commercialMatch[1]),
          description: `Play ${commercialMatch[1]} commercial(s)`,
        })
      }
    }

    if (actions.length === 0) {
      // Default action if parsing fails
      actions.push({
        action_type: 'play_genre',
        genre: 'mixed',
        duration_minutes: 30,
        description: 'Play mixed music',
      })
    }

    createMutation.mutate({
      name,
      description,
      actions,
      trigger_type: 'manual',
      priority: 0,
      loop: false,
    })
  }

  if (collapsed) {
    return (
      <div className="relative h-full">
        <button
          onClick={onToggle}
          className="absolute top-4 -right-3 z-20 glass-button-primary p-2 rounded-full shadow-glow"
          title={isRTL ? 'הצג זרימות' : 'Show Flows'}
        >
          {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="w-12 h-full glass-sidebar flex flex-col items-center py-4 gap-4">
          <Workflow size={20} className="text-primary-400" />
          {flows?.slice(0, 5).map((flow) => (
            <button
              key={flow._id}
              onClick={() => {
                onToggle()
                setExpandedFlow(flow._id)
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                flow.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : flow.status === 'running'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-dark-700/50 text-dark-400'
              }`}
              title={flow.name}
            >
              <Workflow size={14} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 h-full glass-sidebar flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow size={20} className="text-primary-400" />
          <h2 className="font-semibold text-dark-100">
            {isRTL ? 'זרימות אוטומטיות' : 'Auto Flows'}
          </h2>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Add Flow Button */}
      <div className="p-3 border-b border-white/5">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full glass-button-primary flex items-center justify-center gap-2 py-2 text-sm"
        >
          <Plus size={16} />
          <span>{isRTL ? 'זרימה חדשה' : 'New Flow'}</span>
        </button>
      </div>

      {/* Flows List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        ) : flows && flows.length > 0 ? (
          flows.map((flow) => (
            <div
              key={flow._id}
              className={`glass-card p-3 transition-all ${
                expandedFlow === flow._id ? 'ring-1 ring-primary-500' : ''
              }`}
            >
              {/* Flow Header */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setExpandedFlow(expandedFlow === flow._id ? null : flow._id)}
                  className="flex-1 text-start"
                >
                  <h3 className="font-medium text-dark-100 text-sm truncate" dir="auto">
                    {isRTL ? flow.name_he || flow.name : flow.name}
                  </h3>
                </button>
                <StatusBadge status={flow.status} />
              </div>

              {/* Actions Preview */}
              <div className="flex items-center gap-1 mb-2">
                {flow.actions.slice(0, 4).map((action, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded bg-dark-700/50 flex items-center justify-center"
                    title={action.description || action.action_type}
                  >
                    <ActionIcon type={action.action_type} />
                  </div>
                ))}
                {flow.actions.length > 4 && (
                  <span className="text-xs text-dark-400">+{flow.actions.length - 4}</span>
                )}
              </div>

              {/* Schedule Info */}
              {flow.schedule && (
                <div className="flex items-center gap-1 text-xs text-dark-400 mb-2">
                  <Calendar size={12} />
                  <span>{flow.schedule.start_time}</span>
                  {flow.schedule.end_time && <span>- {flow.schedule.end_time}</span>}
                </div>
              )}

              {/* Expanded Details */}
              {expandedFlow === flow._id && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  {/* Actions List */}
                  <div className="space-y-1">
                    {flow.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-dark-300 p-1.5 bg-dark-800/50 rounded"
                      >
                        <ActionIcon type={action.action_type} />
                        <span>{action.description || action.action_type}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-dark-400">
                    <span>{isRTL ? 'הרצות' : 'Runs'}: {flow.run_count}</span>
                    {flow.last_run && (
                      <span>
                        {isRTL ? 'אחרון' : 'Last'}: {new Date(flow.last_run).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => runMutation.mutate(flow._id)}
                  disabled={runMutation.isPending || flow.status === 'running'}
                  className="flex-1 glass-button py-1.5 text-xs flex items-center justify-center gap-1"
                  title={isRTL ? 'הפעל' : 'Run'}
                >
                  {runMutation.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                </button>
                <button
                  onClick={() => toggleMutation.mutate(flow._id)}
                  className="flex-1 glass-button py-1.5 text-xs flex items-center justify-center gap-1"
                  title={flow.status === 'active' ? (isRTL ? 'השהה' : 'Pause') : (isRTL ? 'הפעל' : 'Enable')}
                >
                  {flow.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(flow._id)}
                  disabled={deleteMutation.isPending}
                  className="glass-button py-1.5 px-2 text-xs text-red-400 hover:bg-red-500/20"
                  title={isRTL ? 'מחק' : 'Delete'}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-dark-400">
            <Workflow size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{isRTL ? 'אין זרימות' : 'No flows yet'}</p>
            <p className="text-xs mt-1">
              {isRTL ? 'צור זרימה חדשה להתחיל' : 'Create a new flow to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Create Flow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'זרימה חדשה' : 'New Flow'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFlow} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'שם' : 'Name'}
                </label>
                <input
                  type="text"
                  name="name"
                  className="w-full glass-input"
                  placeholder={isRTL ? 'לדוגמה: תוכנית בוקר' : 'e.g., Morning Show'}
                  required
                />
              </div>

              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'תיאור הזרימה' : 'Flow Description'}
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full glass-input resize-none"
                  placeholder={
                    isRTL
                      ? 'תאר את הזרימה: נגן מוזיקה חסידית, אז נגן 2 פרסומות, אז נגן מזרחית'
                      : 'Describe the flow: play hasidi music, then play 2 commercials, then play mizrahi'
                  }
                  required
                />
                <p className="text-xs text-dark-500 mt-1">
                  {isRTL
                    ? 'השתמש ב"אז" או "then" להפרדה בין פעולות'
                    : 'Use "then" to separate actions'}
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>{isRTL ? 'צור' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
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
  Calendar,
  Sparkles,
  Eye,
  CheckCircle
} from 'lucide-react'
import { api } from '../../services/api'

// Genre mappings for parsing
const GENRE_MAP: Record<string, string> = {
  // Hebrew
  'חסידי': 'hasidi',
  'חסידית': 'hasidi',
  'מזרחי': 'mizrahi',
  'מזרחית': 'mizrahi',
  'פופ': 'pop',
  'רוק': 'rock',
  'ים תיכוני': 'mediterranean',
  'קלאסי': 'classic',
  'עברי': 'hebrew',
  'שמח': 'happy',
  'שמחה': 'happy',
  'ישראלי': 'israeli',
  'ישראלית': 'israeli',
  // English
  'hasidi': 'hasidi',
  'mizrahi': 'mizrahi',
  'pop': 'pop',
  'rock': 'rock',
  'happy': 'happy',
  'israeli': 'israeli',
  'mediterranean': 'mediterranean',
  'classic': 'classic',
  'mixed': 'mixed',
}

// Parse description into actions
function parseFlowDescription(description: string): FlowAction[] {
  const actions: FlowAction[] = []

  // Split by "then", "אז", "ואז"
  const parts = description.split(/,?\s*(?:then|אז|ואז)\s*/i)

  for (const part of parts) {
    const lowerPart = part.toLowerCase().trim()
    const hebrewPart = part.trim()

    // Check for genre playback (Hebrew patterns)
    // נגן מזרחי שמח / נגן מוזיקה חסידית / play happy music
    const hebrewGenreMatch = hebrewPart.match(/(?:נגן|השמע)\s+(?:מוזיקה\s+)?(\S+)(?:\s+(\S+))?(?:\s+(?:במשך|ל-?)\s*(\d+)\s*(?:דקות?)?)?/i)
    const englishGenreMatch = lowerPart.match(/(?:play)\s+(\w+)(?:\s+(\w+))?\s*(?:music)?(?:\s+(?:for)\s*(\d+)\s*(?:min(?:utes?)?)?)?/i)

    if (hebrewGenreMatch || englishGenreMatch) {
      const match = hebrewGenreMatch || englishGenreMatch
      const word1 = match![1]?.trim()
      const word2 = match![2]?.trim()
      const duration = match![3]

      // Try to find genre from word1 or word2
      let genre = GENRE_MAP[word1] || GENRE_MAP[word2 || ''] || 'mixed'

      // Combine adjective + noun if both recognized
      const genre1 = GENRE_MAP[word1]
      const genre2 = GENRE_MAP[word2 || '']
      if (genre1 && genre2) {
        genre = `${genre1}_${genre2}`
      } else if (genre1) {
        genre = genre1
      } else if (genre2) {
        genre = genre2
      }

      actions.push({
        action_type: 'play_genre',
        genre,
        duration_minutes: duration ? parseInt(duration) : 30,
        description: `Play ${genre} music`,
      })
      continue
    }

    // Check for commercials (Hebrew: שתי/2 פרסומות, English: 2 commercials)
    const hebrewCommMatch = hebrewPart.match(/(?:נגן\s+)?(?:(\d+)|שתי|שניים|שלוש|ארבע)\s*(?:פרסומות?|פרסומים?)/)
    const englishCommMatch = lowerPart.match(/(?:play\s+)?(\d+)\s*commercials?/)

    if (hebrewCommMatch || englishCommMatch) {
      const match = hebrewCommMatch || englishCommMatch
      let count = 1
      if (match![1]) {
        count = parseInt(match![1])
      } else if (hebrewPart.includes('שתי') || hebrewPart.includes('שניים')) {
        count = 2
      } else if (hebrewPart.includes('שלוש')) {
        count = 3
      } else if (hebrewPart.includes('ארבע')) {
        count = 4
      }

      actions.push({
        action_type: 'play_commercials',
        commercial_count: count,
        description: `Play ${count} commercial(s)`,
      })
      continue
    }

    // Check for wait/pause
    const waitMatch = lowerPart.match(/(?:wait|חכה|המתן)\s+(\d+)\s*(?:min(?:utes?)?|דקות?)/)
    if (waitMatch) {
      actions.push({
        action_type: 'wait',
        duration_minutes: parseInt(waitMatch[1]),
        description: `Wait ${waitMatch[1]} minutes`,
      })
    }
  }

  return actions
}

// Suggested built-in flows
const SUGGESTED_FLOWS = [
  {
    id: 'morning_happy',
    name: 'Happy Morning Show',
    name_he: 'תוכנית בוקר שמחה',
    description: 'Play happy israeli music, then 2 commercials, then mizrahi',
    description_he: 'נגן מוזיקה ישראלית שמחה, אז 2 פרסומות, אז מזרחי',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '08:00',
      end_time: '10:00',
      recurrence: 'weekly' as RecurrenceType,
      days_of_week: [0, 1, 2, 3, 4],  // Sun-Thu
    },
    actions: [
      { action_type: 'play_genre', genre: 'happy', duration_minutes: 45, description: 'Play happy music' },
      { action_type: 'play_commercials', commercial_count: 2, description: 'Play 2 commercials' },
      { action_type: 'play_genre', genre: 'mizrahi', duration_minutes: 30, description: 'Play mizrahi music' },
    ]
  },
  {
    id: 'friday_special',
    name: 'Friday Hasidi Special',
    name_he: 'מיוחד חסידי לשישי',
    description: 'Play hasidi music for Shabbat preparation',
    description_he: 'נגן מוזיקה חסידית לקראת שבת',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '14:00',
      end_time: '16:00',
      recurrence: 'weekly' as RecurrenceType,
      days_of_week: [5],  // Friday
    },
    actions: [
      { action_type: 'play_genre', genre: 'hasidi', duration_minutes: 120, description: 'Play hasidi music' },
    ]
  },
  {
    id: 'commercial_break',
    name: 'Commercial Break',
    name_he: 'הפסקת פרסומות',
    description: 'Play 3 commercials',
    description_he: 'נגן 3 פרסומות',
    trigger_type: 'manual',
    actions: [
      { action_type: 'play_commercials', commercial_count: 3, description: 'Play 3 commercials' },
    ]
  },
  {
    id: 'evening_mix',
    name: 'Evening Mix',
    name_he: 'מיקס ערב',
    description: 'Play mixed israeli music, then commercials, then mediterranean',
    description_he: 'נגן מיקס ישראלי, אז פרסומות, אז ים תיכוני',
    trigger_type: 'scheduled',
    schedule: {
      start_time: '18:00',
      end_time: '20:00',
      recurrence: 'daily' as RecurrenceType,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
    },
    actions: [
      { action_type: 'play_genre', genre: 'israeli', duration_minutes: 40, description: 'Play israeli music' },
      { action_type: 'play_commercials', commercial_count: 2, description: 'Play 2 commercials' },
      { action_type: 'play_genre', genre: 'mediterranean', duration_minutes: 40, description: 'Play mediterranean music' },
    ]
  },
]

interface FlowAction {
  action_type: string
  genre?: string
  content_id?: string
  commercial_count?: number
  duration_minutes?: number
  description?: string
}

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

interface FlowSchedule {
  start_time: string
  end_time?: string
  recurrence: RecurrenceType
  days_of_week: number[]
  day_of_month?: number
  month?: number
  start_date?: string
}

interface Flow {
  _id: string
  name: string
  name_he?: string
  description?: string
  actions: FlowAction[]
  trigger_type: 'scheduled' | 'manual' | 'event'
  schedule?: FlowSchedule
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
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)
  const [showSuggested, setShowSuggested] = useState(false)
  const [flowDescription, setFlowDescription] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('weekly')
  const [editRecurrenceType, setEditRecurrenceType] = useState<RecurrenceType>('weekly')

  // Real-time preview of parsed actions
  const previewActions = useMemo(() => {
    if (!flowDescription.trim()) return []
    return parseFlowDescription(flowDescription)
  }, [flowDescription])

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

  const updateMutation = useMutation({
    mutationFn: ({ flowId, data }: { flowId: string; data: any }) => api.updateFlow(flowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      setEditingFlow(null)
    },
  })

  const handleCreateFlow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const triggerType = formData.get('trigger_type') as string
    const startTime = formData.get('start_time') as string
    const endTime = formData.get('end_time') as string
    const startDate = formData.get('start_date') as string
    const dayOfMonth = formData.get('day_of_month') as string
    const month = formData.get('month') as string

    // Collect selected days (for weekly recurrence)
    const daysOfWeek: number[] = []
    for (let i = 0; i < 7; i++) {
      if (formData.get(`day_${i}`)) {
        daysOfWeek.push(i)
      }
    }

    // Use the pre-parsed preview actions
    const actions = previewActions.length > 0 ? previewActions : [{
      action_type: 'play_genre',
      genre: 'mixed',
      duration_minutes: 30,
      description: 'Play mixed music',
    }]

    // Build schedule object if scheduled
    const schedule = triggerType === 'scheduled' ? {
      start_time: startTime || '09:00',
      end_time: endTime || undefined,
      recurrence: recurrenceType,
      days_of_week: recurrenceType === 'weekly' ? (daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]) : [],
      day_of_month: (recurrenceType === 'monthly' || recurrenceType === 'yearly') && dayOfMonth ? parseInt(dayOfMonth) : undefined,
      month: recurrenceType === 'yearly' && month ? parseInt(month) : undefined,
      start_date: recurrenceType === 'none' && startDate ? startDate : undefined,
    } : undefined

    createMutation.mutate({
      name,
      description,
      actions,
      trigger_type: triggerType,
      schedule,
      priority: 0,
      loop: false,
    })
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setFlowDescription('')
    setRecurrenceType('weekly')
  }

  const handleUseSuggested = (suggested: typeof SUGGESTED_FLOWS[0]) => {
    createMutation.mutate({
      name: suggested.name,
      name_he: suggested.name_he,
      description: isRTL ? suggested.description_he : suggested.description,
      actions: suggested.actions,
      trigger_type: suggested.trigger_type,
      schedule: suggested.schedule,
      priority: 0,
      loop: false,
    })
    setShowSuggested(false)
  }

  if (collapsed) {
    return (
      <div className="w-12 h-full glass-sidebar flex flex-col items-center py-4 gap-4 relative overflow-visible">
        <button
          onClick={onToggle}
          className="absolute -right-4 top-4 z-30 glass-button-primary p-2 rounded-full shadow-glow"
          title={isRTL ? 'הצג זרימות' : 'Show Flows'}
        >
          <ChevronRight size={16} />
        </button>
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
      <div className="p-3 border-b border-white/5 space-y-2">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full glass-button-primary flex items-center justify-center gap-2 py-2 text-sm"
        >
          <Plus size={16} />
          <span>{isRTL ? 'זרימה חדשה' : 'New Flow'}</span>
        </button>
        <button
          onClick={() => setShowSuggested(true)}
          className="w-full glass-button flex items-center justify-center gap-2 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10"
        >
          <Sparkles size={16} />
          <span>{isRTL ? 'זרימות מוצעות' : 'Suggested Flows'}</span>
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
                  {flow.schedule.recurrence && flow.schedule.recurrence !== 'none' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded text-[10px]">
                      {flow.schedule.recurrence === 'daily' ? (isRTL ? 'יומי' : 'Daily') :
                       flow.schedule.recurrence === 'weekly' ? (isRTL ? 'שבועי' : 'Weekly') :
                       flow.schedule.recurrence === 'monthly' ? (isRTL ? 'חודשי' : 'Monthly') :
                       flow.schedule.recurrence === 'yearly' ? (isRTL ? 'שנתי' : 'Yearly') : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Expanded Details */}
              {expandedFlow === flow._id && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  {/* Description */}
                  {flow.description && (
                    <div className="text-xs text-dark-300 p-2 bg-dark-800/30 rounded" dir="auto">
                      {flow.description}
                    </div>
                  )}

                  {/* Actions List */}
                  <div className="space-y-1">
                    <p className="text-xs text-dark-500 mb-1">{isRTL ? 'פעולות:' : 'Actions:'}</p>
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
                  onClick={() => {
                    setEditingFlow(flow)
                    setEditRecurrenceType(flow.schedule?.recurrence || 'weekly')
                  }}
                  className="glass-button py-1.5 px-2 text-xs text-blue-400 hover:bg-blue-500/20"
                  title={isRTL ? 'ערוך' : 'Edit'}
                >
                  <Edit size={12} />
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
          <div className="glass-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'זרימה חדשה' : 'New Flow'}
              </h3>
              <button
                onClick={handleCloseCreateModal}
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
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  className="w-full glass-input resize-none"
                  placeholder={
                    isRTL
                      ? 'תאר את הזרימה: נגן מזרחי שמח, אז שתי פרסומות, אז חסידי'
                      : 'Describe the flow: play happy mizrahi, then 2 commercials, then hasidi'
                  }
                  required
                />
                <p className="text-xs text-dark-500 mt-1">
                  {isRTL
                    ? 'השתמש ב"אז" או "then" להפרדה בין פעולות'
                    : 'Use "then" to separate actions'}
                </p>
              </div>

              {/* Live Preview of Parsed Actions */}
              <div className="p-3 bg-dark-800/50 rounded-lg border border-primary-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={14} className="text-primary-400" />
                  <span className="text-xs font-medium text-primary-400">
                    {isRTL ? 'תצוגה מקדימה - מה המערכת הבינה:' : 'Preview - What the system understood:'}
                  </span>
                </div>
                {previewActions.length > 0 ? (
                  <div className="space-y-1">
                    {previewActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-dark-200 p-2 bg-dark-700/50 rounded"
                      >
                        <CheckCircle size={12} className="text-green-400" />
                        <ActionIcon type={action.action_type} />
                        <span>{action.description}</span>
                        {action.duration_minutes && (
                          <span className="text-dark-400">({action.duration_minutes} min)</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dark-400 italic">
                    {isRTL ? 'הקלד תיאור לראות פעולות...' : 'Type a description to see actions...'}
                  </p>
                )}
              </div>

              {/* Trigger Type */}
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'סוג הפעלה' : 'Trigger Type'}
                </label>
                <select name="trigger_type" className="w-full glass-input" defaultValue="manual">
                  <option value="manual">{isRTL ? 'ידני' : 'Manual'}</option>
                  <option value="scheduled">{isRTL ? 'מתוזמן' : 'Scheduled'}</option>
                </select>
              </div>

              {/* Schedule Fields */}
              <div className="space-y-3 p-3 bg-dark-800/30 rounded-lg">
                <p className="text-xs text-dark-400">
                  {isRTL ? 'הגדרות תזמון (לזרימות מתוזמנות)' : 'Schedule Settings (for scheduled flows)'}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'שעת התחלה' : 'Start Time'}
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      className="w-full glass-input text-sm"
                      defaultValue="09:00"
                    />
                  </div>
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'שעת סיום' : 'End Time'}
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      className="w-full glass-input text-sm"
                    />
                  </div>
                </div>

                {/* Recurrence Type */}
                <div>
                  <label className="block text-dark-300 text-xs mb-1">
                    {isRTL ? 'חזרה' : 'Repeat'}
                  </label>
                  <select
                    name="recurrence"
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                    className="w-full glass-input text-sm"
                  >
                    <option value="none">{isRTL ? 'פעם אחת' : 'Once'}</option>
                    <option value="daily">{isRTL ? 'יומי' : 'Daily'}</option>
                    <option value="weekly">{isRTL ? 'שבועי' : 'Weekly'}</option>
                    <option value="monthly">{isRTL ? 'חודשי' : 'Monthly'}</option>
                    <option value="yearly">{isRTL ? 'שנתי' : 'Yearly'}</option>
                  </select>
                </div>

                {/* One-time: Date picker */}
                {recurrenceType === 'none' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'תאריך' : 'Date'}
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      className="w-full glass-input text-sm"
                    />
                  </div>
                )}

                {/* Weekly: Day selector */}
                {recurrenceType === 'weekly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-2">
                      {isRTL ? 'ימים' : 'Days'}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(isRTL
                        ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      ).map((day, idx) => (
                        <label key={idx} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            name={`day_${idx}`}
                            defaultChecked
                            className="rounded bg-dark-700 border-dark-500"
                          />
                          <span className="text-xs text-dark-300">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly: Day of month */}
                {recurrenceType === 'monthly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'יום בחודש' : 'Day of Month'}
                    </label>
                    <select name="day_of_month" className="w-full glass-input text-sm">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Yearly: Month and day */}
                {recurrenceType === 'yearly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'חודש' : 'Month'}
                      </label>
                      <select name="month" className="w-full glass-input text-sm">
                        {(isRTL
                          ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
                          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        ).map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'יום' : 'Day'}
                      </label>
                      <select name="day_of_month" className="w-full glass-input text-sm">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || previewActions.length === 0}
                  className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Suggested Flows Modal */}
      {showSuggested && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-400" />
                <h3 className="font-semibold text-dark-100">
                  {isRTL ? 'זרימות מוצעות' : 'Suggested Flows'}
                </h3>
              </div>
              <button
                onClick={() => setShowSuggested(false)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-dark-400 mb-4">
              {isRTL
                ? 'בחר זרימה מוכנה להוספה מהירה. תוכל לערוך אותה אחרי ההוספה.'
                : 'Choose a pre-built flow for quick setup. You can edit it after adding.'}
            </p>

            <div className="space-y-3">
              {SUGGESTED_FLOWS.map((suggested) => (
                <div
                  key={suggested.id}
                  className="glass-card p-4 hover:ring-1 hover:ring-yellow-500/50 transition-all cursor-pointer"
                  onClick={() => handleUseSuggested(suggested)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-dark-100" dir="auto">
                      {isRTL ? suggested.name_he : suggested.name}
                    </h4>
                    {suggested.schedule && (
                      <div className="flex items-center gap-1 text-xs text-primary-400">
                        <Calendar size={12} />
                        <span>{suggested.schedule.start_time}-{suggested.schedule.end_time}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-dark-400 mb-3" dir="auto">
                    {isRTL ? suggested.description_he : suggested.description}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {suggested.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 text-xs bg-dark-700/50 px-2 py-1 rounded"
                      >
                        <ActionIcon type={action.action_type} />
                        <span className="text-dark-300">{action.description}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <button className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                      <Plus size={12} />
                      {isRTL ? 'הוסף זרימה זו' : 'Add this flow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Flow Modal */}
      {editingFlow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'עריכת זרימה' : 'Edit Flow'}
              </h3>
              <button
                onClick={() => setEditingFlow(null)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const triggerType = formData.get('trigger_type') as string
                const startTime = formData.get('start_time') as string
                const endTime = formData.get('end_time') as string
                const startDate = formData.get('start_date') as string
                const dayOfMonth = formData.get('day_of_month') as string
                const month = formData.get('month') as string

                // Collect selected days (for weekly recurrence)
                const daysOfWeek: number[] = []
                for (let i = 0; i < 7; i++) {
                  if (formData.get(`day_${i}`)) {
                    daysOfWeek.push(i)
                  }
                }

                const schedule = triggerType === 'scheduled' ? {
                  start_time: startTime || '09:00',
                  end_time: endTime || undefined,
                  recurrence: editRecurrenceType,
                  days_of_week: editRecurrenceType === 'weekly' ? (daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]) : [],
                  day_of_month: (editRecurrenceType === 'monthly' || editRecurrenceType === 'yearly') && dayOfMonth ? parseInt(dayOfMonth) : undefined,
                  month: editRecurrenceType === 'yearly' && month ? parseInt(month) : undefined,
                  start_date: editRecurrenceType === 'none' && startDate ? startDate : undefined,
                } : undefined

                updateMutation.mutate({
                  flowId: editingFlow._id,
                  data: {
                    name: formData.get('name') as string,
                    description: formData.get('description') as string,
                    trigger_type: triggerType,
                    schedule,
                  },
                })
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'שם' : 'Name'}
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingFlow.name}
                  className="w-full glass-input"
                  required
                />
              </div>

              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'תיאור' : 'Description'}
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingFlow.description || ''}
                  className="w-full glass-input resize-none"
                />
              </div>

              {/* Trigger Type */}
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'סוג הפעלה' : 'Trigger Type'}
                </label>
                <select
                  name="trigger_type"
                  className="w-full glass-input"
                  defaultValue={editingFlow.trigger_type}
                >
                  <option value="manual">{isRTL ? 'ידני' : 'Manual'}</option>
                  <option value="scheduled">{isRTL ? 'מתוזמן' : 'Scheduled'}</option>
                </select>
              </div>

              {/* Schedule Fields */}
              <div className="space-y-3 p-3 bg-dark-800/30 rounded-lg">
                <p className="text-xs text-dark-400">
                  {isRTL ? 'הגדרות תזמון' : 'Schedule Settings'}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'שעת התחלה' : 'Start Time'}
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      className="w-full glass-input text-sm"
                      defaultValue={editingFlow.schedule?.start_time || '09:00'}
                    />
                  </div>
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'שעת סיום' : 'End Time'}
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      className="w-full glass-input text-sm"
                      defaultValue={editingFlow.schedule?.end_time || ''}
                    />
                  </div>
                </div>

                {/* Recurrence Type */}
                <div>
                  <label className="block text-dark-300 text-xs mb-1">
                    {isRTL ? 'חזרה' : 'Repeat'}
                  </label>
                  <select
                    name="recurrence"
                    value={editRecurrenceType}
                    onChange={(e) => setEditRecurrenceType(e.target.value as RecurrenceType)}
                    className="w-full glass-input text-sm"
                  >
                    <option value="none">{isRTL ? 'פעם אחת' : 'Once'}</option>
                    <option value="daily">{isRTL ? 'יומי' : 'Daily'}</option>
                    <option value="weekly">{isRTL ? 'שבועי' : 'Weekly'}</option>
                    <option value="monthly">{isRTL ? 'חודשי' : 'Monthly'}</option>
                    <option value="yearly">{isRTL ? 'שנתי' : 'Yearly'}</option>
                  </select>
                </div>

                {/* One-time: Date picker */}
                {editRecurrenceType === 'none' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'תאריך' : 'Date'}
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      className="w-full glass-input text-sm"
                      defaultValue={editingFlow.schedule?.start_date || ''}
                    />
                  </div>
                )}

                {/* Weekly: Day selector */}
                {editRecurrenceType === 'weekly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-2">
                      {isRTL ? 'ימים' : 'Days'}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(isRTL
                        ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      ).map((day, idx) => (
                        <label key={idx} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            name={`day_${idx}`}
                            defaultChecked={editingFlow.schedule?.days_of_week?.includes(idx) ?? true}
                            className="rounded bg-dark-700 border-dark-500"
                          />
                          <span className="text-xs text-dark-300">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly: Day of month */}
                {editRecurrenceType === 'monthly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'יום בחודש' : 'Day of Month'}
                    </label>
                    <select
                      name="day_of_month"
                      className="w-full glass-input text-sm"
                      defaultValue={editingFlow.schedule?.day_of_month || 1}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Yearly: Month and day */}
                {editRecurrenceType === 'yearly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'חודש' : 'Month'}
                      </label>
                      <select
                        name="month"
                        className="w-full glass-input text-sm"
                        defaultValue={editingFlow.schedule?.month || 1}
                      >
                        {(isRTL
                          ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
                          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        ).map((m, idx) => (
                          <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-dark-300 text-xs mb-1">
                        {isRTL ? 'יום' : 'Day'}
                      </label>
                      <select
                        name="day_of_month"
                        className="w-full glass-input text-sm"
                        defaultValue={editingFlow.schedule?.day_of_month || 1}
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'פעולות (לקריאה בלבד)' : 'Actions (read-only)'}
                </label>
                <div className="space-y-1 max-h-24 overflow-auto">
                  {editingFlow.actions.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-dark-300 p-1.5 bg-dark-800/50 rounded"
                    >
                      <ActionIcon type={action.action_type} />
                      <span>{action.description || action.action_type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingFlow(null)}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Edit size={16} />
                  )}
                  <span>{isRTL ? 'שמור' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X, Send, Bot, User, Loader2, Sparkles, HelpCircle, AlertCircle, Trash2,
  Play, Pause, SkipForward, Volume2, ListPlus, Info, Search, Clock, Music,
  Megaphone, Calendar, Workflow, Users, List, Trash, MinusCircle, BarChart2,
  TrendingUp, RefreshCw, Activity, type LucideIcon
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useService, useServiceMode } from '../../services'
import { usePlayerStore } from '../../store/playerStore'
import { Input } from '../Form'
import { toast } from '../../store/toastStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: string
}

interface ChatSidebarProps {
  expanded: boolean
  onToggle: () => void
  width?: number
  onResizeStart?: () => void
}

// Quick command examples for users
const QUICK_COMMANDS = {
  he: [
    { text: "תנגן שיר של עידן רייכל", icon: "🎵" },
    { text: "מה מתנגן עכשיו?", icon: "❓" },
    { text: "דלג לשיר הבא", icon: "⏭️" },
    { text: "עבור לז'אנר מזרחי", icon: "🎶" },
    { text: "תזמן פרסומת לשעה 14:00", icon: "📢" },
  ],
  en: [
    { text: "Play a song by Idan Raichel", icon: "🎵" },
    { text: "What's playing now?", icon: "❓" },
    { text: "Skip to next song", icon: "⏭️" },
    { text: "Switch to Mizrahi genre", icon: "🎶" },
    { text: "Schedule commercial for 2 PM", icon: "📢" },
  ]
}

// LLM error messages mapping
const LLM_ERROR_MESSAGES: Record<string, { en: string; he: string }> = {
  'LLM_UNAVAILABLE:AUTH_ERROR': {
    en: 'AI Assistant is unavailable: Authentication failed. Please check the API key configuration.',
    he: 'הסוכן החכם אינו זמין: שגיאת אימות. נא לבדוק את הגדרות מפתח ה-API.'
  },
  'LLM_UNAVAILABLE:RATE_LIMIT': {
    en: 'AI Assistant is temporarily unavailable: Rate limit exceeded. Please try again in a moment.',
    he: 'הסוכן החכם אינו זמין זמנית: חריגה ממגבלת הבקשות. נא לנסות שוב בעוד רגע.'
  },
  'LLM_UNAVAILABLE:CONNECTION_ERROR': {
    en: 'AI Assistant is unavailable: Unable to connect to the AI service. Please check your internet connection.',
    he: 'הסוכן החכם אינו זמין: לא ניתן להתחבר לשירות ה-AI. נא לבדוק את חיבור האינטרנט.'
  },
  'LLM_UNAVAILABLE:API_ERROR': {
    en: 'AI Assistant is unavailable: The AI service encountered an error. Please try again later.',
    he: 'הסוכן החכם אינו זמין: שגיאה בשירות ה-AI. נא לנסות שוב מאוחר יותר.'
  },
  'LLM_UNAVAILABLE:UNKNOWN_ERROR': {
    en: 'AI Assistant is unavailable: An unexpected error occurred. Please try again later.',
    he: 'הסוכן החכם אינו זמין: אירעה שגיאה בלתי צפויה. נא לנסות שוב מאוחר יותר.'
  }
}

// Helper to get user-friendly error message
function getLLMErrorMessage(errorDetail: string, lang: 'en' | 'he'): string {
  // Check for exact match first
  if (LLM_ERROR_MESSAGES[errorDetail]) {
    return LLM_ERROR_MESSAGES[errorDetail][lang]
  }
  // Check for partial match (for errors with additional info like status codes)
  for (const [key, messages] of Object.entries(LLM_ERROR_MESSAGES)) {
    if (errorDetail.startsWith(key.replace(':API_ERROR', ''))) {
      return messages[lang]
    }
  }
  // Check if it's any LLM unavailable error
  if (errorDetail.startsWith('LLM_UNAVAILABLE')) {
    return LLM_ERROR_MESSAGES['LLM_UNAVAILABLE:UNKNOWN_ERROR'][lang]
  }
  // Return original error if not an LLM error
  return errorDetail
}

// Action templates for @ mention popup
interface ActionTemplate {
  id: string
  label: string
  labelHe: string
  icon: LucideIcon
  template: string
  templateHe: string
  category: 'playback' | 'scheduling' | 'calendar' | 'flows' | 'library' | 'queue' | 'stats' | 'help' | 'admin'
}

const ACTION_TEMPLATES: ActionTemplate[] = [
  // Playback
  { id: 'play_content', label: 'Play', labelHe: 'נגן', icon: Play, template: 'Play [song/artist name]', templateHe: 'תנגן [שם שיר/אמן]', category: 'playback' },
  { id: 'pause_playback', label: 'Pause', labelHe: 'השהה', icon: Pause, template: 'Pause playback', templateHe: 'עצור את הנגינה', category: 'playback' },
  { id: 'resume_playback', label: 'Resume', labelHe: 'המשך', icon: Play, template: 'Resume playback', templateHe: 'המשך לנגן', category: 'playback' },
  { id: 'skip_current', label: 'Skip', labelHe: 'דלג', icon: SkipForward, template: 'Skip to next song', templateHe: 'דלג לשיר הבא', category: 'playback' },
  { id: 'set_volume', label: 'Volume', labelHe: 'עוצמה', icon: Volume2, template: 'Set volume to [0-100]', templateHe: 'קבע עוצמה ל-[0-100]', category: 'playback' },
  { id: 'add_to_queue', label: 'Add to Queue', labelHe: 'הוסף לתור', icon: ListPlus, template: 'Add [song name] to queue', templateHe: 'הוסף [שם שיר] לתור', category: 'playback' },
  { id: 'get_status', label: 'Status', labelHe: 'סטטוס', icon: Info, template: "What's playing now?", templateHe: 'מה מתנגן עכשיו?', category: 'playback' },
  { id: 'search_content', label: 'Search', labelHe: 'חפש', icon: Search, template: 'Search for [query]', templateHe: 'חפש [מילות חיפוש]', category: 'playback' },

  // Scheduling
  { id: 'schedule_content', label: 'Schedule', labelHe: 'תזמן', icon: Clock, template: 'Schedule [song] for [time]', templateHe: 'תזמן [שיר] לשעה [זמן]', category: 'scheduling' },
  { id: 'change_genre', label: 'Genre', labelHe: "ז'אנר", icon: Music, template: 'Switch to [genre] genre', templateHe: "עבור לז'אנר [ז'אנר]", category: 'scheduling' },
  { id: 'insert_commercial', label: 'Commercial', labelHe: 'פרסומת', icon: Megaphone, template: 'Play a commercial break', templateHe: 'נגן הפסקת פרסומות', category: 'scheduling' },

  // Calendar
  { id: 'schedule_to_calendar', label: 'Add to Calendar', labelHe: 'הוסף ליומן', icon: Calendar, template: 'Add [event] to calendar at [time]', templateHe: 'הוסף [אירוע] ליומן בשעה [זמן]', category: 'calendar' },
  { id: 'list_calendar_events', label: 'Calendar Events', labelHe: 'אירועי יומן', icon: Calendar, template: 'Show calendar events for [today/tomorrow]', templateHe: 'הצג אירועי יומן ל[היום/מחר]', category: 'calendar' },
  { id: 'get_day_schedule', label: 'Day Schedule', labelHe: 'לוח יום', icon: Calendar, template: "Show today's schedule", templateHe: 'הצג את לוח הזמנים להיום', category: 'calendar' },
  { id: 'update_calendar_event', label: 'Update Event', labelHe: 'עדכן אירוע', icon: Calendar, template: 'Update [event name] to [new time]', templateHe: 'עדכן [שם אירוע] ל[זמן חדש]', category: 'calendar' },
  { id: 'delete_calendar_event', label: 'Delete Event', labelHe: 'מחק אירוע', icon: Calendar, template: 'Delete [event name] from calendar', templateHe: 'מחק [שם אירוע] מהיומן', category: 'calendar' },

  // Flows
  { id: 'create_flow', label: 'Create Flow', labelHe: 'צור זרימה', icon: Workflow, template: 'Create a flow: [description]', templateHe: 'צור זרימה: [תיאור]', category: 'flows' },
  { id: 'list_flows', label: 'List Flows', labelHe: 'הצג זרימות', icon: Workflow, template: 'Show all flows', templateHe: 'הצג את כל הזרימות', category: 'flows' },
  { id: 'run_flow', label: 'Run Flow', labelHe: 'הרץ זרימה', icon: Play, template: 'Run flow [flow name]', templateHe: 'הרץ זרימה [שם זרימה]', category: 'flows' },
  { id: 'update_flow', label: 'Update Flow', labelHe: 'עדכן זרימה', icon: Workflow, template: 'Update flow [flow name]: [changes]', templateHe: 'עדכן זרימה [שם זרימה]: [שינויים]', category: 'flows' },
  { id: 'delete_flow', label: 'Delete Flow', labelHe: 'מחק זרימה', icon: Workflow, template: 'Delete flow [flow name]', templateHe: 'מחק זרימה [שם זרימה]', category: 'flows' },
  { id: 'toggle_flow', label: 'Toggle Flow', labelHe: 'החלף זרימה', icon: Workflow, template: 'Toggle flow [flow name]', templateHe: 'החלף מצב זרימה [שם זרימה]', category: 'flows' },

  // Library
  { id: 'list_artists', label: 'Artists', labelHe: 'אמנים', icon: Users, template: 'List all artists', templateHe: 'הצג את כל האמנים', category: 'library' },
  { id: 'list_genres', label: 'Genres', labelHe: "ז'אנרים", icon: Music, template: 'List all genres', templateHe: "הצג את כל הז'אנרים", category: 'library' },

  // Queue Management
  { id: 'show_queue', label: 'Show Queue', labelHe: 'הצג תור', icon: List, template: 'Show queue', templateHe: 'מה בתור?', category: 'queue' },
  { id: 'clear_queue', label: 'Clear Queue', labelHe: 'נקה תור', icon: Trash, template: 'Clear queue', templateHe: 'נקה תור', category: 'queue' },
  { id: 'remove_from_queue', label: 'Remove from Queue', labelHe: 'הסר מתור', icon: MinusCircle, template: 'Remove [song name] from queue', templateHe: 'הסר [שם שיר] מהתור', category: 'queue' },

  // Statistics
  { id: 'get_statistics', label: 'Statistics', labelHe: 'סטטיסטיקות', icon: BarChart2, template: 'Show statistics', templateHe: 'הצג סטטיסטיקות', category: 'stats' },
  { id: 'get_most_played', label: 'Most Played', labelHe: 'הכי מנוגנים', icon: TrendingUp, template: 'Show most played songs', templateHe: 'הצג שירים הכי מנוגנים', category: 'stats' },

  // Help
  { id: 'get_help', label: 'Help', labelHe: 'עזרה', icon: HelpCircle, template: 'Help', templateHe: 'עזרה', category: 'help' },

  // Admin
  { id: 'sync_drive', label: 'Sync Drive', labelHe: 'סנכרן דרייב', icon: RefreshCw, template: 'Sync from Google Drive', templateHe: 'סנכרן מגוגל דרייב', category: 'admin' },
  { id: 'get_sync_status', label: 'Sync Status', labelHe: 'סטטוס סנכרון', icon: Activity, template: 'Show sync status', templateHe: 'הצג סטטוס סנכרון', category: 'admin' },
]

export default function ChatSidebar({ expanded, onToggle, width = 384, onResizeStart }: ChatSidebarProps) {
  const { t, i18n } = useTranslation()
  const [message, setMessage] = useState('')
  const [showExamples, setShowExamples] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { play } = usePlayerStore()
  const service = useService()
  const { isDemoMode: isInDemoMode } = useServiceMode()

  // @ action popup state
  const [showActionPopup, setShowActionPopup] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)
  const [atPosition, setAtPosition] = useState<number | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const isRTL = i18n.language === 'he'
  const lang = i18n.language as 'he' | 'en'

  // Fetch chat history
  const { data: history } = useQuery({
    queryKey: ['chatHistory'],
    queryFn: () => service.getChatHistory(),
    enabled: expanded,
  })

  // Transform history to messages
  const messages: ChatMessage[] = (Array.isArray(history) ? history : []).flatMap((entry: any, index: number) => [
    {
      id: `user-${index}`,
      role: 'user' as const,
      content: entry.user_message,
      timestamp: entry.timestamp,
    },
    {
      id: `assistant-${index}`,
      role: 'assistant' as const,
      content: entry.assistant_message,
      timestamp: entry.timestamp,
    },
  ])

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (msg: string) => service.sendChatMessage(msg),
    onSuccess: (data: any) => {
      setErrorMessage(null)
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] })

      // If there's a track to play, trigger the player
      if (data.play_track) {
        play(data.play_track)
      }
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to send message'
      // Get user-friendly error message for LLM errors
      const userMessage = getLLMErrorMessage(detail, lang)
      setErrorMessage(userMessage)
    },
  })

  // Clear chat mutation
  const clearMutation = useMutation({
    mutationFn: () => service.clearChatHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] })
      setShowExamples(true)
      setErrorMessage(null)
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, sendMutation.isPending, errorMessage])

  // Focus input when expanded
  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    }
  }, [expanded])

  // Filter actions based on search text
  const filteredActions = useMemo(() => {
    if (!actionFilter) return ACTION_TEMPLATES
    const lowerFilter = actionFilter.toLowerCase()
    return ACTION_TEMPLATES.filter(action =>
      action.label.toLowerCase().includes(lowerFilter) ||
      action.labelHe.includes(actionFilter) ||
      action.id.includes(lowerFilter) ||
      action.template.toLowerCase().includes(lowerFilter) ||
      action.templateHe.includes(actionFilter)
    )
  }, [actionFilter])

  // Reset selected index when filtered actions change
  useEffect(() => {
    setSelectedActionIndex(0)
  }, [filteredActions.length])

  // Handle input change - detect '@' for action popup
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setMessage(value)

    // Find the last '@' before cursor
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1, cursorPos)
      // Show popup if @ is followed by no space or partial text (filtering)
      if (!textAfterAt.includes(' ')) {
        setShowActionPopup(true)
        setAtPosition(lastAtIndex)
        setActionFilter(textAfterAt)
        return
      }
    }
    setShowActionPopup(false)
    setAtPosition(null)
  }

  // Handle action selection from popup
  const handleSelectAction = (action: ActionTemplate) => {
    if (atPosition === null) return

    const template = isRTL ? action.templateHe : action.template
    // Replace @query with the template
    const before = message.slice(0, atPosition)
    const after = message.slice(atPosition + 1 + actionFilter.length)
    const newMessage = before + template + after
    setMessage(newMessage)
    setShowActionPopup(false)
    setAtPosition(null)
    setActionFilter('')

    // Focus input and position cursor at end of template
    setTimeout(() => {
      inputRef.current?.focus()
      const cursorPos = before.length + template.length
      inputRef.current?.setSelectionRange(cursorPos, cursorPos)
    }, 0)
  }

  // Handle keyboard navigation in popup
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showActionPopup && filteredActions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedActionIndex(i => Math.min(i + 1, filteredActions.length - 1))
        // Scroll selected item into view
        setTimeout(() => {
          popupRef.current?.querySelector(`[data-index="${Math.min(selectedActionIndex + 1, filteredActions.length - 1)}"]`)?.scrollIntoView({ block: 'nearest' })
        }, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedActionIndex(i => Math.max(i - 1, 0))
        setTimeout(() => {
          popupRef.current?.querySelector(`[data-index="${Math.max(selectedActionIndex - 1, 0)}"]`)?.scrollIntoView({ block: 'nearest' })
        }, 0)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelectAction(filteredActions[selectedActionIndex])
        return
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowActionPopup(false)
        setAtPosition(null)
        return
      } else if (e.key === 'Tab') {
        e.preventDefault()
        handleSelectAction(filteredActions[selectedActionIndex])
        return
      }
    }

    // Normal Enter handling (send message)
    if (e.key === 'Enter' && !e.shiftKey && !showActionPopup) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return

    if (isInDemoMode) {
      toast.info(isRTL ? 'מצב הדגמה - פקודות צ\'אט לא משפיעות על המערכת' : 'Demo mode - chat commands do not affect the system')
      return
    }

    setShowExamples(false)
    setErrorMessage(null)
    sendMutation.mutate(message)
    setMessage('')
  }

  const handleQuickCommand = (command: string) => {
    setMessage(command)
    inputRef.current?.focus()
  }

  return (
    <div
      className={`fixed right-0 top-0 h-full z-50
        transition-all duration-300 ease-in-out
        ${expanded ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        flex flex-col glass-sidebar shadow-2xl`}
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      {expanded && onResizeStart && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary-500/50 transition-colors group z-10"
          onMouseDown={onResizeStart}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary-500/30 group-hover:bg-primary-500 rounded-full transition-colors" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-primary-500/20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/30 rounded-xl">
            <Bot size={24} className="text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold text-dark-100">{t('chat.title')}</h2>
            <p className="text-xs text-dark-400">{t('agent.title')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <div className="tooltip-trigger">
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-dark-400 hover:text-red-400"
              >
                <Trash2 size={18} />
              </button>
              <div className="tooltip tooltip-bottom">
                {isRTL ? 'נקה צ\'אט' : 'Clear chat'}
              </div>
            </div>
          )}
          <div className="tooltip-trigger">
            <button
              onClick={onToggle}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-dark-300 hover:text-dark-100"
            >
              <X size={20} />
            </button>
            <div className="tooltip tooltip-bottom">
              {t('chat.collapse')}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome & Examples for new users */}
        {messages.length === 0 && !sendMutation.isPending && showExamples && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary-500/30">
                <Sparkles size={32} className="text-primary-400" />
              </div>
              <h3 className="font-semibold text-dark-100 mb-1">
                {isRTL ? 'שלום! אני הסוכן החכם' : 'Hi! I\'m the Smart Agent'}
              </h3>
              <p className="text-sm text-dark-400">
                {isRTL
                  ? 'אני יכול לעזור לך לנהל את תחנת הרדיו. נסה אחת מהפקודות:'
                  : 'I can help you manage the radio station. Try one of these:'}
              </p>
            </div>

            {/* Quick command buttons */}
            <div className="space-y-2">
              {QUICK_COMMANDS[lang].map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickCommand(cmd.text)}
                  className="w-full text-start p-3 glass-card hover:bg-white/10 transition-all border border-white/5 hover:border-primary-500/30"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <span className="mr-2">{cmd.icon}</span>
                  <span className="text-sm text-dark-200">{cmd.text}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-dark-500 justify-center">
              <HelpCircle size={14} />
              <span>{isRTL ? 'או הקלד כל בקשה בחופשיות' : 'Or type any request freely'}</span>
            </div>
          </div>
        )}

        {messages.length === 0 && !sendMutation.isPending && !showExamples && !errorMessage && (
          <div className="text-center text-dark-500 mt-8">
            <Bot size={48} className="mx-auto mb-4 text-dark-600" />
            <p className="text-sm">
              {isRTL
                ? 'אין הודעות עדיין. התחל לשוחח!'
                : 'No messages yet. Start chatting!'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div
              className={`max-w-[80%] p-3 ${
                msg.role === 'user'
                  ? 'chat-bubble-user'
                  : 'chat-bubble-assistant'
              }`}
            >
              <div className="flex items-start gap-2">
                {msg.role === 'assistant' && (
                  <Bot size={16} className="mt-0.5 flex-shrink-0 text-primary-400" />
                )}
                <p className="text-sm whitespace-pre-wrap" dir="auto">{msg.content}</p>
                {msg.role === 'user' && (
                  <User size={16} className="mt-0.5 flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Pending message */}
        {sendMutation.isPending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[80%] p-3 chat-bubble-user">
                <p className="text-sm">{sendMutation.variables}</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 chat-bubble-assistant">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primary-400" />
                  <span className="text-sm text-dark-400">{t('chat.thinking')}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error message */}
        {errorMessage && (
          <>
            {sendMutation.variables && (
              <div className="flex justify-end">
                <div className="max-w-[80%] p-3 chat-bubble-user">
                  <p className="text-sm">{sendMutation.variables}</p>
                </div>
              </div>
            )}
            <div className="flex justify-start">
              <div className="max-w-[85%] p-3 bg-red-500/20 border border-red-500/30 rounded-2xl rounded-bl-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm text-red-400 font-medium mb-1">
                      {isRTL ? 'שגיאה' : 'Error'}
                    </p>
                    <p className="text-sm text-red-300">{errorMessage}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="relative">
          {/* @ Action Popup */}
          {showActionPopup && filteredActions.length > 0 && (
            <div
              ref={popupRef}
              className="absolute bottom-full left-0 right-0 mb-2 glass-card p-2 max-h-64 overflow-auto z-50 border border-primary-500/30"
            >
              <div className="text-xs text-dark-500 px-2 py-1 mb-1 flex items-center gap-1">
                <span>@</span>
                <span>{isRTL ? 'בחר פעולה' : 'Select an action'}</span>
                <span className="ml-auto text-dark-600">
                  {isRTL ? '↑↓ לניווט • Enter לבחירה' : '↑↓ navigate • Enter select'}
                </span>
              </div>
              {filteredActions.map((action, idx) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    data-index={idx}
                    onClick={() => handleSelectAction(action)}
                    onMouseEnter={() => setSelectedActionIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      idx === selectedActionIndex
                        ? 'bg-primary-500/20 border border-primary-500/30'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon size={16} className="text-primary-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left" dir={isRTL ? 'rtl' : 'ltr'}>
                      <div className="text-sm text-dark-100 font-medium">
                        {isRTL ? action.labelHe : action.label}
                      </div>
                      <div className="text-xs text-dark-400 truncate">
                        {isRTL ? action.templateHe : action.template}
                      </div>
                    </div>
                    <span className="text-[10px] text-dark-600 px-1.5 py-0.5 bg-dark-800/50 rounded">
                      {action.category}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* No results message */}
          {showActionPopup && filteredActions.length === 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 glass-card p-4 text-center text-dark-400 text-sm">
              {isRTL ? 'לא נמצאו פעולות' : 'No actions found'}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isRTL ? 'הקלד הודעה או @ לפעולות...' : 'Type a message or @ for actions...'}
              disabled={sendMutation.isPending}
              className="flex-1"
              dir={isRTL ? 'rtl' : 'ltr'}
              size="lg"
            />
            <div className="tooltip-trigger">
              <button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending || isInDemoMode}
                className={`px-4 py-3 glass-button-primary disabled:opacity-50 disabled:cursor-not-allowed ${isInDemoMode ? 'opacity-60' : ''}`}
              >
                <Send size={20} />
              </button>
              <div className="tooltip tooltip-top">
                {isInDemoMode
                  ? (isRTL ? 'מצב הדגמה - צ\'אט מושבת' : 'Demo mode - chat disabled')
                  : t('chat.send')}
              </div>
            </div>
          </div>
        </div>
        {/* Show examples button if hidden */}
        {!showExamples && messages.length === 0 && (
          <button
            onClick={() => setShowExamples(true)}
            className="w-full mt-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            {isRTL ? '📋 הצג דוגמאות לפקודות' : '📋 Show command examples'}
          </button>
        )}
      </div>
    </div>
  )
}

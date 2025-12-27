import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, Bot, User, Loader2, Sparkles, HelpCircle, AlertCircle } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { usePlayerStore } from '../../store/playerStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: string
}

interface ChatSidebarProps {
  expanded: boolean
  onToggle: () => void
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

export default function ChatSidebar({ expanded, onToggle }: ChatSidebarProps) {
  const { t, i18n } = useTranslation()
  const [message, setMessage] = useState('')
  const [showExamples, setShowExamples] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { play } = usePlayerStore()

  const isRTL = i18n.language === 'he'
  const lang = i18n.language as 'he' | 'en'

  // Fetch chat history
  const { data: history } = useQuery({
    queryKey: ['chatHistory'],
    queryFn: () => api.getChatHistory(),
    enabled: expanded,
  })

  // Transform history to messages
  const messages: ChatMessage[] = (history || []).flatMap((entry: any, index: number) => [
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
    mutationFn: (msg: string) => api.sendChatMessage(msg),
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
      setErrorMessage(detail)
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

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return

    setShowExamples(false)
    setErrorMessage(null)
    sendMutation.mutate(message)
    setMessage('')
  }

  const handleQuickCommand = (command: string) => {
    setMessage(command)
    inputRef.current?.focus()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={`fixed right-0 top-0 h-full z-50
        transition-transform duration-300 ease-in-out
        ${expanded ? 'translate-x-0' : 'translate-x-full'}
        w-96 flex flex-col glass-sidebar`}
    >
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
        <button
          onClick={onToggle}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors text-dark-300 hover:text-dark-100"
          title={t('chat.collapse')}
        >
          <X size={20} />
        </button>
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
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.placeholder')}
            disabled={sendMutation.isPending}
            className={`flex-1 px-4 py-3 glass-input text-base ${isRTL ? 'text-right' : 'text-left'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className="px-4 py-3 glass-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('chat.send')}
          >
            <Send size={20} />
          </button>
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

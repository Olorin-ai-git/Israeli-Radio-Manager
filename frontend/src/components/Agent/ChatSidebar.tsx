import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, Bot, User, Loader2, Sparkles, HelpCircle } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] })
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, sendMutation.isPending])

  // Focus input when expanded
  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    }
  }, [expanded])

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return

    setShowExamples(false)
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
      className={`fixed ${isRTL ? 'left-0' : 'right-0'} top-0 h-full bg-white shadow-xl z-50
        transition-transform duration-300 ease-in-out
        ${expanded ? 'translate-x-0' : isRTL ? '-translate-x-full' : 'translate-x-full'}
        w-96 flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary-500 text-white">
        <div className="flex items-center gap-3">
          <Bot size={24} />
          <div>
            <h2 className="font-semibold">{t('chat.title')}</h2>
            <p className="text-xs text-primary-100">{t('agent.title')}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-primary-600 rounded-lg transition-colors"
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
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles size={32} className="text-primary-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {isRTL ? 'שלום! אני הסוכן החכם 👋' : 'Hi! I\'m the Smart Agent 👋'}
              </h3>
              <p className="text-sm text-gray-500">
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
                  className="w-full text-start p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <span className="mr-2">{cmd.icon}</span>
                  <span className="text-sm text-gray-700">{cmd.text}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <HelpCircle size={14} />
              <span>{isRTL ? 'או הקלד כל בקשה בחופשיות' : 'Or type any request freely'}</span>
            </div>
          </div>
        )}

        {messages.length === 0 && !sendMutation.isPending && !showExamples && (
          <div className="text-center text-gray-500 mt-8">
            <Bot size={48} className="mx-auto mb-4 text-gray-300" />
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
            className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div
              className={`max-w-[80%] p-3 ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white rounded-2xl ' + (isRTL ? 'rounded-bl-sm' : 'rounded-br-sm')
                  : 'bg-gray-100 text-gray-800 rounded-2xl ' + (isRTL ? 'rounded-br-sm' : 'rounded-bl-sm')
              }`}
            >
              <div className="flex items-start gap-2">
                {msg.role === 'assistant' && (
                  <Bot size={16} className="mt-0.5 flex-shrink-0 text-primary-500" />
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
                  <Loader2 size={16} className="animate-spin text-primary-500" />
                  <span className="text-sm text-gray-500">{t('chat.thinking')}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.placeholder')}
            disabled={sendMutation.isPending}
            className={`flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 text-base ${isRTL ? 'text-right' : 'text-left'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className={`px-4 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRTL ? 'rotate-180' : ''}`}
            title={t('chat.send')}
          >
            <Send size={20} />
          </button>
        </div>
        {/* Show examples button if hidden */}
        {!showExamples && messages.length === 0 && (
          <button
            onClick={() => setShowExamples(true)}
            className="w-full mt-2 text-sm text-primary-500 hover:text-primary-600"
          >
            {isRTL ? '📋 הצג דוגמאות לפקודות' : '📋 Show command examples'}
          </button>
        )}
      </div>
    </div>
  )
}

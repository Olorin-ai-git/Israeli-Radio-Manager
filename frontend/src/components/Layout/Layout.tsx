import { ReactNode, useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  CalendarDays,
  Library,
  Upload,
  Bot,
  Settings,
  MessageCircle,
  Globe,
  Blocks,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import ChatSidebar from '../Agent/ChatSidebar'
import AudioPlayer from '../Player/AudioPlayer'
import FlowsPanel from '../Flows/FlowsPanel'
import { usePlayerStore } from '../../store/playerStore'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [chatExpanded, setChatExpanded] = useState(false)
  const [flowsCollapsed, setFlowsCollapsed] = useState(true)
  const [navCollapsed, setNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('navCollapsed')
    return saved ? saved === 'true' : false
  })
  const { currentTrack, queue, playNext, playNow, hasUserInteracted, setUserInteracted } = usePlayerStore()
  const wsRef = useRef<WebSocket | null>(null)
  const lastPlayedIdRef = useRef<string | null>(null) // Prevent duplicate playback
  const isAutoPlayingRef = useRef(false) // Prevent recursive auto-play

  // Track user interaction for autoplay policy
  useEffect(() => {
    if (hasUserInteracted) return // Already tracked

    const markInteracted = () => {
      setUserInteracted()
    }

    // Listen for any user interaction
    document.addEventListener('click', markInteracted, { once: true })
    document.addEventListener('keydown', markInteracted, { once: true })
    document.addEventListener('touchstart', markInteracted, { once: true })

    return () => {
      document.removeEventListener('click', markInteracted)
      document.removeEventListener('keydown', markInteracted)
      document.removeEventListener('touchstart', markInteracted)
    }
  }, [hasUserInteracted, setUserInteracted])

  // Auto-play from queue when nothing is playing (only after user interaction)
  useEffect(() => {
    // Guard against rapid successive calls
    if (isAutoPlayingRef.current) return

    // Only auto-play if user has interacted with the page (browser autoplay policy)
    if (!hasUserInteracted) return

    if (!currentTrack && queue.length > 0) {
      isAutoPlayingRef.current = true
      console.log('Auto-playing from queue - no current track but queue has items')
      playNext()
      // Reset guard after a short delay
      setTimeout(() => {
        isAutoPlayingRef.current = false
      }, 100)
    }
  }, [currentTrack, queue.length, playNext, hasUserInteracted])

  // Panel width state with localStorage persistence
  const [flowsPanelWidth, setFlowsPanelWidth] = useState(() => {
    const saved = localStorage.getItem('flowsPanelWidth')
    return saved ? parseInt(saved) : 288 // Default 288px (18rem)
  })
  const [chatPanelWidth, setChatPanelWidth] = useState(() => {
    const saved = localStorage.getItem('chatPanelWidth')
    return saved ? parseInt(saved) : 384 // Default 384px (24rem)
  })

  const isResizingFlows = useRef(false)
  const isResizingChat = useRef(false)

  const isRTL = i18n.language === 'he'

  // WebSocket connection for real-time updates (scheduled playback)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/ws/`

    const connect = () => {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        // Subscribe to playback channel
        ws.send(JSON.stringify({ type: 'subscribe', channels: ['playback', 'all'] }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'scheduled_playback') {
            // Chat-requested content should play immediately
            const content = message.data

            // Prevent duplicate playback (multiple WS connections or re-renders)
            if (lastPlayedIdRef.current === content._id) {
              console.log('Skipping duplicate playback for:', content.title)
              return
            }
            lastPlayedIdRef.current = content._id

            // Clear the duplicate check after 2 seconds to allow replaying same song
            setTimeout(() => {
              if (lastPlayedIdRef.current === content._id) {
                lastPlayedIdRef.current = null
              }
            }, 2000)

            console.log('Chat playback triggered:', content)

            const track = {
              _id: content._id,
              title: content.title,
              artist: content.artist,
              type: content.type,
              duration_seconds: content.duration_seconds,
              genre: content.genre,
              metadata: content.metadata,
            }

            // Play immediately, interrupting current track if needed
            playNow(track)
          } else if (message.type === 'queue_update') {
            // Full queue update from backend
            const queue = message.data
            console.log('Queue update received:', queue.length, 'items')

            const { setQueue } = usePlayerStore.getState()
            setQueue(queue)
          } else if (message.type === 'calendar_update') {
            // Calendar was updated (event added/modified/deleted)
            console.log('Calendar update received, refreshing...')
            queryClient.invalidateQueries({ queryKey: ['weekSchedule'] })
          }
        } catch (e) {
          console.error('WebSocket message error:', e)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 5s...')
        setTimeout(connect, 5000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [isRTL, playNow, queryClient])

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/calendar', icon: CalendarDays, label: isRTL ? 'לוח שידורים' : 'Broadcast Schedule' },
    { path: '/actions-studio', icon: Blocks, label: isRTL ? 'סטודיו פעולות' : 'Actions Studio' },
    { path: '/library', icon: Library, label: t('nav.library') },
    { path: '/upload', icon: Upload, label: t('nav.upload') },
    { path: '/agent', icon: Bot, label: t('nav.agent') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')
  }

  const toggleNav = () => {
    const newValue = !navCollapsed
    setNavCollapsed(newValue)
    localStorage.setItem('navCollapsed', String(newValue))
  }

  // Resize handlers for Flows panel
  const handleFlowsResizeStart = () => {
    isResizingFlows.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  const handleFlowsResizeMove = (e: MouseEvent) => {
    if (!isResizingFlows.current) return
    const newWidth = Math.max(200, Math.min(600, e.clientX))
    setFlowsPanelWidth(newWidth)
  }

  const handleFlowsResizeEnd = () => {
    if (isResizingFlows.current) {
      isResizingFlows.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('flowsPanelWidth', flowsPanelWidth.toString())
    }
  }

  // Resize handlers for Chat panel
  const handleChatResizeStart = () => {
    isResizingChat.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  const handleChatResizeMove = (e: MouseEvent) => {
    if (!isResizingChat.current) return
    const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX))
    setChatPanelWidth(newWidth)
  }

  const handleChatResizeEnd = () => {
    if (isResizingChat.current) {
      isResizingChat.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('chatPanelWidth', chatPanelWidth.toString())
    }
  }

  // Add global mouse event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleFlowsResizeMove(e)
      handleChatResizeMove(e)
    }

    const handleMouseUp = () => {
      handleFlowsResizeEnd()
      handleChatResizeEnd()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [flowsPanelWidth, chatPanelWidth])

  return (
    <div className="h-screen bg-dark-950 overflow-hidden">
      {/* Background gradient overlay */}
      <div className="fixed inset-0 bg-gradient-dark pointer-events-none" />

      {/* Decorative blur circles */}
      <div className="fixed top-20 left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-80 h-80 bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Flows Panel - Fixed on left side */}
      <div
        className="fixed left-0 top-0 h-full z-20 overflow-visible transition-[width] duration-300 ease-in-out"
        style={{ width: flowsCollapsed ? '48px' : `${flowsPanelWidth}px` }}
      >
        <FlowsPanel
          collapsed={flowsCollapsed}
          onToggle={() => setFlowsCollapsed(!flowsCollapsed)}
          width={flowsPanelWidth}
        />
        {/* Resize Handle */}
        {!flowsCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary-500/50 transition-colors group"
            onMouseDown={handleFlowsResizeStart}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary-500/30 group-hover:bg-primary-500 rounded-full transition-colors" />
          </div>
        )}
      </div>

      {/* Main layout container - offset by flows panel width */}
      <div
        className="h-full flex transition-[margin] duration-300 ease-in-out"
        style={{ marginLeft: flowsCollapsed ? '48px' : `${flowsPanelWidth}px` }}
      >
        {/* Sidebar Navigation - Right side for English, Left side for Hebrew */}
        <nav className={`relative z-10 glass-sidebar flex flex-col flex-shrink-0 transition-all duration-300 ${navCollapsed ? 'w-16' : 'w-64'} ${isRTL ? '' : 'order-last'}`}>
          {/* Logo & Collapse Toggle */}
          <div className={`border-b border-white/5 ${navCollapsed ? 'p-2' : 'p-4'}`}>
            <div className={`flex items-center ${navCollapsed ? 'flex-col gap-2' : 'justify-between'}`}>
              <div className={`flex items-center ${navCollapsed ? '' : 'gap-3'}`}>
                <div className="relative">
                  <img
                    src="/Logo.jpg"
                    alt="Israeli Radio Manager"
                    className={`transition-all duration-300 ${navCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`}
                  />
                  <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl -z-10" />
                </div>
                {!navCollapsed && (
                  <div>
                    <h1 className="font-bold text-dark-100">{t('app.name')}</h1>
                    <p className="text-xs text-dark-400">{t('app.tagline')}</p>
                  </div>
                )}
              </div>
              <button
                onClick={toggleNav}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                {navCollapsed ? (
                  isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />
                ) : (
                  isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />
                )}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''} ${navCollapsed ? 'justify-center px-2' : ''}`}
                  title={navCollapsed ? item.label : undefined}
                >
                  <Icon size={20} className={isActive ? 'text-primary-400' : ''} />
                  {!navCollapsed && <span className="font-medium">{item.label}</span>}
                </Link>
              )
            })}
          </div>

          {/* Language Toggle */}
          <div className={`border-t border-white/5 ${navCollapsed ? 'p-2' : 'p-4'}`}>
            <button
              onClick={toggleLanguage}
              className={`flex items-center text-dark-400 hover:text-dark-100 transition-colors ${navCollapsed ? 'justify-center w-full p-2' : 'gap-2'}`}
              title={navCollapsed ? (i18n.language === 'en' ? 'עברית' : 'English') : undefined}
            >
              <Globe size={20} />
              {!navCollapsed && <span>{i18n.language === 'en' ? 'עברית' : 'English'}</span>}
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main dir={isRTL ? 'rtl' : 'ltr'} className="relative flex-1 overflow-auto flex flex-col min-w-0">
          <div className="flex-1 overflow-auto">
            {children}
          </div>

          {/* Audio Player - Fixed at bottom */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-dark-900/80 backdrop-blur-sm">
            <AudioPlayer
              track={currentTrack}
              onTrackEnd={playNext}
              onNext={playNext}
            />
          </div>

          {/* Copyright Footer */}
          <div className="flex-shrink-0 px-4 py-2 border-t border-white/5 bg-dark-900/50">
            <p className="text-base text-center text-dark-500">
              Powered by <a href="https://olorin.ai" target="_blank" rel="noopener noreferrer" className="text-purple-500 font-medium hover:text-purple-400 transition-colors">Olorin.ai LLC</a> © 2026 All rights reserved
            </p>
          </div>
        </main>
      </div>

      {/* Chat Sidebar Toggle Button - Always on right edge */}
      <button
        onClick={() => setChatExpanded(!chatExpanded)}
        className={`fixed right-0 rounded-l-xl top-1/2 -translate-y-1/2 z-40
          glass-button-primary p-3 shadow-glow
          ${chatExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          flex items-center gap-2 transition-all duration-300`}
        title={t('chat.expand')}
      >
        <MessageCircle size={24} />
        <span className="text-sm font-medium hidden md:inline">
          {isRTL ? 'דבר עם הסוכן' : 'Chat'}
        </span>
      </button>

      {/* Chat Sidebar Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          chatExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setChatExpanded(false)}
      />

      {/* Chat Sidebar */}
      <ChatSidebar
        expanded={chatExpanded}
        onToggle={() => setChatExpanded(!chatExpanded)}
        width={chatPanelWidth}
        onResizeStart={handleChatResizeStart}
      />
    </div>
  )
}

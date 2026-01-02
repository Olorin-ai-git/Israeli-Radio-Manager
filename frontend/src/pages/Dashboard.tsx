import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, GripVertical, GripHorizontal } from 'lucide-react'
import {
  CompactNowPlayingBar,
  PlaybackQueueWidget,
  CampaignStatusWidget,
  QuickStatsWidget,
  UpcomingScheduleWidget,
  AgentStatusWidget,
  RecentActivityWidget,
} from '../components/Dashboard'

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  className?: string
}

function CollapsibleSection({ title, children, defaultExpanded = true, className = '' }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={`transition-all duration-300 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-dark-800/30 hover:bg-dark-700/30 border border-white/5 transition-colors group"
      >
        <span className="text-xs font-medium text-dark-300 uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp size={14} className="text-dark-400" />
          ) : (
            <ChevronDown size={14} className="text-dark-400" />
          )}
        </div>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

// Horizontal Resizable Divider (between rows)
interface HorizontalDividerProps {
  onResize: (deltaY: number) => void
}

function HorizontalDivider({ onResize }: HorizontalDividerProps) {
  const isDragging = useRef(false)
  const startY = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startY.current = e.clientY
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const deltaY = e.clientY - startY.current
      onResize(deltaY)
      startY.current = e.clientY
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  return (
    <div
      className="h-3 flex items-center justify-center cursor-row-resize group my-1 select-none"
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-1 px-4 py-1 rounded-full bg-dark-800/50 hover:bg-dark-700/50 border border-white/5 transition-all group-hover:border-primary-500/30">
        <GripHorizontal size={14} className="text-dark-500 group-hover:text-primary-400 transition-colors" />
      </div>
    </div>
  )
}

// Vertical Resizable Divider (between columns)
interface VerticalDividerProps {
  onResize: (deltaX: number) => void
}

function VerticalDivider({ onResize }: VerticalDividerProps) {
  const isDragging = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const deltaX = e.clientX - startX.current
      onResize(deltaX)
      startX.current = e.clientX
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  return (
    <div
      className="w-3 flex items-center justify-center cursor-col-resize group mx-1 select-none self-stretch"
      onMouseDown={handleMouseDown}
    >
      <div className="flex flex-col items-center gap-1 px-1 py-4 rounded-full bg-dark-800/50 hover:bg-dark-700/50 border border-white/5 transition-all group-hover:border-primary-500/30">
        <GripVertical size={14} className="text-dark-500 group-hover:text-primary-400 transition-colors" />
      </div>
    </div>
  )
}

// Resizable Row with vertical splitter
interface ResizableRowProps {
  leftWidget: React.ReactNode
  rightWidget: React.ReactNode
  leftWidthPercent: number
  onLeftWidthChange: (percent: number) => void
  minHeight?: number
}

function ResizableRow({ leftWidget, rightWidget, leftWidthPercent, onLeftWidthChange, minHeight = 280 }: ResizableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleVerticalResize = useCallback((deltaX: number) => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const deltaPercent = (deltaX / containerWidth) * 100
    const newPercent = Math.max(20, Math.min(80, leftWidthPercent + deltaPercent))
    onLeftWidthChange(newPercent)
  }, [leftWidthPercent, onLeftWidthChange])

  return (
    <div
      ref={containerRef}
      className="flex items-stretch gap-0 transition-all duration-150"
      style={{ minHeight }}
    >
      {/* Left Widget */}
      <div
        className="flex-shrink-0 transition-all duration-150"
        style={{ width: `${leftWidthPercent}%` }}
      >
        {leftWidget}
      </div>

      {/* Vertical Divider */}
      <VerticalDivider onResize={handleVerticalResize} />

      {/* Right Widget */}
      <div
        className="flex-1 min-w-0 transition-all duration-150"
      >
        {rightWidget}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  // Row heights for horizontal resizable dividers
  const [topRowHeight, setTopRowHeight] = useState(320)
  const [middleRowHeight, setMiddleRowHeight] = useState(280)
  const [bottomRowHeight, setBottomRowHeight] = useState(280)

  // Column widths for vertical resizable dividers (percentages)
  const [topRowLeftWidth, setTopRowLeftWidth] = useState(33)
  const [middleRowLeftWidth, setMiddleRowLeftWidth] = useState(33)
  const [bottomRowLeftWidth, setBottomRowLeftWidth] = useState(33)

  const handleTopRowResize = useCallback((deltaY: number) => {
    setTopRowHeight(prev => Math.max(200, Math.min(600, prev + deltaY)))
  }, [])

  const handleMiddleRowResize = useCallback((deltaY: number) => {
    setMiddleRowHeight(prev => Math.max(200, Math.min(600, prev + deltaY)))
    setBottomRowHeight(prev => Math.max(200, Math.min(600, prev - deltaY)))
  }, [])

  return (
    <div className="p-4 space-y-2">
      {/* Page Title */}
      <h1 className="text-xl font-bold text-dark-100 mb-4">{t('dashboard.title')}</h1>

      {/* Compact Now Playing Bar */}
      <CompactNowPlayingBar />

      {/* Top Row: Queue + Campaigns */}
      <CollapsibleSection title={isRTL ? 'תור ופרסום' : 'Queue & Campaigns'}>
        <ResizableRow
          leftWidget={<PlaybackQueueWidget />}
          rightWidget={<CampaignStatusWidget />}
          leftWidthPercent={topRowLeftWidth}
          onLeftWidthChange={setTopRowLeftWidth}
          minHeight={topRowHeight}
        />
      </CollapsibleSection>

      <HorizontalDivider onResize={handleTopRowResize} />

      {/* Middle Row: Stats + Schedule */}
      <CollapsibleSection title={isRTL ? 'סטטיסטיקות ולוח זמנים' : 'Stats & Schedule'}>
        <ResizableRow
          leftWidget={<QuickStatsWidget />}
          rightWidget={<UpcomingScheduleWidget />}
          leftWidthPercent={middleRowLeftWidth}
          onLeftWidthChange={setMiddleRowLeftWidth}
          minHeight={middleRowHeight}
        />
      </CollapsibleSection>

      <HorizontalDivider onResize={handleMiddleRowResize} />

      {/* Bottom Row: Activity + Agent */}
      <CollapsibleSection title={isRTL ? 'פעילות וסוכן AI' : 'Activity & AI Agent'}>
        <ResizableRow
          leftWidget={<RecentActivityWidget />}
          rightWidget={<AgentStatusWidget />}
          leftWidthPercent={bottomRowLeftWidth}
          onLeftWidthChange={setBottomRowLeftWidth}
          minHeight={bottomRowHeight}
        />
      </CollapsibleSection>
    </div>
  )
}

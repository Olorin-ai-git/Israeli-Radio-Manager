import { useState, useRef, useEffect, useCallback } from 'react'

interface UsePanelResizeOptions {
  initialLeftWidth?: number
  initialRightWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  minRightWidth?: number
  maxRightWidth?: number
}

export function usePanelResize(options: UsePanelResizeOptions = {}) {
  const {
    initialLeftWidth = 320,
    initialRightWidth = 288,
    minLeftWidth = 200,
    maxLeftWidth = 500,
    minRightWidth = 200,
    maxRightWidth = 400,
  } = options

  const [leftPanelWidth, setLeftPanelWidth] = useState(initialLeftWidth)
  const [rightPanelWidth, setRightPanelWidth] = useState(initialRightWidth)
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)

  const isDraggingLeft = useRef(false)
  const isDraggingRight = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const heatmapContainerRef = useRef<HTMLDivElement>(null)

  const handleLeftSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingLeft.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleRightSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRight.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      if (isDraggingLeft.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newWidth = e.clientX - containerRect.left
        setLeftPanelWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth)))
      }

      if (isDraggingRight.current && heatmapContainerRef.current) {
        const heatmapRect = heatmapContainerRef.current.getBoundingClientRect()
        const newWidth = heatmapRect.right - e.clientX
        setRightPanelWidth(Math.max(minRightWidth, Math.min(maxRightWidth, newWidth)))
      }
    }

    const handleMouseUp = () => {
      isDraggingLeft.current = false
      isDraggingRight.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minLeftWidth, maxLeftWidth, minRightWidth, maxRightWidth])

  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelCollapsed(prev => !prev)
  }, [])

  const toggleRightPanel = useCallback(() => {
    setIsRightPanelOpen(prev => !prev)
  }, [])

  return {
    leftPanelWidth,
    rightPanelWidth,
    isLeftPanelCollapsed,
    isRightPanelOpen,
    setIsRightPanelOpen,
    containerRef,
    heatmapContainerRef,
    handleLeftSplitterMouseDown,
    handleRightSplitterMouseDown,
    toggleLeftPanel,
    toggleRightPanel,
  }
}

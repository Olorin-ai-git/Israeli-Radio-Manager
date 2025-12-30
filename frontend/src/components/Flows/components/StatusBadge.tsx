/**
 * Status badge component for flows
 */

import { Loader2 } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  isRunning?: boolean
}

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  disabled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export default function StatusBadge({ status, isRunning }: StatusBadgeProps) {
  const effectiveStatus = isRunning ? 'running' : status
  const colorClass = STATUS_COLORS[effectiveStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.disabled

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${colorClass}`}>
      {(isRunning || effectiveStatus === 'running') && (
        <Loader2 size={10} className="animate-spin" />
      )}
      {effectiveStatus}
    </span>
  )
}

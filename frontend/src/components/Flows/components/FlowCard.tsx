/**
 * Flow card component displaying a single flow with actions and controls
 */

import {
  Play,
  Pause,
  Trash2,
  Edit,
  Loader2,
  RotateCcw,
  Repeat,
} from 'lucide-react'
import { Flow } from '../types'
import ActionIcon from './ActionIcon'
import StatusBadge from './StatusBadge'
import ScheduleDisplay from './ScheduleDisplay'

interface FlowCardProps {
  flow: Flow
  isRTL: boolean
  isRunning: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleStatus: () => void
  onRun: () => void
  onReset: () => void
  onEdit: () => void
  onDelete: () => void
  isToggling?: boolean
  isDeleting?: boolean
  isResetting?: boolean
}

export default function FlowCard({
  flow,
  isRTL,
  isRunning,
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onRun,
  onReset,
  onEdit,
  onDelete,
  isToggling,
  isDeleting,
  isResetting,
}: FlowCardProps) {
  return (
    <div
      className={`glass-card p-3 transition-all ${
        isExpanded ? 'ring-1 ring-primary-500' : ''
      }`}
    >
      {/* Flow Header */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-start"
        >
          <h3 className="font-medium text-dark-100 text-sm truncate" dir="auto">
            {isRTL ? flow.name_he || flow.name : flow.name}
          </h3>
        </button>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {flow.loop && (
            <span className="tooltip-trigger text-primary-400">
              <Repeat size={14} />
              <span className="tooltip tooltip-top">
                {isRTL ? 'זרימה חוזרת' : 'Looping'}
              </span>
            </span>
          )}
          <StatusBadge status={flow.status} isRunning={isRunning} />
        </div>
      </div>

      {/* Actions Preview */}
      <div className="flex items-center gap-1 mb-2">
        {(flow.actions || []).slice(0, 4).map((action, idx) => {
          let tooltip = action.description || action.action_type
          if (action.genre) tooltip += ` (${action.genre})`
          if (action.duration_minutes) tooltip += ` - ${action.duration_minutes} min`
          if (action.commercial_count) tooltip += ` (${action.commercial_count} ads)`

          return (
            <div
              key={idx}
              className="w-6 h-6 rounded bg-dark-700/50 flex items-center justify-center hover:bg-dark-700 transition-colors cursor-help tooltip-trigger"
            >
              <ActionIcon type={action.action_type} />
              <div className="tooltip tooltip-top">{tooltip}</div>
            </div>
          )
        })}
        {(flow.actions || []).length > 4 && (
          <span className="text-xs text-dark-400">+{(flow.actions || []).length - 4}</span>
        )}
      </div>

      {/* Schedule Info */}
      {flow.schedule && (
        <ScheduleDisplay schedule={flow.schedule} isRTL={isRTL} />
      )}

      {/* Expanded Details */}
      {isExpanded && (
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
            {(flow.actions || []).map((action, idx) => (
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
        {/* Toggle Status Button */}
        <div className="tooltip-trigger flex-1">
          <button
            onClick={onToggleStatus}
            disabled={isToggling}
            className="w-full glass-button py-1.5 text-xs flex items-center justify-center gap-1"
          >
            {isToggling ? (
              <Loader2 size={12} className="animate-spin" />
            ) : flow.status === 'active' ? (
              <Pause size={12} />
            ) : (
              <Play size={12} />
            )}
          </button>
          <div className="tooltip tooltip-top">
            {flow.status === 'active' ? (isRTL ? 'השהה' : 'Pause') : (isRTL ? 'הפעל' : 'Enable')}
          </div>
        </div>

        {/* Run/Reset Button */}
        {flow.status === 'running' ? (
          <div className="tooltip-trigger flex-1">
            <button
              onClick={onReset}
              disabled={isResetting}
              className="w-full glass-button py-1.5 text-xs flex items-center justify-center gap-1 text-yellow-400 hover:bg-yellow-500/20"
            >
              {isResetting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RotateCcw size={12} />
              )}
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'אפס סטטוס' : 'Reset Status'}
            </div>
          </div>
        ) : (
          <div className="tooltip-trigger flex-1">
            <button
              onClick={onRun}
              disabled={isRunning}
              className="w-full glass-button py-1.5 text-xs flex items-center justify-center gap-1 text-green-400 hover:bg-green-500/20"
            >
              {isRunning ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'הפעל עכשיו' : 'Run Now'}
            </div>
          </div>
        )}

        {/* Edit Button */}
        <div className="tooltip-trigger">
          <button
            onClick={onEdit}
            className="glass-button py-1.5 px-2 text-xs text-blue-400 hover:bg-blue-500/20"
          >
            <Edit size={12} />
          </button>
          <div className="tooltip tooltip-top">
            {isRTL ? 'ערוך' : 'Edit'}
          </div>
        </div>

        {/* Delete Button */}
        <div className="tooltip-trigger">
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="glass-button py-1.5 px-2 text-xs text-red-400 hover:bg-red-500/20"
          >
            {isDeleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
          <div className="tooltip tooltip-top">
            {isRTL ? 'מחק' : 'Delete'}
          </div>
        </div>
      </div>
    </div>
  )
}

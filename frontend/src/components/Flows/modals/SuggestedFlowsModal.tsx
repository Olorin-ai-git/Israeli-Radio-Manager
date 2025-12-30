/**
 * Modal showing suggested pre-built flows
 */

import { Sparkles, X, Calendar, Hand } from 'lucide-react'
import { SuggestedFlow } from '../types'
import { SUGGESTED_FLOWS } from '../constants'
import ActionIcon from '../components/ActionIcon'

interface SuggestedFlowsModalProps {
  isOpen: boolean
  isRTL: boolean
  onClose: () => void
  onSelect: (flow: SuggestedFlow) => void
}

export default function SuggestedFlowsModal({
  isOpen,
  isRTL,
  onClose,
  onSelect,
}: SuggestedFlowsModalProps) {
  if (!isOpen) return null

  return (
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
            onClick={onClose}
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
              onClick={() => onSelect(suggested)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-dark-100" dir="auto">
                  {isRTL ? suggested.name_he : suggested.name}
                </h4>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  suggested.trigger_type === 'scheduled'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {suggested.trigger_type === 'scheduled' ? (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {isRTL ? 'מתוזמן' : 'Scheduled'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Hand size={10} />
                      {isRTL ? 'ידני' : 'Manual'}
                    </span>
                  )}
                </span>
              </div>

              <p className="text-xs text-dark-400 mb-3" dir="auto">
                {isRTL ? suggested.description_he : suggested.description}
              </p>

              <div className="flex items-center gap-1">
                {suggested.actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded bg-dark-700/50 flex items-center justify-center"
                    title={action.description}
                  >
                    <ActionIcon type={action.action_type} />
                  </div>
                ))}
              </div>

              {suggested.schedule && (
                <div className="mt-2 flex items-center gap-1 text-xs text-dark-500">
                  <Calendar size={12} />
                  <span>{suggested.schedule.start_time}</span>
                  {suggested.schedule.end_time && (
                    <>
                      <span>-</span>
                      <span>{suggested.schedule.end_time}</span>
                    </>
                  )}
                  {suggested.schedule.recurrence !== 'none' && (
                    <span className="ml-1 px-1 py-0.5 bg-primary-500/20 text-primary-400 rounded text-[10px]">
                      {suggested.schedule.recurrence}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

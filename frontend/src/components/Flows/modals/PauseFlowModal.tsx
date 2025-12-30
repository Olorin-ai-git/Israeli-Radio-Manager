/**
 * Confirmation modal for pausing a flow
 */

import { Pause } from 'lucide-react'
import { Flow } from '../types'

interface PauseFlowModalProps {
  flow: Flow | null
  isRTL: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function PauseFlowModal({
  flow,
  isRTL,
  onConfirm,
  onCancel,
}: PauseFlowModalProps) {
  if (!flow) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="glass-card p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/20 rounded-xl">
            <Pause size={24} className="text-yellow-400" />
          </div>
          <h3 className="font-semibold text-dark-100 text-lg">
            {isRTL ? 'השהיית זרימה' : 'Pause Flow'}
          </h3>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-dark-200">
            {isRTL
              ? `האם אתה בטוח שברצונך להשהות את "${flow.name}"?`
              : `Are you sure you want to pause "${flow.name}"?`}
          </p>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-200">
              {isRTL
                ? 'השהיית זרימה תבצע את הפעולות הבאות:'
                : 'Pausing this flow will:'}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-dark-300" dir={isRTL ? 'rtl' : 'ltr'}>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">•</span>
                <span>
                  {isRTL
                    ? 'מחק את האירוע מיומן Google Calendar'
                    : 'Delete the event from Google Calendar'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">•</span>
                <span>
                  {isRTL
                    ? 'הזרימה לא תרוץ אוטומטית בזמן המתוכנן'
                    : 'The flow will not run automatically at scheduled times'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">•</span>
                <span>
                  {isRTL
                    ? 'תוכל להפעיל מחדש בכל עת'
                    : 'You can re-enable it at any time'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 glass-button py-2"
          >
            {isRTL ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 glass-button py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 flex items-center justify-center gap-2"
          >
            <Pause size={16} />
            <span>{isRTL ? 'השהה' : 'Pause'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

import { Select } from '../Form'

interface JingleSettingsProps {
  isRTL: boolean
  useOpeningJingle: boolean
  setUseOpeningJingle: (value: boolean) => void
  openingJingleId: string
  setOpeningJingleId: (value: string) => void
  useClosingJingle: boolean
  setUseClosingJingle: (value: boolean) => void
  closingJingleId: string
  setClosingJingleId: (value: string) => void
  jingles: Array<{ _id: string; title: string }>
  onSettingsChange: () => void
  isDirty: boolean
}

export default function JingleSettings({
  isRTL,
  useOpeningJingle,
  setUseOpeningJingle,
  openingJingleId,
  setOpeningJingleId,
  useClosingJingle,
  setUseClosingJingle,
  closingJingleId,
  setClosingJingleId,
  jingles,
  onSettingsChange,
  isDirty,
}: JingleSettingsProps) {
  return (
    <div className="mb-4 pb-4 border-b border-white/10">
      <h4 className="text-xs text-dark-400 mb-3">
        {isRTL ? 'הגדרות ג׳ינגל פרסומות' : 'Commercial Jingle Settings'}
        {isDirty && <span className="text-yellow-400 ml-1">*</span>}
      </h4>

      {/* Opening Jingle */}
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-1">
          <button
            onClick={() => {
              setUseOpeningJingle(!useOpeningJingle)
              onSettingsChange()
            }}
            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
              useOpeningJingle
                ? 'bg-primary-500 border-primary-500'
                : 'border-dark-500 hover:border-primary-500/50'
            }`}
          >
            {useOpeningJingle && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-xs text-dark-200">
            {isRTL ? 'ג׳ינגל פתיחה (לפני פרסומות)' : 'Opening jingle (before commercials)'}
          </span>
        </div>
        {useOpeningJingle && (
          <div className="ml-6">
            <Select
              value={openingJingleId}
              onChange={(value) => {
                setOpeningJingleId(value)
                onSettingsChange()
              }}
              placeholder={isRTL ? 'בחר ג׳ינגל' : 'Select jingle'}
              options={jingles.length === 0
                ? [{ value: '', label: isRTL ? 'אין ג׳ינגלים זמינים' : 'No jingles available' }]
                : jingles.map((jingle) => ({
                    value: jingle._id,
                    label: jingle.title
                  }))
              }
            />
          </div>
        )}
      </div>

      {/* Closing Jingle */}
      <div>
        <div className="flex items-start gap-2 mb-1">
          <button
            onClick={() => {
              setUseClosingJingle(!useClosingJingle)
              onSettingsChange()
            }}
            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
              useClosingJingle
                ? 'bg-primary-500 border-primary-500'
                : 'border-dark-500 hover:border-primary-500/50'
            }`}
          >
            {useClosingJingle && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-xs text-dark-200">
            {isRTL ? 'ג׳ינגל סיום (אחרי פרסומות)' : 'Closing jingle (after commercials)'}
          </span>
        </div>
        {useClosingJingle && (
          <div className="ml-6">
            <Select
              value={closingJingleId}
              onChange={(value) => {
                setClosingJingleId(value)
                onSettingsChange()
              }}
              placeholder={isRTL ? 'בחר ג׳ינגל' : 'Select jingle'}
              options={jingles.length === 0
                ? [{ value: '', label: isRTL ? 'אין ג׳ינגלים זמינים' : 'No jingles available' }]
                : jingles.map((jingle) => ({
                    value: jingle._id,
                    label: jingle.title
                  }))
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

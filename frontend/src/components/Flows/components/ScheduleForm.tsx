/**
 * Schedule configuration form component
 * Used in both Create and Edit flow modals
 */

import { RecurrenceType, FlowSchedule } from '../types'
import { Checkbox } from '../../Form'

interface ScheduleFormProps {
  isRTL: boolean
  recurrenceType: RecurrenceType
  onRecurrenceTypeChange: (type: RecurrenceType) => void
  schedule?: Partial<FlowSchedule>
  onScheduleChange?: (schedule: Partial<FlowSchedule>) => void
  showLoop?: boolean
  loop?: boolean
  onLoopChange?: (loop: boolean) => void
}

const DAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
}

const MONTH_NAMES = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
}

export default function ScheduleForm({
  isRTL,
  recurrenceType,
  onRecurrenceTypeChange,
  schedule = {},
  onScheduleChange,
  showLoop = true,
  loop = false,
  onLoopChange,
}: ScheduleFormProps) {
  const lang = isRTL ? 'he' : 'en'

  const handleFieldChange = (field: string, value: any) => {
    if (onScheduleChange) {
      onScheduleChange({ ...schedule, [field]: value })
    }
  }

  return (
    <div className="space-y-3 p-3 bg-dark-800/30 rounded-lg">
      <p className="text-xs text-dark-400">
        {isRTL ? 'הגדרות תזמון' : 'Schedule Settings'}
      </p>

      {/* Recurrence Type */}
      <div>
        <label className="block text-dark-300 text-xs mb-1">
          {isRTL ? 'חזרה' : 'Repeat'}
        </label>
        <select
          value={recurrenceType}
          onChange={(e) => onRecurrenceTypeChange(e.target.value as RecurrenceType)}
          className="w-full glass-input text-sm"
        >
          <option value="none">{isRTL ? 'פעם אחת / מרובה ימים' : 'Once / Multi-day'}</option>
          <option value="daily">{isRTL ? 'יומי' : 'Daily'}</option>
          <option value="weekly">{isRTL ? 'שבועי' : 'Weekly'}</option>
          <option value="monthly">{isRTL ? 'חודשי' : 'Monthly'}</option>
          <option value="yearly">{isRTL ? 'שנתי' : 'Yearly'}</option>
        </select>
      </div>

      {/* One-time/Multi-day: Datetime pickers */}
      {recurrenceType === 'none' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-dark-300 text-xs mb-1">
                {isRTL ? 'תחילה' : 'Start Date & Time'}
              </label>
              <input
                type="datetime-local"
                name="start_datetime"
                defaultValue={schedule.start_datetime}
                onChange={(e) => handleFieldChange('start_datetime', e.target.value)}
                className="w-full glass-input text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-dark-300 text-xs mb-1">
                {isRTL ? 'סיום' : 'End Date & Time'}
              </label>
              <input
                type="datetime-local"
                name="end_datetime"
                defaultValue={schedule.end_datetime}
                onChange={(e) => handleFieldChange('end_datetime', e.target.value)}
                className="w-full glass-input text-sm"
                required
              />
            </div>
          </div>
          <p className="text-xs text-dark-500 italic">
            {isRTL
              ? 'ניתן ליצור זרימה שנמשכת מספר ימים'
              : 'Create multi-day flows by setting start and end date+time'}
          </p>
        </>
      )}

      {/* Recurring events: Time pickers */}
      {recurrenceType !== 'none' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-dark-300 text-xs mb-1">
              {isRTL ? 'שעת התחלה' : 'Start Time'} *
            </label>
            <input
              type="time"
              name="start_time"
              defaultValue={schedule.start_time || '09:00'}
              onChange={(e) => handleFieldChange('start_time', e.target.value)}
              className="w-full glass-input text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-dark-300 text-xs mb-1">
              {isRTL ? 'שעת סיום' : 'End Time'} *
            </label>
            <input
              type="time"
              name="end_time"
              defaultValue={schedule.end_time}
              onChange={(e) => handleFieldChange('end_time', e.target.value)}
              className="w-full glass-input text-sm"
              required
            />
          </div>
        </div>
      )}

      {/* Weekly: Day selector */}
      {recurrenceType === 'weekly' && (
        <div>
          <label className="block text-dark-300 text-xs mb-2">
            {isRTL ? 'ימים' : 'Days'}
          </label>
          <div className="flex flex-wrap gap-1">
            {DAY_NAMES[lang].map((day, idx) => (
              <Checkbox
                key={idx}
                name={`day_${idx}`}
                label={day}
                defaultChecked={schedule.days_of_week?.includes(idx) ?? true}
                className="text-xs"
              />
            ))}
          </div>
        </div>
      )}

      {/* Monthly: Day of month */}
      {recurrenceType === 'monthly' && (
        <div>
          <label className="block text-dark-300 text-xs mb-1">
            {isRTL ? 'יום בחודש' : 'Day of Month'}
          </label>
          <select
            name="day_of_month"
            defaultValue={schedule.day_of_month || 1}
            onChange={(e) => handleFieldChange('day_of_month', parseInt(e.target.value))}
            className="w-full glass-input text-sm"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {/* Yearly: Month and day */}
      {recurrenceType === 'yearly' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-dark-300 text-xs mb-1">
              {isRTL ? 'חודש' : 'Month'}
            </label>
            <select
              name="month"
              defaultValue={schedule.month || 1}
              onChange={(e) => handleFieldChange('month', parseInt(e.target.value))}
              className="w-full glass-input text-sm"
            >
              {MONTH_NAMES[lang].map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-dark-300 text-xs mb-1">
              {isRTL ? 'יום' : 'Day'}
            </label>
            <select
              name="day_of_month"
              defaultValue={schedule.day_of_month || 1}
              onChange={(e) => handleFieldChange('day_of_month', parseInt(e.target.value))}
              className="w-full glass-input text-sm"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Loop Option */}
      {showLoop && (
        <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg mt-3">
          <Checkbox
            name="loop"
            checked={loop}
            onChange={(e) => onLoopChange?.(e.target.checked)}
            label={isRTL ? 'חזור על הפעולות עד סוף הזמן' : 'Repeat actions until end time'}
            description={isRTL
              ? 'אם מוגדר זמן סיום, הזרימה תחזור על כל הפעולות עד שהזמן יגמר'
              : 'If an end time is set, the flow will repeat all actions until that time'}
          />
        </div>
      )}
    </div>
  )
}

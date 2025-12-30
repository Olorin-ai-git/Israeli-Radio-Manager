/**
 * Schedule display component for showing flow schedule information
 */

import { Calendar } from 'lucide-react'
import { FlowSchedule } from '../types'

interface ScheduleDisplayProps {
  schedule: FlowSchedule
  isRTL: boolean
}

const DAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  he: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
}

const MONTH_NAMES = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
}

const RECURRENCE_LABELS = {
  daily: { en: 'Daily', he: 'יומי' },
  weekly: { en: 'Weekly', he: 'שבועי' },
  monthly: { en: 'Monthly', he: 'חודשי' },
  yearly: { en: 'Yearly', he: 'שנתי' },
}

export default function ScheduleDisplay({ schedule, isRTL }: ScheduleDisplayProps) {
  const lang = isRTL ? 'he' : 'en'

  return (
    <div className="flex flex-col gap-1 mb-2">
      <div className="flex items-center gap-1 text-xs text-dark-400">
        <Calendar size={12} />
        {schedule.recurrence === 'none' && schedule.start_datetime && schedule.end_datetime ? (
          // One-time/multi-day flow: show datetime range
          <>
            <span className="text-[10px]">
              {new Date(schedule.start_datetime).toLocaleDateString()}{' '}
              {new Date(schedule.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>→</span>
            <span className="text-[10px]">
              {new Date(schedule.end_datetime).toLocaleDateString()}{' '}
              {new Date(schedule.end_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        ) : (
          // Recurring flow: show time range
          <>
            <span>{schedule.start_time}</span>
            {schedule.end_time && <span>- {schedule.end_time}</span>}
            {schedule.recurrence && schedule.recurrence !== 'none' && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded text-[10px]">
                {RECURRENCE_LABELS[schedule.recurrence]?.[lang] || schedule.recurrence}
              </span>
            )}
          </>
        )}
      </div>

      {/* Show specific days for weekly recurrence */}
      {schedule.recurrence === 'weekly' && schedule.days_of_week && schedule.days_of_week.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-dark-500 ml-4">
          {schedule.days_of_week.map((day: number) => (
            <span key={day} className="px-1 py-0.5 bg-dark-700/50 rounded">
              {DAY_NAMES[lang][day]}
            </span>
          ))}
        </div>
      )}

      {/* Show day of month for monthly recurrence */}
      {schedule.recurrence === 'monthly' && schedule.day_of_month && (
        <div className="text-[10px] text-dark-500 ml-4">
          {isRTL ? `יום ${schedule.day_of_month} בחודש` : `Day ${schedule.day_of_month} of month`}
        </div>
      )}

      {/* Show month and day for yearly recurrence */}
      {schedule.recurrence === 'yearly' && schedule.month && schedule.day_of_month && (
        <div className="text-[10px] text-dark-500 ml-4">
          {MONTH_NAMES[lang][schedule.month - 1]} {schedule.day_of_month}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Music,
  Radio,
  Megaphone,
  Clock,
  Trash2,
  Plus,
  Loader2,
  X,
  RefreshCw,
  Repeat
} from 'lucide-react'
import { api } from '../services/api'
import { toast } from '../store/toastStore'
import Checkbox from '../components/Form/Checkbox'
import { Select } from '../components/Form'
import { useDemoMode } from '../hooks/useDemoMode'

interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
  htmlLink?: string
  recurrence?: string[]
  extendedProperties?: {
    private?: {
      radio_content_id?: string
      radio_content_type?: string
      radio_managed?: string
    }
  }
}

interface WeekSchedule {
  [date: string]: {
    date: string
    day_name: string
    day_name_he: string
    events: CalendarEvent[]
  }
}

const ContentTypeIcon = ({ type }: { type?: string }) => {
  switch (type) {
    case 'song':
      return <Music size={16} className="text-blue-400" />
    case 'show':
      return <Radio size={16} className="text-green-400" />
    case 'commercial':
      return <Megaphone size={16} className="text-orange-400" />
    default:
      return <Music size={16} className="text-dark-400" />
  }
}

export default function CalendarPlaylist() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRTL = i18n.language === 'he'
  const { canWrite } = useDemoMode()

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? 0 : -dayOfWeek // Start week on Sunday
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  })

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleType, setScheduleType] = useState<'content' | 'flow'>('content')
  const [selectedContentId, setSelectedContentId] = useState<string>('')
  const [selectedFlowId, setSelectedFlowId] = useState<string>('')
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [_preselectedDate, setPreselectedDate] = useState<string>('')
  void _preselectedDate // Planned feature: pre-fill date in schedule modal
  const [scheduleRecurrence, setScheduleRecurrence] = useState<'none' | 'daily' | 'weekly'>('none')
  const [scheduleDaysOfWeek, setScheduleDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  const formatDateForApi = (date: Date) => {
    // Use local date, not UTC
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fetch week schedule
  const { data: weekSchedule, isLoading, refetch } = useQuery<WeekSchedule>({
    queryKey: ['weekSchedule', formatDateForApi(currentWeekStart)],
    queryFn: () => api.getWeekSchedule(formatDateForApi(currentWeekStart)),
  })

  // Fetch content for scheduling
  const { data: allContent } = useQuery({
    queryKey: ['allContent'],
    queryFn: () => api.getContent(),
  })

  // Fetch flows for scheduling
  const { data: allFlows } = useQuery({
    queryKey: ['flows'],
    queryFn: () => api.getFlows(),
  })

  // Fetch commercials for batch info
  const { data: commercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: () => api.getCommercials(),
  })

  // Filter content based on type and genre
  const filteredContent = (Array.isArray(allContent) ? allContent : []).filter((content: any) => {
    if (contentTypeFilter !== 'all' && content.type !== contentTypeFilter) {
      return false
    }
    if (genreFilter !== 'all' && content.genre !== genreFilter) {
      return false
    }
    return true
  })

  // Get unique genres from content
  const genres = [...new Set((Array.isArray(allContent) ? allContent : []).map((c: any) => c.genre).filter(Boolean))] as string[]

  // Get commercial batches
  const commercialBatches = [...new Set((Array.isArray(commercials) ? commercials : []).map((c: any) => c.batch_number).filter((b: number) => b))] as number[]

  // Delete event mutation
  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => api.deleteCalendarEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekSchedule'] })
      setSelectedEvent(null)
    },
  })

  // Create event mutation
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createCalendarEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekSchedule'] })
      refetch()
      setShowScheduleModal(false)
      setSelectedContentId('')
      setSelectedFlowId('')
      setScheduleError(null)
      setScheduleType('content')
      setContentTypeFilter('all')
      setGenreFilter('all')
      setScheduleRecurrence('none')
      setScheduleDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error.message || 'Failed to schedule content'
      setScheduleError(message)
    },
  })

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
      return newDate
    })
  }

  const goToToday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? 0 : -dayOfWeek
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)
    setCurrentWeekStart(weekStart)
  }

  const formatTime = (dateTimeStr: string | undefined) => {
    if (!dateTimeStr) return ''
    const date = new Date(dateTimeStr)
    return date.toLocaleTimeString(i18n.language === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getWeekDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  const handleScheduleContent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Block in demo mode
    if (!canWrite) {
      toast.info(t('demo.cannotModifyCalendar'))
      return
    }

    const formData = new FormData(e.currentTarget)

    if (scheduleType === 'flow') {
      // Schedule a flow execution
      const flowId = selectedFlowId
      if (!flowId) return

      // For flows, we just trigger them to run (flows handle their own scheduling)
      // This creates a calendar marker for when the flow will run
      if (scheduleRecurrence === 'none') {
        const startDatetime = formData.get('start_datetime') as string
        if (!startDatetime) return
        const startTime = new Date(startDatetime)

        createMutation.mutate({
          flow_id: flowId,
          start_time: startTime.toISOString(),
          reminder_minutes: 30,
          reminder_method: 'popup',
        })
      } else {
        const time = formData.get('time') as string
        if (!time) return

        const today = new Date()
        const [hours, minutes] = time.split(':')
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        const eventData: any = {
          flow_id: flowId,
          start_time: today.toISOString(),
          reminder_minutes: 30,
          reminder_method: 'popup',
          recurrence: scheduleRecurrence,
        }

        if (scheduleRecurrence === 'weekly') {
          eventData.days_of_week = scheduleDaysOfWeek
        }

        createMutation.mutate(eventData)
      }
    } else {
      // Schedule content
      const contentId = selectedContentId
      if (!contentId) return

      if (scheduleRecurrence === 'none') {
        // One-time event: use datetime-local
        const startDatetime = formData.get('start_datetime') as string
        if (!startDatetime) return

        const startTime = new Date(startDatetime)

        createMutation.mutate({
          content_id: contentId,
          start_time: startTime.toISOString(),
          reminder_minutes: 30,
          reminder_method: 'popup',
        })
      } else {
        // Recurring event: use time with recurrence
        const time = formData.get('time') as string
        if (!time) return

        // Use today's date as the starting point
        const today = new Date()
        const [hours, minutes] = time.split(':')
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        const eventData: any = {
          content_id: contentId,
          start_time: today.toISOString(),
          reminder_minutes: 30,
          reminder_method: 'popup',
          recurrence: scheduleRecurrence,
        }

        if (scheduleRecurrence === 'weekly') {
          eventData.days_of_week = scheduleDaysOfWeek
        }

        createMutation.mutate(eventData)
      }
    }
  }

  const handleDayDoubleClick = (date: Date) => {
    const dateStr = formatDateForApi(date)
    setPreselectedDate(dateStr)
    setShowScheduleModal(true)
    setScheduleError(null)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-100">
            {isRTL ? 'לוח שידורים' : 'Broadcast Schedule'}
          </h1>
          <p className="text-dark-400 text-sm">
            {isRTL ? 'תזמון תוכן מיומן Google' : 'Content schedule from Google Calendar'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="tooltip-trigger">
            <button
              onClick={() => refetch()}
              className="glass-button p-2"
            >
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <div className="tooltip tooltip-bottom">
              {isRTL ? 'רענן' : 'Refresh'}
            </div>
          </div>

          <button
            onClick={() => {
              setPreselectedDate('')
              setShowScheduleModal(true)
              setScheduleError(null)
              setScheduleType('content')
              setContentTypeFilter('all')
              setGenreFilter('all')
              setSelectedContentId('')
              setSelectedFlowId('')
            }}
            className="glass-button-primary flex items-center gap-2 px-4 py-2"
          >
            <Plus size={20} />
            <span>{isRTL ? 'הוסף לתזמון' : 'Add to Schedule'}</span>
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            className="glass-button p-2"
          >
            {isRTL ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          <div className="flex items-center gap-4">
            <Calendar size={20} className="text-primary-400" />
            <span className="text-dark-100 font-medium">
              {currentWeekStart.toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', {
                month: 'long',
                day: 'numeric',
              })}
              {' - '}
              {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString(
                i18n.language === 'he' ? 'he-IL' : 'en-US',
                { month: 'long', day: 'numeric', year: 'numeric' }
              )}
            </span>
            <button
              onClick={goToToday}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              {isRTL ? 'היום' : 'Today'}
            </button>
          </div>

          <button
            onClick={() => navigateWeek('next')}
            className="glass-button p-2"
          >
            {isRTL ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </div>

      {/* Week Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary-400" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {getWeekDates().map((date) => {
            const dateKey = formatDateForApi(date)
            const dayData = weekSchedule?.[dateKey]
            const events = dayData?.events || []

            return (
              <div
                key={dateKey}
                onDoubleClick={() => handleDayDoubleClick(date)}
                className={`glass-card p-4 min-h-[400px] cursor-pointer hover:bg-white/5 transition-colors ${
                  isToday(date) ? 'ring-2 ring-primary-500' : ''
                } group`}
              >
                {/* Day Header */}
                <div className="text-center mb-4 pb-2 border-b border-white/10">
                  <p className="text-xs text-dark-400 uppercase">
                    {isRTL ? dayData?.day_name_he : dayData?.day_name || date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-bold ${isToday(date) ? 'text-primary-400' : 'text-dark-100'}`}>
                    {date.getDate()}
                  </p>
                </div>

                {/* Events */}
                <div className="space-y-2">
                  {events.length === 0 ? (
                    <p className="text-dark-500 text-xs text-center py-4">
                      {isRTL ? 'אין אירועים' : 'No events'}
                    </p>
                  ) : (
                    events.map((event) => {
                      const contentType = event.extendedProperties?.private?.radio_content_type
                      const isRecurring = event.recurrence && event.recurrence.length > 0
                      return (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={`w-full text-start p-2 rounded-lg transition-all hover:bg-white/10 ${
                            selectedEvent?.id === event.id ? 'bg-primary-500/20 ring-1 ring-primary-500' : 'bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <ContentTypeIcon type={contentType} />
                            <span className="text-xs text-dark-400">
                              {formatTime(event.start.dateTime)}
                            </span>
                            {isRecurring && (
                              <span className="tooltip-trigger">
                                <Repeat size={12} className="text-primary-400" />
                                <span className="tooltip tooltip-top">{isRTL ? 'אירוע חוזר' : 'Recurring event'}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-dark-100 truncate" dir="auto">
                            {event.summary}
                          </p>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Event Details Sidebar */}
      {selectedEvent && (
        <div className="fixed right-0 top-0 h-full w-80 glass-sidebar z-[100] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-dark-100">
              {isRTL ? 'פרטי אירוע' : 'Event Details'}
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-dark-400 text-xs mb-1">
                {isRTL ? 'כותרת' : 'Title'}
              </p>
              <p className="text-dark-100" dir="auto">{selectedEvent.summary}</p>
            </div>

            <div className="flex items-center gap-2">
              <Clock size={16} className="text-dark-400" />
              <span className="text-dark-200">
                {formatTime(selectedEvent.start.dateTime)}
                {selectedEvent.end.dateTime && ` - ${formatTime(selectedEvent.end.dateTime)}`}
              </span>
            </div>

            {selectedEvent.description && (
              <div>
                <p className="text-dark-400 text-xs mb-1">
                  {isRTL ? 'תיאור' : 'Description'}
                </p>
                <p className="text-dark-300 text-sm whitespace-pre-wrap" dir="auto">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            {selectedEvent.htmlLink && (
              <a
                href={selectedEvent.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-2"
              >
                {isRTL ? 'פתח ב-Google Calendar' : 'Open in Google Calendar'}
              </a>
            )}

            <div className="pt-4 border-t border-white/10 flex gap-2">
              {canWrite ? (
                <button
                  onClick={() => deleteMutation.mutate(selectedEvent.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 glass-button text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-2 py-2"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  <span>{isRTL ? 'מחק' : 'Delete'}</span>
                </button>
              ) : (
                <button
                  onClick={() => toast.info(t('demo.cannotModifyCalendar'))}
                  className="flex-1 glass-button text-dark-500 cursor-not-allowed flex items-center justify-center gap-2 py-2 opacity-50"
                >
                  <Trash2 size={16} />
                  <span>{isRTL ? 'מחק' : 'Delete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'תזמון תוכן' : 'Schedule Content'}
              </h3>
              <button
                onClick={() => {
                  setShowScheduleModal(false)
                  setScheduleRecurrence('none')
                  setScheduleDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
                  setScheduleError(null)
                  setScheduleType('content')
                  setContentTypeFilter('all')
                  setGenreFilter('all')
                  setSelectedContentId('')
                  setSelectedFlowId('')
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleScheduleContent} className="space-y-4">
              {scheduleError && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {scheduleError}
                </div>
              )}

              {/* Schedule Type Selection */}
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  {isRTL ? 'סוג תזמון' : 'Schedule Type'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleType('content')
                      setSelectedFlowId('')
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors ${
                      scheduleType === 'content'
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                        : 'glass-button'
                    }`}
                  >
                    {isRTL ? 'תוכן' : 'Content'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleType('flow')
                      setSelectedContentId('')
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors ${
                      scheduleType === 'flow'
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                        : 'glass-button'
                    }`}
                  >
                    {isRTL ? 'תזרים' : 'Flow'}
                  </button>
                </div>
              </div>

              {/* Content Selection */}
              {scheduleType === 'content' && (
                <>
                  {/* Content Type Filter */}
                  <div>
                    <Select
                      label={isRTL ? 'סוג תוכן' : 'Content Type'}
                      value={contentTypeFilter}
                      onChange={(value) => {
                        setContentTypeFilter(value)
                        setGenreFilter('all')
                      }}
                      options={[
                        { value: 'all', label: isRTL ? 'הכל' : 'All' },
                        { value: 'song', label: isRTL ? 'שירים' : 'Songs' },
                        { value: 'show', label: isRTL ? 'תוכניות' : 'Shows' },
                        { value: 'commercial', label: isRTL ? 'פרסומות' : 'Commercials' }
                      ]}
                    />
                  </div>

                  {/* Genre Filter (only for songs) */}
                  {contentTypeFilter !== 'commercial' && (
                    <div>
                      <Select
                        label={isRTL ? 'ז׳אנר' : 'Genre'}
                        value={genreFilter}
                        onChange={setGenreFilter}
                        options={[
                          { value: 'all', label: isRTL ? 'כל הז׳אנרים' : 'All Genres' },
                          ...genres.map((genre) => ({
                            value: genre,
                            label: genre
                          }))
                        ]}
                      />
                    </div>
                  )}

                  {/* Commercial Batches Info */}
                  {contentTypeFilter === 'commercial' && commercialBatches.length > 0 && (
                    <div className="p-2 bg-dark-800/30 rounded-lg">
                      <p className="text-xs text-dark-400 mb-1">
                        {isRTL ? 'אצוות זמינות' : 'Available Batches'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {commercialBatches.map((batch) => (
                          <span
                            key={batch}
                            className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs"
                          >
                            #{batch}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content Selector */}
                  <div>
                    <Select
                      label={isRTL ? 'בחר תוכן' : 'Select Content'}
                      value={selectedContentId}
                      onChange={setSelectedContentId}
                      placeholder={isRTL ? '-- בחר --' : '-- Select --'}
                      options={[
                        { value: '', label: isRTL ? '-- בחר --' : '-- Select --' },
                        ...(filteredContent?.map((content: any) => ({
                          value: content._id,
                          label: `${content.title}${content.artist ? ` - ${content.artist}` : ''}`,
                          description: content.type === 'commercial' && content.batch_number
                            ? `Batch #${content.batch_number}`
                            : content.genre && content.type === 'song'
                            ? content.genre
                            : undefined
                        })) || [])
                      ]}
                    />
                  </div>
                </>
              )}

              {/* Flow Selection */}
              {scheduleType === 'flow' && (
                <div>
                  <Select
                    label={isRTL ? 'בחר תזרים' : 'Select Flow'}
                    value={selectedFlowId}
                    onChange={setSelectedFlowId}
                    placeholder={isRTL ? '-- בחר --' : '-- Select --'}
                    options={[
                      { value: '', label: isRTL ? '-- בחר --' : '-- Select --' },
                      ...(allFlows?.map((flow: any) => ({
                        value: flow._id,
                        label: isRTL && flow.name_he ? flow.name_he : flow.name,
                        description: flow.schedule?.recurrence || undefined
                      })) || [])
                    ]}
                  />
                </div>
              )}

              {/* Schedule Settings */}
              <div className="space-y-3 p-3 bg-dark-800/30 rounded-lg">
                <p className="text-xs text-dark-400">
                  {isRTL ? 'הגדרות תזמון' : 'Schedule Settings'}
                </p>

                {/* Recurrence Type */}
                <div>
                  <Select
                    label={isRTL ? 'חזרה' : 'Repeat'}
                    value={scheduleRecurrence}
                    onChange={(value) => setScheduleRecurrence(value as 'none' | 'daily' | 'weekly')}
                    options={[
                      { value: 'none', label: isRTL ? 'פעם אחת' : 'Once' },
                      { value: 'daily', label: isRTL ? 'יומי' : 'Daily' },
                      { value: 'weekly', label: isRTL ? 'שבועי' : 'Weekly' }
                    ]}
                  />
                </div>

                {/* One-time: Datetime picker */}
                {scheduleRecurrence === 'none' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'תאריך ושעה' : 'Date & Time'}
                    </label>
                    <input
                      type="datetime-local"
                      name="start_datetime"
                      className="w-full glass-input text-sm"
                      required
                    />
                  </div>
                )}

                {/* Recurring: Time picker */}
                {scheduleRecurrence !== 'none' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-1">
                      {isRTL ? 'שעה' : 'Time'} *
                    </label>
                    <input
                      type="time"
                      name="time"
                      className="w-full glass-input text-sm"
                      required
                    />
                  </div>
                )}

                {/* Weekly: Day selector */}
                {scheduleRecurrence === 'weekly' && (
                  <div>
                    <label className="block text-dark-300 text-xs mb-2">
                      {isRTL ? 'ימים' : 'Days'}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(isRTL
                        ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
                        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      ).map((day, idx) => (
                        <Checkbox
                          key={idx}
                          label={day}
                          checked={scheduleDaysOfWeek.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScheduleDaysOfWeek([...scheduleDaysOfWeek, idx].sort())
                            } else {
                              setScheduleDaysOfWeek(scheduleDaysOfWeek.filter(d => d !== idx))
                            }
                          }}
                          className="text-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleModal(false)
                    setScheduleRecurrence('none')
                    setScheduleDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
                    setScheduleError(null)
                    setScheduleType('content')
                    setContentTypeFilter('all')
                    setGenreFilter('all')
                    setSelectedContentId('')
                    setSelectedFlowId('')
                  }}
                  className="flex-1 glass-button py-2"
                >
                  {isRTL ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>{isRTL ? 'תזמן' : 'Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Megaphone,
  Trash2,
  Edit2,
  Play,
  Pause,
  CalendarPlus,
  BarChart2,
  FileText,
} from 'lucide-react'
import { Campaign, CampaignStatus } from '../../store/campaignStore'

interface CampaignCardProps {
  campaign: Campaign
  isSelected?: boolean
  isAdmin?: boolean  // Show contract link for admins
  onSelect?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleStatus?: () => void
  onSyncCalendar?: () => void
}

// Priority color mapping
const getPriorityColor = (priority: number): string => {
  if (priority >= 8) return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (priority >= 6) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  if (priority >= 4) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-green-500/20 text-green-400 border-green-500/30'
}

// Status badge
const StatusBadge = ({ status, isRTL }: { status: CampaignStatus; isRTL: boolean }) => {
  const config: Record<CampaignStatus, { label: string; labelHe: string; className: string }> = {
    draft: { label: 'Draft', labelHe: 'טיוטה', className: 'bg-dark-600/50 text-dark-300' },
    active: { label: 'Active', labelHe: 'פעיל', className: 'bg-green-500/20 text-green-400' },
    paused: { label: 'Paused', labelHe: 'מושהה', className: 'bg-yellow-500/20 text-yellow-400' },
    completed: { label: 'Completed', labelHe: 'הושלם', className: 'bg-dark-600/50 text-dark-400' },
  }
  const { label, labelHe, className } = config[status]
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${className}`}>
      {isRTL ? labelHe : label}
    </span>
  )
}

export default function CampaignCard({
  campaign,
  isSelected = false,
  isAdmin = false,
  onSelect,
  onEdit,
  onDelete,
  onToggleStatus,
  onSyncCalendar,
}: CampaignCardProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  // Calculate date info
  const dateInfo = useMemo(() => {
    // Parse dates as local time (not UTC) to avoid timezone issues
    const parseLocalDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    const start = parseLocalDate(campaign.start_date)
    const end = parseLocalDate(campaign.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isExpired = end < today
    const isUpcoming = start > today
    const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    const formatDate = (date: Date) =>
      date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

    return {
      startStr: formatDate(start),
      endStr: formatDate(end),
      isExpired,
      isUpcoming,
      daysRemaining,
    }
  }, [campaign.start_date, campaign.end_date, isRTL])

  // Calculate schedule stats
  const scheduleStats = useMemo(() => {
    const totalPlays = campaign.schedule_grid.reduce((sum, slot) => sum + slot.play_count, 0)
    const activeSlots = campaign.schedule_grid.filter(s => s.play_count > 0).length
    return { totalPlays, activeSlots }
  }, [campaign.schedule_grid])

  return (
    <div
      onClick={onSelect}
      className={`
        group glass-card p-4 cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-primary-500 bg-primary-500/10' : 'hover:bg-white/5'}
        ${campaign.status === 'completed' ? 'opacity-60' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-primary-400" />
          <h3 className="font-medium text-dark-100 truncate" dir="auto">
            {isRTL && campaign.name_he ? campaign.name_he : campaign.name}
          </h3>
        </div>
        <StatusBadge status={campaign.status} isRTL={isRTL} />
      </div>

      {/* Type badge and priority */}
      <div className="flex items-center gap-2 mb-3">
        {campaign.campaign_type && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-dark-600/50 text-dark-300 border border-dark-500/30">
            {campaign.campaign_type}
          </span>
        )}
        <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(campaign.priority)}`}>
          {isRTL ? 'עדיפות' : 'Priority'}: {campaign.priority}
        </span>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 text-sm text-dark-400 mb-2">
        <Calendar size={14} />
        <span>
          {dateInfo.startStr} - {dateInfo.endStr}
        </span>
        {dateInfo.isExpired && (
          <span className="text-xs text-red-400">({isRTL ? 'פג תוקף' : 'Expired'})</span>
        )}
        {dateInfo.isUpcoming && (
          <span className="text-xs text-blue-400">({isRTL ? 'עתידי' : 'Upcoming'})</span>
        )}
        {!dateInfo.isExpired && !dateInfo.isUpcoming && dateInfo.daysRemaining <= 7 && (
          <span className="text-xs text-yellow-400">
            ({dateInfo.daysRemaining} {isRTL ? 'ימים' : 'days'})
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-dark-400 mb-3">
        <div className="flex items-center gap-1">
          <BarChart2 size={12} />
          <span>{scheduleStats.totalPlays} {isRTL ? 'השמעות/שבוע' : 'plays/week'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Megaphone size={12} />
          <span>{campaign.content_refs.length} {isRTL ? 'פרסומות' : 'ads'}</span>
        </div>
      </div>

      {/* Comment */}
      {campaign.comment && (
        <p className="text-xs text-dark-500 truncate mb-3" dir="auto">
          {campaign.comment}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-2 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Toggle Status */}
        {campaign.status !== 'completed' && onToggleStatus && (
          <div className="tooltip-trigger">
            <button
              onClick={e => {
                e.stopPropagation()
                onToggleStatus()
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                campaign.status === 'active'
                  ? 'text-yellow-400 hover:bg-yellow-500/20'
                  : 'text-green-400 hover:bg-green-500/20'
              }`}
            >
              {campaign.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="tooltip tooltip-top">
              {campaign.status === 'active'
                ? isRTL ? 'השהה' : 'Pause'
                : isRTL ? 'הפעל' : 'Activate'}
            </div>
          </div>
        )}

        {/* Edit */}
        {onEdit && (
          <div className="tooltip-trigger">
            <button
              onClick={e => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 rounded-lg text-dark-300 hover:text-dark-100 hover:bg-white/10 transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'ערוך' : 'Edit'}
            </div>
          </div>
        )}

        {/* Sync Calendar */}
        {onSyncCalendar && (
          <div className="tooltip-trigger">
            <button
              onClick={e => {
                e.stopPropagation()
                onSyncCalendar()
              }}
              className="p-1.5 rounded-lg text-dark-300 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
            >
              <CalendarPlus size={16} />
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'סנכרן ליומן' : 'Sync to Calendar'}
            </div>
          </div>
        )}

        {/* Contract Link (Admin only) */}
        {isAdmin && campaign.contract_link && (
          <div className="tooltip-trigger">
            <a
              href={campaign.contract_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1.5 rounded-lg text-dark-300 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <FileText size={16} />
            </a>
            <div className="tooltip tooltip-top">
              {isRTL ? 'חוזה' : 'Contract'}
            </div>
          </div>
        )}

        {/* Delete */}
        {onDelete && (
          <div className="tooltip-trigger ml-auto">
            <button
              onClick={e => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 rounded-lg text-dark-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <div className="tooltip tooltip-top">
              {isRTL ? 'מחק' : 'Delete'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

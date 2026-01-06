import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, ExternalLink, FileAudio, Clock, Check } from 'lucide-react'
import { Campaign, CampaignCreate, ContentRef } from '../../store/campaignStore'
import { useService } from '../../services'
import { Textarea } from '../Form'

// Format duration in mm:ss
const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface CampaignFormModalProps {
  campaign?: Campaign | null // null for create, Campaign for edit
  onClose: () => void
  onSave: (data: CampaignCreate) => Promise<void>
  isSaving?: boolean
  isAdmin?: boolean // Show contract link field for admins
}

export default function CampaignFormModal({
  campaign,
  onClose,
  onSave,
  isSaving = false,
  isAdmin = false,
}: CampaignFormModalProps) {
  const { i18n } = useTranslation()
  const service = useService()
  const isRTL = i18n.language === 'he'
  const isEditing = !!campaign

  // Form state
  const [name, setName] = useState(campaign?.name || '')
  const [nameHe, setNameHe] = useState(campaign?.name_he || '')
  const [campaignType, setCampaignType] = useState(campaign?.campaign_type || '')
  const [comment, setComment] = useState(campaign?.comment || '')
  const [startDate, setStartDate] = useState(campaign?.start_date || '')
  const [endDate, setEndDate] = useState(campaign?.end_date || '')
  const [priority, setPriority] = useState(campaign?.priority || 5)
  const [contractLink, setContractLink] = useState(campaign?.contract_link || '')
  const [pricePerSlot, setPricePerSlot] = useState<string>(campaign?.price_per_slot?.toString() || '')
  const [monthlyBudget, setMonthlyBudget] = useState<string>(campaign?.monthly_budget?.toString() || '')
  const [contractValue, setContractValue] = useState<string>(campaign?.contract_value?.toString() || '')
  const [contentRefs, setContentRefs] = useState<ContentRef[]>(campaign?.content_refs || [])

  // Fetch commercials for content selection
  const { data: commercials = [] } = useQuery({
    queryKey: ['commercials'],
    queryFn: () => service.getCommercials(),
  })

  // Set default dates for new campaign
  useEffect(() => {
    if (!campaign) {
      // Format date as YYYY-MM-DD in local timezone
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      const today = new Date()
      const nextMonth = new Date(today)
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      setStartDate(formatLocalDate(today))
      setEndDate(formatLocalDate(nextMonth))
    }
  }, [campaign])

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !startDate || !endDate) {
      return
    }

    const data: CampaignCreate = {
      name: name.trim(),
      name_he: nameHe.trim() || undefined,
      campaign_type: campaignType.trim() || undefined,
      comment: comment.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      priority,
      contract_link: isAdmin && contractLink.trim() ? contractLink.trim() : undefined,
      price_per_slot: isAdmin && pricePerSlot ? parseFloat(pricePerSlot) : undefined,
      monthly_budget: isAdmin && monthlyBudget ? parseFloat(monthlyBudget) : undefined,
      contract_value: isAdmin && contractValue ? parseFloat(contractValue) : undefined,
      content_refs: contentRefs,
      schedule_grid: campaign?.schedule_grid || [],
    }

    await onSave(data)
  }

  // Add content reference from dropdown selection
  const handleAddContent = (contentId: string) => {
    if (!contentId) return

    // Don't add duplicates
    if (contentRefs.some(ref => ref.content_id === contentId)) return

    const commercial = commercials.find((c: any) => c._id === contentId)
    if (!commercial) return

    setContentRefs([
      ...contentRefs,
      {
        content_id: contentId,
        file_title: commercial.title,
        file_duration_seconds: commercial.duration_seconds,
      },
    ])
  }

  // Remove content reference
  const handleRemoveContent = (index: number) => {
    setContentRefs(contentRefs.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="glass-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-dark-100 text-lg">
            {isEditing
              ? isRTL ? 'עריכת קמפיין' : 'Edit Campaign'
              : isRTL ? 'קמפיין חדש' : 'New Campaign'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-dark-300 text-sm mb-1">
              {isRTL ? 'שם (אנגלית)' : 'Name'} *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full glass-input"
              placeholder={isRTL ? 'שם הקמפיין' : 'Campaign name'}
              required
            />
          </div>

          {/* Hebrew Name */}
          <div>
            <label className="block text-dark-300 text-sm mb-1">
              {isRTL ? 'שם (עברית)' : 'Name (Hebrew)'}
            </label>
            <input
              type="text"
              value={nameHe}
              onChange={e => setNameHe(e.target.value)}
              className="w-full glass-input"
              placeholder={isRTL ? 'שם בעברית' : 'Hebrew name'}
              dir="rtl"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-dark-300 text-sm mb-1">
              {isRTL ? 'סוג/תווית' : 'Type/Label'}
            </label>
            <input
              type="text"
              value={campaignType}
              onChange={e => setCampaignType(e.target.value)}
              className="w-full glass-input"
              placeholder={isRTL ? 'לדוגמה: ספונסר, חג' : 'e.g., Sponsor, Holiday'}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-dark-300 text-sm mb-1">
                {isRTL ? 'תאריך התחלה' : 'Start Date'} *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full glass-input"
                required
              />
            </div>
            <div>
              <label className="block text-dark-300 text-sm mb-1">
                {isRTL ? 'תאריך סיום' : 'End Date'} *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate}
                className="w-full glass-input"
                required
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-dark-300 text-sm mb-1">
              {isRTL ? 'עדיפות (1-9)' : 'Priority (1-9)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={9}
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value))}
                className="flex-1 accent-primary-500"
              />
              <span className="w-8 text-center font-semibold text-primary-400">{priority}</span>
            </div>
            <p className="text-xs text-dark-500 mt-1">
              {isRTL ? 'עדיפות גבוהה = מנגן ראשון' : 'Higher priority = plays first'}
            </p>
          </div>

          {/* Comment */}
          <div>
            <Textarea
              label={isRTL ? 'הערות' : 'Notes'}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={isRTL ? 'הערות נוספות...' : 'Additional notes...'}
              rows={3}
              dir="auto"
            />
          </div>

          {/* Admin-only Fields */}
          {isAdmin && (
            <div className="space-y-4 p-4 bg-primary-500/5 border border-primary-500/20 rounded-lg">
              <div className="text-xs text-primary-400 font-medium mb-2">
                {isRTL ? 'שדות מנהל' : 'Admin Fields'}
              </div>

              {/* Contract Link */}
              <div>
                <label className="block text-dark-300 text-sm mb-1">
                  {isRTL ? 'קישור לחוזה' : 'Contract Link'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={contractLink}
                    onChange={e => setContractLink(e.target.value)}
                    className="flex-1 glass-input"
                    placeholder={isRTL ? 'קישור למסמך החוזה' : 'URL to contract document'}
                  />
                  {contractLink && (
                    <a
                      href={contractLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 glass-button hover:text-primary-400"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                </div>
              </div>

              {/* Financial Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-dark-300 text-sm mb-1">
                    {isRTL ? 'מחיר/משבצת' : 'Price/Slot'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricePerSlot}
                      onChange={e => setPricePerSlot(e.target.value)}
                      className="w-full glass-input pr-8"
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 text-sm">
                      ₪
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-dark-300 text-sm mb-1">
                    {isRTL ? 'תקציב חודשי' : 'Monthly Budget'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyBudget}
                      onChange={e => setMonthlyBudget(e.target.value)}
                      className="w-full glass-input pr-8"
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 text-sm">
                      ₪
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-dark-300 text-sm mb-1">
                    {isRTL ? 'ערך חוזה' : 'Contract Value'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={contractValue}
                      onChange={e => setContractValue(e.target.value)}
                      className="w-full glass-input pr-8"
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 text-sm">
                      ₪
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content Selection */}
          <div>
            <label className="block text-dark-300 text-sm mb-2">
              {isRTL ? 'פרסומות' : 'Commercials'}
              {contentRefs.length > 0 && (
                <span className="text-primary-400 ml-2">({contentRefs.length})</span>
              )}
            </label>

            {/* Available commercials list */}
            <div className="bg-dark-800/30 rounded-lg border border-white/5 max-h-48 overflow-auto mb-3">
              {commercials.length === 0 ? (
                <div className="p-4 text-center text-dark-500 text-sm">
                  {isRTL ? 'אין פרסומות זמינות' : 'No commercials available'}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {commercials.map((commercial: any) => {
                    const isSelected = contentRefs.some(ref => ref.content_id === commercial._id)
                    return (
                      <button
                        key={commercial._id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            // Remove if already selected
                            const idx = contentRefs.findIndex(ref => ref.content_id === commercial._id)
                            if (idx >= 0) handleRemoveContent(idx)
                          } else {
                            handleAddContent(commercial._id)
                          }
                        }}
                        className={`
                          w-full p-3 flex items-start gap-3 text-left transition-colors
                          ${isSelected
                            ? 'bg-primary-500/20 hover:bg-primary-500/30'
                            : 'hover:bg-white/5'
                          }
                        `}
                      >
                        {/* Icon / Checkbox */}
                        <div className={`
                          mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                          ${isSelected
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-dark-400'
                          }
                        `}>
                          {isSelected ? (
                            <Check size={12} />
                          ) : (
                            <FileAudio size={12} />
                          )}
                        </div>

                        {/* Content info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-dark-100 truncate" dir="auto">
                            {commercial.title}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-dark-400">
                            {/* Duration */}
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {formatDuration(commercial.duration_seconds)}
                            </span>
                            {/* File type if available */}
                            {commercial.file_type && (
                              <span className="uppercase">
                                {commercial.file_type.replace('audio/', '')}
                              </span>
                            )}
                            {/* Created date if available */}
                            {commercial.created_at && (
                              <span>
                                {new Date(commercial.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Duration badge */}
                        {commercial.duration_seconds && (
                          <div className="text-xs text-dark-400 bg-dark-700/50 px-2 py-0.5 rounded">
                            {formatDuration(commercial.duration_seconds)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected commercials summary */}
            {contentRefs.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-dark-400 mb-1">
                  {isRTL ? 'נבחרו:' : 'Selected:'}
                </div>
                {contentRefs.map((ref, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-primary-500/10 border border-primary-500/20 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileAudio size={14} className="text-primary-400 flex-shrink-0" />
                      <span className="text-sm text-dark-200 truncate" dir="auto">
                        {ref.file_title || ref.content_id}
                      </span>
                      {ref.file_duration_seconds && (
                        <span className="text-xs text-dark-400">
                          ({formatDuration(ref.file_duration_seconds)})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveContent(idx)}
                      className="p-1 text-dark-400 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {contentRefs.length === 0 && (
              <p className="text-xs text-dark-500 text-center py-2">
                {isRTL ? 'לחץ על פרסומת לבחירה' : 'Click a commercial to select'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="flex-1 glass-button py-2">
              {isRTL ? 'ביטול' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim() || !startDate || !endDate}
              className="flex-1 glass-button-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              <span>{isEditing ? (isRTL ? 'שמור' : 'Save') : (isRTL ? 'צור' : 'Create')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

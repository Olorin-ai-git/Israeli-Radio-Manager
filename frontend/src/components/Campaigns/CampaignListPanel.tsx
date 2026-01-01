import { Plus, Loader2 } from 'lucide-react'
import { Campaign, CampaignStatus } from '../../store/campaignStore'
import { MultiSelectDropdown } from '../Form'
import CampaignCard from './CampaignCard'

interface CampaignListPanelProps {
  isRTL: boolean
  campaigns: Campaign[]
  filteredCampaigns: Campaign[]
  selectedCampaign: Campaign | null
  isLoading: boolean
  isAdmin: boolean
  statusFilter: CampaignStatus[]
  onStatusFilterChange: (statuses: CampaignStatus[]) => void
  onSelectCampaign: (campaign: Campaign | null) => void
  onEditCampaign: (campaign: Campaign) => void
  onDeleteCampaign: (campaignId: string) => void
  onToggleStatus: (campaign: Campaign) => void
  onSyncCalendar: (campaignId: string) => void
  onCloneCampaign: (campaignId: string) => void
  onOpenRightPanel: () => void
  onCreateCampaign: () => void
}

const STATUS_OPTIONS: Array<{ value: CampaignStatus; label: string; labelHe: string }> = [
  { value: 'active', label: 'Active', labelHe: 'פעיל' },
  { value: 'paused', label: 'Paused', labelHe: 'מושהה' },
  { value: 'draft', label: 'Draft', labelHe: 'טיוטה' },
  { value: 'completed', label: 'Completed', labelHe: 'הושלם' },
  { value: 'deleted', label: 'Deleted', labelHe: 'נמחק' },
]

export default function CampaignListPanel({
  isRTL,
  filteredCampaigns,
  selectedCampaign,
  isLoading,
  isAdmin,
  statusFilter,
  onStatusFilterChange,
  onSelectCampaign,
  onEditCampaign,
  onDeleteCampaign,
  onToggleStatus,
  onSyncCalendar,
  onCloneCampaign,
  onOpenRightPanel,
  onCreateCampaign,
}: CampaignListPanelProps) {
  return (
    <>
      <div className="p-4 border-b border-white/10 space-y-3">
        {/* New Campaign Button */}
        <button
          onClick={onCreateCampaign}
          className="w-full glass-button-primary flex items-center justify-center gap-2 px-4 py-2"
        >
          <Plus size={18} />
          <span>{isRTL ? 'קמפיין חדש' : 'New Campaign'}</span>
        </button>

        {/* Status Filter */}
        <MultiSelectDropdown
          values={statusFilter}
          onChange={(values) => onStatusFilterChange(values as CampaignStatus[])}
          options={STATUS_OPTIONS.map(opt => ({
            value: opt.value,
            label: isRTL ? opt.labelHe : opt.label
          }))}
          allLabel={isRTL ? 'הכל' : 'All'}
          placeholder={isRTL ? 'בחר סטטוס...' : 'Select status...'}
        />

        {/* Campaign count */}
        <div className="text-xs text-dark-400">
          {filteredCampaigns.length} {isRTL ? 'קמפיינים' : 'campaigns'}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {isLoading && filteredCampaigns.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary-400" size={24} />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center text-dark-500 py-8">
            {isRTL ? 'אין קמפיינים' : 'No campaigns'}
          </div>
        ) : (
          filteredCampaigns.map(campaign => (
            <CampaignCard
              key={campaign._id}
              campaign={campaign}
              isSelected={selectedCampaign?._id === campaign._id}
              isAdmin={isAdmin}
              onSelect={() => {
                const isDeselecting = selectedCampaign?._id === campaign._id
                onSelectCampaign(isDeselecting ? null : campaign)
                if (!isDeselecting) {
                  onOpenRightPanel()
                }
              }}
              onEdit={() => onEditCampaign(campaign)}
              onDelete={() => onDeleteCampaign(campaign._id)}
              onToggleStatus={() => onToggleStatus(campaign)}
              onSyncCalendar={() => onSyncCalendar(campaign._id)}
              onClone={() => onCloneCampaign(campaign._id)}
            />
          ))
        )}
      </div>
    </>
  )
}

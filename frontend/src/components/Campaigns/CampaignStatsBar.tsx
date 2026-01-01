import { useMemo } from 'react'
import { TrendingUp, Calendar, Wallet, FileText, PlayCircle } from 'lucide-react'
import { Campaign } from '../../store/campaignStore'

interface CampaignStatsBarProps {
  campaigns: Campaign[]
  isRTL: boolean
  isAdmin: boolean
}

// Format currency in ILS
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function CampaignStatsBar({ campaigns, isRTL, isAdmin }: CampaignStatsBarProps) {
  const stats = useMemo(() => {
    const activeCampaigns = campaigns.filter(c => c.status === 'active')

    // Count total plays per week (sum of all play_count in schedule_grid for active campaigns)
    const totalPlaysPerWeek = activeCampaigns.reduce((sum, campaign) => {
      const weeklyPlays = campaign.schedule_grid.reduce((s, slot) => s + slot.play_count, 0)
      return sum + weeklyPlays
    }, 0)

    // Calculate total monthly budget
    const totalMonthlyBudget = activeCampaigns.reduce((sum, campaign) => {
      return sum + (campaign.monthly_budget || 0)
    }, 0)

    // Calculate total contract value
    const totalContractValue = activeCampaigns.reduce((sum, campaign) => {
      return sum + (campaign.contract_value || 0)
    }, 0)

    // Calculate estimated weekly revenue (price_per_slot * plays)
    const estimatedWeeklyRevenue = activeCampaigns.reduce((sum, campaign) => {
      if (!campaign.price_per_slot) return sum
      const weeklyPlays = campaign.schedule_grid.reduce((s, slot) => s + slot.play_count, 0)
      return sum + (campaign.price_per_slot * weeklyPlays)
    }, 0)

    // Estimated monthly revenue (weekly * 4.33)
    const estimatedMonthlyRevenue = estimatedWeeklyRevenue * 4.33

    return {
      activeCampaigns: activeCampaigns.length,
      totalPlaysPerWeek,
      totalMonthlyBudget,
      totalContractValue,
      estimatedMonthlyRevenue,
    }
  }, [campaigns])

  return (
    <div className="flex items-center justify-center gap-6 px-6 py-3 bg-dark-800/30 border-b border-white/5 overflow-x-auto">
      {/* Active Campaigns */}
      <div className="flex items-center gap-2 px-4 py-2 bg-dark-800/50 rounded-lg border border-white/5 whitespace-nowrap">
        <Calendar size={18} className="text-blue-400" />
        <div>
          <div className="text-xs text-dark-400">{isRTL ? 'קמפיינים פעילים' : 'Active Campaigns'}</div>
          <div className="text-lg font-semibold text-dark-100">{stats.activeCampaigns}</div>
        </div>
      </div>

      {/* Total Plays per Week */}
      <div className="flex items-center gap-2 px-4 py-2 bg-dark-800/50 rounded-lg border border-white/5 whitespace-nowrap">
        <PlayCircle size={18} className="text-green-400" />
        <div>
          <div className="text-xs text-dark-400">{isRTL ? 'השמעות בשבוע' : 'Plays / Week'}</div>
          <div className="text-lg font-semibold text-dark-100">{stats.totalPlaysPerWeek.toLocaleString()}</div>
        </div>
      </div>

      {/* Admin-only financial stats - always show placeholders */}
      {isAdmin && (
        <>
          {/* Total Monthly Budget */}
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-800/50 rounded-lg border border-white/5 whitespace-nowrap">
            <Wallet size={18} className="text-yellow-400" />
            <div>
              <div className="text-xs text-dark-400">{isRTL ? 'תקציב חודשי' : 'Monthly Budget'}</div>
              <div className="text-lg font-semibold text-dark-100">
                {stats.totalMonthlyBudget > 0 ? formatCurrency(stats.totalMonthlyBudget) : '—'}
              </div>
            </div>
          </div>

          {/* Total Contract Value */}
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-800/50 rounded-lg border border-white/5 whitespace-nowrap">
            <FileText size={18} className="text-purple-400" />
            <div>
              <div className="text-xs text-dark-400">{isRTL ? 'ערך חוזים' : 'Contracts Value'}</div>
              <div className="text-lg font-semibold text-dark-100">
                {stats.totalContractValue > 0 ? formatCurrency(stats.totalContractValue) : '—'}
              </div>
            </div>
          </div>

          {/* Estimated Monthly Revenue */}
          <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 rounded-lg border border-primary-500/20 whitespace-nowrap">
            <TrendingUp size={18} className="text-primary-400" />
            <div>
              <div className="text-xs text-dark-400">{isRTL ? 'הכנסה חודשית (צפי)' : 'Est. Monthly Revenue'}</div>
              <div className="text-lg font-semibold text-primary-400">
                {stats.estimatedMonthlyRevenue > 0 ? formatCurrency(stats.estimatedMonthlyRevenue) : '—'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

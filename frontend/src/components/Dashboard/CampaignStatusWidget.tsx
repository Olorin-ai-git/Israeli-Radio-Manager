import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Megaphone, PlayCircle, TrendingUp, Clock, ChevronRight, ChevronLeft } from 'lucide-react'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Campaign {
  _id: string
  name: string
  name_he?: string
  status: string
  priority: number
  schedule_grid: Array<{ play_count: number; slot_index: number }>
  content_refs: Array<{ content_id: string; weight: number }>
  monthly_budget?: number
  contract_value?: number
  price_per_slot?: number
}

interface DailySlot {
  slot_index: number
  time: string
  commercials: Array<{
    campaign_id: string
    name: string
    priority: number
    play_count: number
  }>
}

export default function CampaignStatusWidget() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const navigate = useNavigate()
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  // Fetch active campaigns
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['campaigns', 'active'],
    queryFn: () => api.getCampaigns('active'),
    refetchInterval: 60000,
  })

  // Fetch today's preview
  const today = new Date().toISOString().split('T')[0]
  const { data: dailyPreview } = useQuery<{ slots: DailySlot[] }>({
    queryKey: ['campaignDailyPreview', today],
    queryFn: () => api.getCampaignDailyPreview(today),
    refetchInterval: 60000,
  })

  // Calculate stats
  const stats = useMemo(() => {
    const activeCampaigns = campaigns.filter(c => c.status === 'active')
    const totalPlaysPerWeek = activeCampaigns.reduce((sum, campaign) => {
      const weeklyPlays = campaign.schedule_grid?.reduce((s, slot) => s + slot.play_count, 0) || 0
      return sum + weeklyPlays
    }, 0)

    const estimatedWeeklyRevenue = activeCampaigns.reduce((sum, campaign) => {
      if (!campaign.price_per_slot) return sum
      const weeklyPlays = campaign.schedule_grid?.reduce((s, slot) => s + slot.play_count, 0) || 0
      return sum + (campaign.price_per_slot * weeklyPlays)
    }, 0)

    return {
      activeCampaigns: activeCampaigns.length,
      totalPlaysPerWeek,
      estimatedMonthlyRevenue: estimatedWeeklyRevenue * 4.33,
    }
  }, [campaigns])

  // Get upcoming slots (next 3)
  const upcomingSlots = useMemo(() => {
    if (!dailyPreview?.slots) return []

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    return dailyPreview.slots
      .filter(slot => {
        const [hours, minutes] = slot.time.split(':').map(Number)
        const slotMinutes = hours * 60 + minutes
        return slotMinutes > currentMinutes && slot.commercials.length > 0
      })
      .slice(0, 3)
  }, [dailyPreview])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <Megaphone size={16} className="text-orange-400" />
          {isRTL ? 'סטטוס קמפיינים' : 'Campaign Status'}
        </h3>
        <button
          onClick={() => navigate('/campaigns')}
          className="text-[10px] text-dark-400 hover:text-primary-400 transition-colors flex items-center gap-0.5"
        >
          {isRTL ? 'כל הקמפיינים' : 'All campaigns'}
          <ChevronIcon size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Left: Stats */}
        <div className="space-y-2">
          {/* Active Campaigns */}
          <div className="flex items-center gap-3 p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
              <Megaphone size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-dark-100">{stats.activeCampaigns}</p>
              <p className="text-[10px] text-dark-400">{isRTL ? 'קמפיינים פעילים' : 'Active Campaigns'}</p>
            </div>
          </div>

          {/* Plays per Week */}
          <div className="flex items-center gap-3 p-2.5 bg-dark-700/30 rounded-lg border border-white/5">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30">
              <PlayCircle size={14} className="text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-dark-100">{stats.totalPlaysPerWeek.toLocaleString()}</p>
              <p className="text-[10px] text-dark-400">{isRTL ? 'השמעות בשבוע' : 'Plays / Week'}</p>
            </div>
          </div>

          {/* Revenue (Admin only) */}
          {isAdmin && stats.estimatedMonthlyRevenue > 0 && (
            <div className="flex items-center gap-3 p-2.5 bg-primary-500/10 rounded-lg border border-primary-500/20">
              <div className="w-8 h-8 bg-primary-500/20 rounded-lg flex items-center justify-center border border-primary-500/30">
                <TrendingUp size={14} className="text-primary-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-primary-400">{formatCurrency(stats.estimatedMonthlyRevenue)}</p>
                <p className="text-[10px] text-dark-400">{isRTL ? 'הכנסה חודשית (צפי)' : 'Est. Monthly Revenue'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Upcoming Ads */}
        <div>
          <h4 className="text-xs font-medium text-dark-300 mb-2 flex items-center gap-1">
            <Clock size={12} />
            {isRTL ? 'פרסומות קרובות' : 'Upcoming Ads'}
          </h4>

          {upcomingSlots.length > 0 ? (
            <div className="space-y-1.5">
              {upcomingSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-dark-700/30 rounded-lg border border-white/5"
                >
                  <span className="text-xs font-mono text-primary-400 flex-shrink-0">
                    {slot.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dark-200 truncate" dir="auto">
                      {slot.commercials[0]?.name || (isRTL ? 'קמפיין' : 'Campaign')}
                    </p>
                    {slot.commercials.length > 1 && (
                      <p className="text-[10px] text-dark-500">
                        +{slot.commercials.length - 1} {isRTL ? 'נוספים' : 'more'}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full flex-shrink-0">
                    {slot.commercials.reduce((sum, c) => sum + c.play_count, 0)} {isRTL ? 'פר' : 'ads'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-dark-500">
              <Clock size={24} className="mb-1 opacity-40" />
              <p className="text-xs">{isRTL ? 'אין פרסומות מתוכננות' : 'No upcoming ads'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

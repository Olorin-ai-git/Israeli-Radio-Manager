import { useQuery } from '@tanstack/react-query'
import { FileText, AlertCircle, TrendingUp, Music, Tv, Radio } from 'lucide-react'
import api from '../../services/api'

interface ContentManagementTabProps {
  isRTL: boolean
}

export default function ContentManagementTab({ isRTL }: ContentManagementTabProps) {
  const { data: contentStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin', 'content', 'stats'],
    queryFn: api.getAdminContentStats,
    retry: false
  })

  const { data: qualityIssues, isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: ['admin', 'content', 'quality-issues'],
    queryFn: api.getAdminQualityIssues,
    retry: false
  })

  if (statsLoading || issuesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (statsError || issuesError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-amber-400" size={48} />
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {isRTL ? 'נדרשת הרשאת מנהל' : 'Admin Authorization Required'}
          </h3>
          <p className="text-sm text-dark-400">
            {isRTL ? 'עליך להתחבר עם חשבון מנהל כדי לצפות בדף זה' : 'Please sign in with an admin account to view this page'}
          </p>
        </div>
      </div>
    )
  }

  const totalIssues =
    (qualityIssues?.missing_metadata?.length || 0) +
    (qualityIssues?.low_quality?.length || 0) +
    (qualityIssues?.short_duration?.length || 0) +
    (qualityIssues?.duplicates?.length || 0)

  return (
    <div className="space-y-6">
      {/* Content Statistics */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-primary-400" />
          <h3 className="font-semibold text-dark-100">
            {isRTL ? 'סטטיסטיקות תוכן' : 'Content Statistics'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Songs */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-3">
              <Music size={24} className="text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-dark-100">
                  {contentStats?.by_type?.songs || 0}
                </div>
                <div className="text-sm text-dark-400">
                  {isRTL ? 'שירים' : 'Songs'}
                </div>
              </div>
            </div>
          </div>

          {/* Total Shows */}
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-3">
              <Tv size={24} className="text-emerald-400" />
              <div>
                <div className="text-2xl font-bold text-dark-100">
                  {contentStats?.by_type?.shows || 0}
                </div>
                <div className="text-sm text-dark-400">
                  {isRTL ? 'תוכניות' : 'Shows'}
                </div>
              </div>
            </div>
          </div>

          {/* Total Commercials */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <Radio size={24} className="text-amber-400" />
              <div>
                <div className="text-2xl font-bold text-dark-100">
                  {contentStats?.by_type?.commercials || 0}
                </div>
                <div className="text-sm text-dark-400">
                  {isRTL ? 'פרסומות' : 'Commercials'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Average Play Count */}
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">
              {isRTL ? 'ממוצע השמעות' : 'Average Play Count'}
            </span>
            <span className="text-lg font-semibold text-purple-400">
              {contentStats?.avg_play_count?.toFixed(1) || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Top Genres */}
      {contentStats?.by_genre && contentStats.by_genre.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold text-dark-100 mb-4">
            {isRTL ? 'תוכן לפי ז\'אנר' : 'Content by Genre'}
          </h3>
          <div className="space-y-2">
            {contentStats.by_genre.slice(0, 10).map((genre: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                <span className="text-sm text-dark-200">{genre._id || 'Unknown'}</span>
                <span className="text-sm font-semibold text-primary-400">{genre.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality Issues */}
      <div className={`glass-card p-6 ${totalIssues > 0 ? 'bg-amber-500/10 border-amber-500/30' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={20} className={totalIssues > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          <h3 className={`font-semibold ${totalIssues > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isRTL ? 'בעיות איכות' : 'Quality Issues'}
            {totalIssues > 0 && ` (${totalIssues})`}
          </h3>
        </div>

        {totalIssues === 0 ? (
          <div className="text-center py-8 text-dark-400">
            {isRTL ? 'לא נמצאו בעיות איכות! 🎉' : 'No quality issues found! 🎉'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Missing Metadata */}
            {qualityIssues?.missing_metadata && qualityIssues.missing_metadata.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-100 mb-2">
                  {isRTL ? 'מטא-דאטה חסרה' : 'Missing Metadata'} ({qualityIssues.missing_metadata.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {qualityIssues.missing_metadata.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-dark-400 p-2 bg-dark-800/50 rounded">
                      {item.title} - {item.artist || 'No artist'} - {item.genre || 'No genre'}
                    </div>
                  ))}
                  {qualityIssues.missing_metadata.length > 5 && (
                    <div className="text-xs text-dark-500">
                      ... {qualityIssues.missing_metadata.length - 5} {isRTL ? 'נוספים' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Low Quality */}
            {qualityIssues?.low_quality && qualityIssues.low_quality.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-100 mb-2">
                  {isRTL ? 'איכות אודיו נמוכה' : 'Low Audio Quality'} ({qualityIssues.low_quality.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {qualityIssues.low_quality.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-dark-400 p-2 bg-dark-800/50 rounded">
                      {item.title} - {Math.round(item.bitrate / 1000)}kbps
                    </div>
                  ))}
                  {qualityIssues.low_quality.length > 5 && (
                    <div className="text-xs text-dark-500">
                      ... {qualityIssues.low_quality.length - 5} {isRTL ? 'נוספים' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Short Duration */}
            {qualityIssues?.short_duration && qualityIssues.short_duration.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-100 mb-2">
                  {isRTL ? 'משך קצר מדי' : 'Short Duration'} ({qualityIssues.short_duration.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {qualityIssues.short_duration.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-dark-400 p-2 bg-dark-800/50 rounded">
                      {item.title} - {item.duration}s
                    </div>
                  ))}
                  {qualityIssues.short_duration.length > 5 && (
                    <div className="text-xs text-dark-500">
                      ... {qualityIssues.short_duration.length - 5} {isRTL ? 'נוספים' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duplicates */}
            {qualityIssues?.duplicates && qualityIssues.duplicates.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-100 mb-2">
                  {isRTL ? 'כפילויות אפשריות' : 'Possible Duplicates'} ({qualityIssues.duplicates.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {qualityIssues.duplicates.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-dark-400 p-2 bg-dark-800/50 rounded">
                      {item._id.title} - {item._id.artist} ({item.count} {isRTL ? 'עותקים' : 'copies'})
                    </div>
                  ))}
                  {qualityIssues.duplicates.length > 5 && (
                    <div className="text-xs text-dark-500">
                      ... {qualityIssues.duplicates.length - 5} {isRTL ? 'נוספים' : 'more'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

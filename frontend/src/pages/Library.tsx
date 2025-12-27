import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Music, Radio, Megaphone, Search, Play, MoreVertical } from 'lucide-react'
import { api } from '../services/api'

type ContentTab = 'songs' | 'shows' | 'commercials'

export default function Library() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ContentTab>('songs')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: songs } = useQuery({
    queryKey: ['songs'],
    queryFn: () => api.getSongs(),
    enabled: activeTab === 'songs',
  })

  const { data: shows } = useQuery({
    queryKey: ['shows'],
    queryFn: api.getShows,
    enabled: activeTab === 'shows',
  })

  const { data: commercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: api.getCommercials,
    enabled: activeTab === 'commercials',
  })

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: api.getGenres,
  })

  const getContent = () => {
    switch (activeTab) {
      case 'songs':
        return songs || []
      case 'shows':
        return shows || []
      case 'commercials':
        return commercials || []
    }
  }

  const content = getContent()
  const filteredContent = searchQuery
    ? content.filter((item: any) =>
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.artist?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : content

  const tabs = [
    { id: 'songs' as const, label: t('library.songs'), icon: Music, count: songs?.length || 0 },
    { id: 'shows' as const, label: t('library.shows'), icon: Radio, count: shows?.length || 0 },
    { id: 'commercials' as const, label: t('library.commercials'), icon: Megaphone, count: commercials?.length || 0 },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('library.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Icon size={18} />
              {tab.label}
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('library.search')}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            dir="auto"
          />
        </div>

        {activeTab === 'songs' && genres && genres.length > 0 && (
          <select className="px-4 py-2 border border-gray-200 rounded-lg bg-white">
            <option value="">All Genres</option>
            {genres.map((genre: string) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredContent.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('content.title')}
                </th>
                {activeTab === 'songs' && (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      {t('content.artist')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                      {t('content.genre')}
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('content.duration')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('content.playCount')}
                </th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredContent.map((item: any) => (
                <tr key={item._id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => api.play(item._id)}
                      className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play size={14} className="ml-0.5" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.title || 'Untitled'}</p>
                      {item.title_he && (
                        <p className="text-sm text-gray-500" dir="rtl">{item.title_he}</p>
                      )}
                    </div>
                  </td>
                  {activeTab === 'songs' && (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.artist || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {item.genre && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                            {item.genre}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {formatDuration(item.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.play_count || 0}
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Music size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{t('library.noContent')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

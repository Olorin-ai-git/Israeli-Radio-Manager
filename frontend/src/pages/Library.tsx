import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Music, Radio, Megaphone, Search, Play, Plus, MoreVertical, Cloud, HardDrive, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'
import { usePlayerStore } from '../store/playerStore'
import { toast } from '../store/toastStore'

type ContentTab = 'songs' | 'shows' | 'commercials'

export default function Library() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<ContentTab>('songs')
  const [searchQuery, setSearchQuery] = useState('')
  const { play, addToQueue } = usePlayerStore()

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
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('library.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'glass-button-primary shadow-glow'
                  : 'glass-button'
              }`}
            >
              <Icon size={18} />
              {tab.label}
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-dark-600/50'
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
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('library.search')}
            className="w-full pl-10 pr-4 py-2.5 glass-input"
            dir="auto"
          />
        </div>

        {activeTab === 'songs' && genres && genres.length > 0 && (
          <select className="px-4 py-2 glass-input min-w-[150px]">
            <option value="">All Genres</option>
            {genres.map((genre: string) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content Grid */}
      <div className="glass-card overflow-hidden">
        {filteredContent.length > 0 ? (
          <table className="glass-table">
            <thead>
              <tr>
                <th className="w-12"></th>
                <th>{t('content.title')}</th>
                {activeTab === 'songs' && (
                  <>
                    <th>{t('content.artist')}</th>
                    <th>{t('content.genre')}</th>
                  </>
                )}
                <th>{t('content.duration')}</th>
                <th>{t('content.playCount')}</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredContent.map((item: any) => (
                <tr key={item._id} className="group">
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => play(item)}
                        className="w-8 h-8 glass-button-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('player.play')}
                      >
                        <Play size={14} className="ml-0.5" />
                      </button>
                      <button
                        onClick={() => addToQueue(item)}
                        className="w-8 h-8 glass-button rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('player.addToQueue')}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-dark-100">{item.title || 'Untitled'}</p>
                      {item.title_he && (
                        <p className="text-sm text-dark-400" dir="rtl">{item.title_he}</p>
                      )}
                    </div>
                  </td>
                  {activeTab === 'songs' && (
                    <>
                      <td className="text-sm text-dark-300">
                        {item.artist || '-'}
                      </td>
                      <td>
                        {item.genre && (
                          <span className="badge badge-info">
                            {item.genre}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="text-sm text-dark-300 font-mono">
                    {formatDuration(item.duration_seconds)}
                  </td>
                  <td className="text-sm text-dark-300">
                    {item.play_count || 0}
                  </td>
                  <td>
                    <button className="p-1 text-dark-400 hover:text-dark-200 transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <Music size={48} className="mx-auto mb-4 text-dark-600" />
            <p className="text-dark-400">{t('library.noContent')}</p>
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

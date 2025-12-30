import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Music, Radio, Megaphone, Search, Play, Plus,
  Clock, BarChart2, Calendar, Disc3, RefreshCw, ListPlus, X as XIcon, FolderSync,
  AudioLines, Layers
} from 'lucide-react'
import { api } from '../services/api'
import { usePlayerStore } from '../store/playerStore'
import { toast } from '../store/toastStore'

// Component to display album cover with fallback
function AlbumCover({ contentId, isPlaying, type }: { contentId: string; isPlaying: boolean; type: string }) {
  const [hasError, setHasError] = useState(false)
  const coverUrl = api.getCoverUrl(contentId)

  const TypeIcon = type === 'song' ? Music
    : type === 'commercial' ? Megaphone
    : type === 'show' ? Radio
    : type === 'jingle' ? AudioLines
    : type === 'sample' ? Layers
    : Disc3

  if (hasError) {
    return isPlaying ? (
      <div className="flex items-end gap-0.5 h-5 is-playing">
        <div className="w-1 bg-white audio-bar h-3 rounded-full"></div>
        <div className="w-1 bg-white audio-bar h-5 rounded-full"></div>
        <div className="w-1 bg-white audio-bar h-4 rounded-full"></div>
      </div>
    ) : (
      <TypeIcon size={20} className="text-dark-300 group-hover:text-primary-400 transition-colors" />
    )
  }

  return (
    <img
      src={coverUrl}
      alt="Cover"
      className="w-full h-full object-cover"
      onError={() => setHasError(true)}
    />
  )
}

type ContentTab = 'songs' | 'shows' | 'commercials' | 'jingles' | 'samples'

export default function Library() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [activeTab, setActiveTab] = useState<ContentTab>('songs')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const { play, addToQueue, currentTrack } = usePlayerStore()
  const queryClient = useQueryClient()

  // Metadata refresh mutation
  const refreshMetadataMutation = useMutation({
    mutationFn: api.refreshMetadata,
    onSuccess: (data) => {
      // Invalidate queries to refetch with new metadata
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['commercials'] })
      queryClient.invalidateQueries({ queryKey: ['jingles'] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })

      toast.success(
        isRTL
          ? `מטה-דאטה עודכן: ${data.stats.updated} פריטים`
          : `Metadata updated: ${data.stats.updated} items`
      )
    },
    onError: () => {
      toast.error(
        isRTL
          ? 'שגיאה בעדכון מטה-דאטה'
          : 'Failed to refresh metadata'
      )
    }
  })

  // Google Drive sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      console.log('Starting Google Drive sync...')
      const result = await api.startSync(true) // downloadFiles = true
      console.log('Sync result:', result)
      return result
    },
    onSuccess: (data) => {
      console.log('Sync completed successfully:', data)
      // Invalidate queries to refetch with new content
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['commercials'] })
      queryClient.invalidateQueries({ queryKey: ['jingles'] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['genres'] })

      const stats = data.stats || {}
      const filesFound = stats.files_found || 0
      const filesAdded = stats.files_added || 0
      const filesUpdated = stats.files_updated || 0

      toast.success(
        isRTL
          ? `סונכרנו ${filesFound} קבצים (${filesAdded} חדשים, ${filesUpdated} עודכנו)`
          : `Synced ${filesFound} files (${filesAdded} new, ${filesUpdated} updated)`
      )
    },
    onError: (error: any) => {
      console.error('Sync error:', error)
      toast.error(
        isRTL
          ? 'שגיאה בסנכרון עם Google Drive'
          : 'Failed to sync with Google Drive'
      )
    }
  })

  const { data: songs, isLoading: loadingSongs } = useQuery({
    queryKey: ['songs'],
    queryFn: () => api.getSongs(),
  })

  const { data: shows, isLoading: loadingShows } = useQuery({
    queryKey: ['shows'],
    queryFn: api.getShows,
  })

  const { data: commercials, isLoading: loadingCommercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: api.getCommercials,
  })

  const { data: jingles, isLoading: loadingJingles } = useQuery({
    queryKey: ['jingles'],
    queryFn: api.getJingles,
  })

  const { data: samples, isLoading: loadingSamples } = useQuery({
    queryKey: ['samples'],
    queryFn: api.getSamples,
  })

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: api.getGenres,
  })

  const getContent = (): any[] => {
    switch (activeTab) {
      case 'songs':
        return Array.isArray(songs) ? songs : []
      case 'shows':
        return Array.isArray(shows) ? shows : []
      case 'commercials':
        return Array.isArray(commercials) ? commercials : []
      case 'jingles':
        return Array.isArray(jingles) ? jingles : []
      case 'samples':
        return Array.isArray(samples) ? samples : []
      default:
        return []
    }
  }

  const isLoading = activeTab === 'songs' ? loadingSongs
    : activeTab === 'shows' ? loadingShows
    : activeTab === 'commercials' ? loadingCommercials
    : activeTab === 'jingles' ? loadingJingles
    : loadingSamples

  const content = getContent()

  // Filter by search and genre
  const filteredContent = content.filter((item: any) => {
    const matchesSearch = !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.artist?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGenre = !selectedGenre || item.genre === selectedGenre
    return matchesSearch && matchesGenre
  })

  const handlePlay = (item: any) => {
    play(item)
    toast.success(isRTL ? `מנגן: ${item.title}` : `Playing: ${item.title}`)
  }

  const handleAddToQueue = (item: any) => {
    addToQueue(item)
    toast.info(isRTL ? `נוסף לתור: ${item.title}` : `Added to queue: ${item.title}`)
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const selectAll = () => {
    const allIds = new Set<string>(filteredContent.map((item: any) => item._id))
    setSelectedItems(allIds)
  }

  const clearSelection = () => {
    setSelectedItems(new Set())
  }

  const handleAddSelectedToQueue = async () => {
    const selectedContent = content.filter((item: any) => selectedItems.has(item._id))

    for (const item of selectedContent) {
      await addToQueue(item)
    }

    toast.success(
      isRTL
        ? `${selectedItems.size} שירים נוספו לתור`
        : `Added ${selectedItems.size} songs to queue`
    )
    clearSelection()
  }

  // Clear selection when changing tabs
  const handleTabChange = (tab: ContentTab) => {
    setActiveTab(tab)
    clearSelection()
  }

  const tabs = [
    { id: 'songs' as const, label: isRTL ? 'שירים' : 'Songs', icon: Music, count: songs?.length || 0 },
    { id: 'shows' as const, label: isRTL ? 'תוכניות' : 'Shows', icon: Radio, count: shows?.length || 0 },
    { id: 'commercials' as const, label: isRTL ? 'פרסומות' : 'Commercials', icon: Megaphone, count: commercials?.length || 0 },
    { id: 'jingles' as const, label: isRTL ? "ג'ינגלים" : 'Jingles', icon: AudioLines, count: jingles?.length || 0 },
    { id: 'samples' as const, label: isRTL ? 'סמפלים' : 'Samples', icon: Layers, count: samples?.length || 0 },
  ]

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark-100">
          {isRTL ? 'ספריית מדיה' : 'Media Library'}
        </h1>
        <div className="flex items-center gap-4">
          <div className="tooltip-trigger">
            <button
              onClick={() => {
                console.log('Sync button clicked!')
                syncMutation.mutate()
              }}
              disabled={syncMutation.isPending}
              className="glass-button-primary flex items-center gap-2 px-4 py-2"
            >
              <FolderSync size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">
                {isRTL ? 'סנכרן עם Drive' : 'Sync with Drive'}
              </span>
            </button>
            <div className="tooltip tooltip-bottom">
              {isRTL ? 'סנכרן עם Google Drive' : 'Sync with Google Drive'}
            </div>
          </div>
          <div className="tooltip-trigger">
            <button
              onClick={() => refreshMetadataMutation.mutate()}
              disabled={refreshMetadataMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 text-dark-100 hover:bg-dark-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={refreshMetadataMutation.isPending ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">
                {isRTL ? 'רענן מטה-דאטה' : 'Refresh Metadata'}
              </span>
            </button>
            <div className="tooltip tooltip-bottom">
              {isRTL ? 'רענן מטה-דאטה מקבצי שמע' : 'Refresh metadata from audio files'}
            </div>
          </div>
          <div className="text-sm text-dark-400">
            {filteredContent.length} {isRTL ? 'פריטים' : 'items'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-glow'
                  : 'glass-button hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
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
            placeholder={isRTL ? 'חפש לפי שם או אמן...' : 'Search by title or artist...'}
            className="w-full pl-10 pr-4 py-2.5 glass-input"
            dir="auto"
          />
        </div>

        {activeTab === 'songs' && Array.isArray(genres) && genres.length > 0 && (
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-4 py-2 glass-input min-w-[150px]"
          >
            <option value="">{isRTL ? 'כל הז\'אנרים' : 'All Genres'}</option>
            {genres.map((genre: string) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && (
        <div className="flex items-center justify-between p-4 mb-4 rounded-xl bg-primary-500/20 border border-primary-500/30">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-dark-100">
              {isRTL
                ? `${selectedItems.size} נבחרו`
                : `${selectedItems.size} selected`}
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-dark-400 hover:text-dark-100 transition-colors flex items-center gap-1"
            >
              <XIcon size={14} />
              {isRTL ? 'בטל בחירה' : 'Clear selection'}
            </button>
            <button
              onClick={selectAll}
              className="text-sm text-dark-400 hover:text-dark-100 transition-colors"
            >
              {isRTL ? 'בחר הכל' : 'Select all'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSelectedToQueue}
              className="glass-button-primary flex items-center gap-2 px-4 py-2"
            >
              <ListPlus size={18} />
              {isRTL ? 'הוסף לתור' : 'Add to Queue'}
            </button>
          </div>
        </div>
      )}

      {/* Content List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredContent.length > 0 ? (
          <div className="space-y-2">
            {filteredContent.map((item: any) => {
              const isCurrentlyPlaying = currentTrack?._id === item._id

              const isSelected = selectedItems.has(item._id)

              return (
                <div
                  key={item._id}
                  className={`group flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isCurrentlyPlaying
                      ? 'bg-primary-500/20 border border-primary-500/30'
                      : isSelected
                      ? 'bg-primary-500/10 border border-primary-500/20'
                      : 'glass-card hover:bg-white/5'
                  }`}
                >
                  {/* Checkbox */}
                  <label className="relative flex items-center justify-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItemSelection(item._id)}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 rounded-lg border-2 border-dark-500 bg-dark-800/50 backdrop-blur-sm
                                  peer-checked:border-primary-500 peer-checked:bg-primary-500
                                  peer-focus:ring-2 peer-focus:ring-primary-500/30
                                  hover:border-dark-400
                                  transition-all duration-200 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </label>

                  {/* Play Button / Album Cover */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all overflow-hidden ${
                      isCurrentlyPlaying
                        ? 'ring-2 ring-primary-500'
                        : 'bg-dark-700/50 group-hover:bg-primary-500/20'
                    }`}>
                      <AlbumCover
                        contentId={item._id}
                        isPlaying={isCurrentlyPlaying}
                        type={item.type}
                      />
                    </div>
                    <button
                      onClick={() => handlePlay(item)}
                      className={`absolute inset-0 w-12 h-12 rounded-xl flex items-center justify-center
                        bg-primary-500/90 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isCurrentlyPlaying ? 'hidden' : ''
                      }`}
                    >
                      <Play size={20} className="text-white ml-0.5" />
                    </button>
                  </div>

                  {/* Title & Artist */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isCurrentlyPlaying ? 'text-primary-400' : 'text-dark-100'}`} dir="auto">
                      {item.title || 'Untitled'}
                    </p>
                    <p className="text-sm text-dark-400 truncate" dir="auto">
                      {item.artist || (item.type === 'commercial' ? (isRTL ? 'פרסומת' : 'Commercial') : (isRTL ? 'אמן לא ידוע' : 'Unknown Artist'))}
                    </p>
                  </div>

                  {/* Genre Badge */}
                  {item.genre && (
                    <span className="hidden md:inline-block px-3 py-1 text-xs rounded-full bg-dark-700/50 text-dark-300 border border-white/5">
                      {item.genre}
                    </span>
                  )}

                  {/* Batches Badge (for commercials) */}
                  {item.type === 'commercial' && item.batches && item.batches.length > 0 && (
                    <span className="hidden md:inline-block px-3 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {isRTL ? 'אצוות' : 'Batches'}: {item.batches.sort((a: number, b: number) => a - b).join(', ')}
                    </span>
                  )}

                  {/* Duration */}
                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-dark-400 min-w-[60px]">
                    <Clock size={14} />
                    <span className="font-mono">{formatDuration(item.duration_seconds)}</span>
                  </div>

                  {/* Play Count */}
                  <div className="hidden md:flex items-center gap-1.5 text-sm text-dark-400 min-w-[50px]">
                    <BarChart2 size={14} />
                    <span>{item.play_count || 0}</span>
                  </div>

                  {/* Last Played */}
                  {item.last_played && (
                    <div className="hidden lg:flex items-center gap-1.5 text-xs text-dark-500 min-w-[80px]">
                      <Calendar size={12} />
                      <span>{new Date(item.last_played).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <div className="tooltip-trigger">
                      <button
                        onClick={() => handleAddToQueue(item)}
                        className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-white/10 transition-all"
                      >
                        <Plus size={18} />
                      </button>
                      <div className="tooltip tooltip-left">
                        {isRTL ? 'הוסף לתור' : 'Add to queue'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-dark-800/50 flex items-center justify-center mb-4">
              <Music size={40} className="text-dark-600" />
            </div>
            <p className="text-dark-400 text-lg mb-2">
              {isRTL ? 'לא נמצא תוכן' : 'No content found'}
            </p>
            <p className="text-dark-500 text-sm">
              {searchQuery
                ? (isRTL ? 'נסה חיפוש אחר' : 'Try a different search')
                : (isRTL ? 'העלה קבצים כדי להתחיל' : 'Upload files to get started')
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Music, Radio, Megaphone, Search, Play, Plus,
  Clock, Calendar, Disc3, ListPlus, X as XIcon,
  AudioLines, Layers, Newspaper, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Save, Trash2, AlertTriangle, RefreshCw
} from 'lucide-react'
import { useService, useServiceMode } from '../services'
import { toast } from '../store/toastStore'
import { Select } from '../components/Form'
import { useDemoAwarePlayer } from '../hooks/useDemoAwarePlayer'

type SortField = 'title' | 'genre' | 'duration_seconds' | 'type' | 'created_at'
type SortDirection = 'asc' | 'desc'

const contentTypeOptions = [
  { value: 'song', label: 'Song', labelHe: 'שיר', icon: Music },
  { value: 'show', label: 'Show', labelHe: 'תוכנית', icon: Radio },
  { value: 'commercial', label: 'Commercial', labelHe: 'פרסומת', icon: Megaphone },
  { value: 'jingle', label: 'Jingle', labelHe: "ג'ינגל", icon: Disc3 },
  { value: 'sample', label: 'Sample', labelHe: 'סאמפל', icon: AudioLines },
  { value: 'newsflash', label: 'Newsflash', labelHe: 'מבזק חדשות', icon: Newspaper },
]

// Component to display album cover with fallback
function AlbumCover({ isPlaying, type, coverUrl }: { contentId: string; isPlaying: boolean; type: string; coverUrl: string }) {
  const [hasError, setHasError] = useState(false)

  const TypeIcon = type === 'song' ? Music
    : type === 'commercial' ? Megaphone
    : type === 'show' ? Radio
    : type === 'jingle' ? AudioLines
    : type === 'sample' ? Layers
    : type === 'newsflash' ? Newspaper
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

type ContentTab = 'songs' | 'shows' | 'commercials' | 'jingles' | 'samples' | 'newsflashes'

export default function Library() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const service = useService()
  const { canWrite } = useServiceMode()
  const [activeTab, setActiveTab] = useState<ContentTab>('songs')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('title')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editForm, setEditForm] = useState({ title: '', artist: '', genre: '', type: '' })
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)

  // Use demo-aware player for sandboxed playback in demo mode
  const { play, addToQueue, currentTrack } = useDemoAwarePlayer()
  const queryClient = useQueryClient()


  // Update content mutation
  const updateContentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => service.updateContent(id, data),
    onSuccess: () => {
      toast.success(isRTL ? 'התוכן עודכן בהצלחה' : 'Content updated successfully')
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      queryClient.invalidateQueries({ queryKey: ['commercials'] })
      queryClient.invalidateQueries({ queryKey: ['jingles'] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['newsflashes'] })
      setEditingItem(null)
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה בעדכון' : `Error: ${error.response?.data?.detail || error.message}`)
    }
  })

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: (id: string) => service.deleteContent(id),
    onSuccess: async () => {
      toast.success(isRTL ? 'התוכן נמחק בהצלחה' : 'Content deleted successfully')
      // Refetch only the active tab's content
      await queryClient.refetchQueries({ queryKey: [activeTab] })
    },
    onError: (error: any) => {
      toast.error(isRTL ? 'שגיאה במחיקה' : `Error: ${error.response?.data?.detail || error.message}`)
    }
  })

  const handleDelete = (item: any) => {
    setConfirmDelete(item)
  }

  const confirmDeleteAction = () => {
    if (confirmDelete) {
      deleteContentMutation.mutate(confirmDelete._id)
      setConfirmDelete(null)
    }
  }

  // Batch delete
  const handleDeleteSelected = () => {
    if (selectedItems.size > 0) {
      setConfirmBatchDelete(true)
    }
  }

  const confirmBatchDeleteAction = async () => {
    const itemsToDelete = Array.from(selectedItems)
    setConfirmBatchDelete(false)

    try {
      const result: any = await service.batchDeleteContent(itemsToDelete)
      const deletedCount = result?.deleted_count ?? result?.deleted ?? itemsToDelete.length
      toast.success(isRTL ? `${deletedCount} פריטים נמחקו בהצלחה` : `${deletedCount} items deleted successfully`)
    } catch (error: any) {
      toast.error(isRTL ? 'שגיאה במחיקת פריטים' : `Error: ${error.response?.data?.detail || error.message}`)
    }

    // Clear selection and refetch
    clearSelection()
    await queryClient.refetchQueries({ queryKey: [activeTab] })
  }

  const handleEdit = (item: any) => {
    setEditingItem(item)
    setEditForm({
      title: item.title || '',
      artist: item.artist || '',
      genre: item.genre || '',
      type: item.type || ''
    })
  }

  const handleSaveEdit = () => {
    if (!editingItem) return
    updateContentMutation.mutate({
      id: editingItem._id,
      data: {
        title: editForm.title,
        artist: editForm.artist,
        genre: editForm.genre,
        type: editForm.type
      }
    })
  }

  const { data: songs, isLoading: loadingSongs } = useQuery({
    queryKey: ['songs'],
    queryFn: () => service.getSongs(),
  })

  const { data: shows, isLoading: loadingShows } = useQuery({
    queryKey: ['shows'],
    queryFn: () => service.getShows(),
  })

  const { data: commercials, isLoading: loadingCommercials } = useQuery({
    queryKey: ['commercials'],
    queryFn: () => service.getCommercials(),
  })

  const { data: jingles, isLoading: loadingJingles } = useQuery({
    queryKey: ['jingles'],
    queryFn: () => service.getJingles(),
  })

  const { data: samples, isLoading: loadingSamples } = useQuery({
    queryKey: ['samples'],
    queryFn: () => service.getSamples(),
  })

  const { data: newsflashes, isLoading: loadingNewsflashes } = useQuery({
    queryKey: ['newsflashes'],
    queryFn: () => service.getNewsflashes(),
  })

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: () => service.getGenres(),
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
      case 'newsflashes':
        return Array.isArray(newsflashes) ? newsflashes : []
      default:
        return []
    }
  }

  const isLoading = activeTab === 'songs' ? loadingSongs
    : activeTab === 'shows' ? loadingShows
    : activeTab === 'commercials' ? loadingCommercials
    : activeTab === 'jingles' ? loadingJingles
    : activeTab === 'samples' ? loadingSamples
    : loadingNewsflashes

  const content = getContent()

  // Filter by search and genre, then sort
  const filteredContent = useMemo(() => {
    const filtered = content.filter((item: any) => {
      const matchesSearch = !searchQuery ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.artist?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesGenre = !selectedGenre || item.genre === selectedGenre
      return matchesSearch && matchesGenre
    })

    // Sort the filtered content
    return [...filtered].sort((a: any, b: any) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      // Handle null/undefined values
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''

      // Convert to lowercase for string comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()

      // Compare
      let comparison = 0
      if (aVal < bVal) comparison = -1
      else if (aVal > bVal) comparison = 1

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [content, searchQuery, selectedGenre, sortField, sortDirection])

  // Toggle sort for a column
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDirection)
    } else {
      // Set new field with ascending direction
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown size={14} className="text-dark-500" />
    }
    return sortDirection === 'asc'
      ? <ChevronUp size={14} className="text-primary-400" />
      : <ChevronDown size={14} className="text-primary-400" />
  }

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

  // Manual refresh function
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['songs'] })
    await queryClient.invalidateQueries({ queryKey: ['shows'] })
    await queryClient.invalidateQueries({ queryKey: ['commercials'] })
    await queryClient.invalidateQueries({ queryKey: ['jingles'] })
    await queryClient.invalidateQueries({ queryKey: ['samples'] })
    await queryClient.invalidateQueries({ queryKey: ['newsflashes'] })
    await queryClient.invalidateQueries({ queryKey: ['genres'] })
    toast.success(isRTL ? 'הספרייה רועננה' : 'Library refreshed')
  }

  const tabs = [
    { id: 'songs' as const, label: isRTL ? 'שירים' : 'Songs', icon: Music, count: songs?.length || 0 },
    { id: 'shows' as const, label: isRTL ? 'תוכניות' : 'Shows', icon: Radio, count: shows?.length || 0 },
    { id: 'commercials' as const, label: isRTL ? 'פרסומות' : 'Commercials', icon: Megaphone, count: commercials?.length || 0 },
    { id: 'jingles' as const, label: isRTL ? "ג'ינגלים" : 'Jingles', icon: AudioLines, count: jingles?.length || 0 },
    { id: 'samples' as const, label: isRTL ? 'סמפלים' : 'Samples', icon: Layers, count: samples?.length || 0 },
    { id: 'newsflashes' as const, label: isRTL ? 'חדשות' : 'News', icon: Newspaper, count: newsflashes?.length || 0 },
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
      <div className="flex gap-4 mb-6 items-center">
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
          <div className="flex items-center gap-3">
            <Select
              value={selectedGenre}
              onChange={setSelectedGenre}
              placeholder={isRTL ? "כל הז'אנרים" : 'All Genres'}
              className="min-w-[200px]"
              options={[
                { value: '', label: isRTL ? "כל הז'אנרים" : 'All Genres', description: `${content.length} ${isRTL ? 'שירים' : 'songs'}` },
                ...genres.map((genre: string) => {
                  const genreCount = content.filter((item: any) => item.genre === genre).length
                  return {
                    value: genre,
                    label: genre,
                    description: `${genreCount} ${isRTL ? 'שירים' : 'songs'}`
                  }
                })
              ]}
            />
            <div className="px-3 py-1.5 rounded-lg bg-dark-800/50 border border-dark-700/50">
              <span className="text-sm font-medium text-primary-400">{filteredContent.length}</span>
              <span className="text-sm text-dark-400 ml-1">{isRTL ? 'פריטים' : 'items'}</span>
            </div>
          </div>
        )}

        {/* Show item count for non-songs tabs */}
        {activeTab !== 'songs' && (
          <div className="px-3 py-1.5 rounded-lg bg-dark-800/50 border border-dark-700/50">
            <span className="text-sm font-medium text-primary-400">{filteredContent.length}</span>
            <span className="text-sm text-dark-400 ml-1">{isRTL ? 'פריטים' : 'items'}</span>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2.5 glass-button hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title={isRTL ? 'רענן ספרייה' : 'Refresh library'}
        >
          <RefreshCw size={20} className={`${isLoading ? 'animate-spin' : ''}`} />
        </button>
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
            {canWrite && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
              >
                <Trash2 size={18} />
                {isRTL ? 'מחק נבחרים' : 'Delete Selected'}
              </button>
            )}
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

      {/* Content Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredContent.length > 0 ? (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-dark-800/50 border-b border-dark-700">
                <tr>
                  {/* Checkbox Header */}
                  <th className="w-12 px-4 py-3">
                    <label className="relative flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === filteredContent.length && filteredContent.length > 0}
                        onChange={() => selectedItems.size === filteredContent.length ? clearSelection() : selectAll()}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 rounded-lg border-2 border-dark-500 bg-dark-800/50
                                    peer-checked:border-primary-500 peer-checked:bg-primary-500
                                    transition-all duration-200 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </label>
                  </th>
                  {/* Play Button Column */}
                  <th className="w-16 px-2 py-3"></th>
                  {/* Name */}
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('title')}
                      className="flex items-center gap-2 text-xs font-semibold text-dark-300 uppercase tracking-wider hover:text-dark-100 transition-colors"
                    >
                      {isRTL ? 'שם' : 'Name'}
                      <SortIndicator field="title" />
                    </button>
                  </th>
                  {/* Genre */}
                  <th className="hidden md:table-cell px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('genre')}
                      className="flex items-center gap-2 text-xs font-semibold text-dark-300 uppercase tracking-wider hover:text-dark-100 transition-colors"
                    >
                      {isRTL ? "ז'אנר" : 'Genre'}
                      <SortIndicator field="genre" />
                    </button>
                  </th>
                  {/* Duration */}
                  <th className="hidden sm:table-cell px-4 py-3 text-left w-28">
                    <button
                      onClick={() => handleSort('duration_seconds')}
                      className="flex items-center gap-2 text-xs font-semibold text-dark-300 uppercase tracking-wider hover:text-dark-100 transition-colors"
                    >
                      {isRTL ? 'משך' : 'Duration'}
                      <SortIndicator field="duration_seconds" />
                    </button>
                  </th>
                  {/* Type */}
                  <th className="hidden lg:table-cell px-4 py-3 text-left w-28">
                    <button
                      onClick={() => handleSort('type')}
                      className="flex items-center gap-2 text-xs font-semibold text-dark-300 uppercase tracking-wider hover:text-dark-100 transition-colors"
                    >
                      {isRTL ? 'סוג' : 'Type'}
                      <SortIndicator field="type" />
                    </button>
                  </th>
                  {/* Date Added */}
                  <th className="hidden xl:table-cell px-4 py-3 text-left w-32">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center gap-2 text-xs font-semibold text-dark-300 uppercase tracking-wider hover:text-dark-100 transition-colors"
                    >
                      {isRTL ? 'נוסף' : 'Added'}
                      <SortIndicator field="created_at" />
                    </button>
                  </th>
                  {/* Actions */}
                  <th className="w-16 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {filteredContent.map((item: any) => {
                  const isCurrentlyPlaying = currentTrack?._id === item._id
                  const isSelected = selectedItems.has(item._id)

                  const TypeIcon = item.type === 'song' ? Music
                    : item.type === 'commercial' ? Megaphone
                    : item.type === 'show' ? Radio
                    : item.type === 'jingle' ? AudioLines
                    : item.type === 'sample' ? Layers
                    : item.type === 'newsflash' ? Newspaper
                    : Disc3

                  return (
                    <tr
                      key={item._id}
                      className={`group transition-all ${
                        isCurrentlyPlaying
                          ? 'bg-primary-500/10'
                          : isSelected
                          ? 'bg-primary-500/5'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <label className="relative flex items-center justify-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemSelection(item._id)}
                            className="sr-only peer"
                          />
                          <div className="w-5 h-5 rounded-lg border-2 border-dark-500 bg-dark-800/50
                                        peer-checked:border-primary-500 peer-checked:bg-primary-500
                                        transition-all duration-200 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        </label>
                      </td>
                      {/* Play Button / Cover */}
                      <td className="px-2 py-3">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all overflow-hidden ${
                            isCurrentlyPlaying
                              ? 'ring-2 ring-primary-500'
                              : 'bg-dark-700/50 group-hover:bg-primary-500/20'
                          }`}>
                            <AlbumCover
                              contentId={item._id}
                              isPlaying={isCurrentlyPlaying}
                              type={item.type}
                              coverUrl={service.getCoverUrl(item._id)}
                            />
                          </div>
                          <button
                            onClick={() => handlePlay(item)}
                            className={`absolute inset-0 w-10 h-10 rounded-lg flex items-center justify-center
                              bg-primary-500/90 opacity-0 group-hover:opacity-100 transition-opacity ${
                              isCurrentlyPlaying ? 'hidden' : ''
                            }`}
                          >
                            <Play size={16} className="text-white ml-0.5" />
                          </button>
                        </div>
                      </td>
                      {/* Name (Title + Artist) */}
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${isCurrentlyPlaying ? 'text-primary-400' : 'text-dark-100'}`} dir="auto">
                            {item.title || 'Untitled'}
                          </p>
                          <p className="text-sm text-dark-400 truncate" dir="auto">
                            {item.artist || (item.type === 'commercial' ? (isRTL ? 'פרסומת' : 'Commercial') : (isRTL ? 'אמן לא ידוע' : 'Unknown Artist'))}
                          </p>
                        </div>
                      </td>
                      {/* Genre */}
                      <td className="hidden md:table-cell px-4 py-3">
                        {item.genre ? (
                          <span className="px-2.5 py-1 text-xs rounded-full bg-dark-700/50 text-dark-300 border border-white/5">
                            {item.genre}
                          </span>
                        ) : (
                          <span className="text-dark-500 text-sm">—</span>
                        )}
                      </td>
                      {/* Duration */}
                      <td className="hidden sm:table-cell px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-dark-400">
                          <Clock size={14} />
                          <span className="font-mono">{formatDuration(item.duration_seconds)}</span>
                        </div>
                      </td>
                      {/* Type */}
                      <td className="hidden lg:table-cell px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TypeIcon size={14} className="text-dark-400" />
                          <span className="text-sm text-dark-300 capitalize">{item.type}</span>
                        </div>
                      </td>
                      {/* Date Added */}
                      <td className="hidden xl:table-cell px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-dark-500">
                          <Calendar size={12} />
                          <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <div className="tooltip-trigger">
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-2 rounded-lg text-dark-400 hover:text-primary-400 hover:bg-white/10 transition-all"
                              >
                                <Pencil size={16} />
                              </button>
                              <div className="tooltip tooltip-left">
                                {isRTL ? 'ערוך' : 'Edit'}
                              </div>
                            </div>
                          )}
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
                          {canWrite && (
                            <div className="tooltip-trigger">
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                              <div className="tooltip tooltip-left">
                                {isRTL ? 'מחק' : 'Delete'}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-100">
                {isRTL ? 'עריכת פריט' : 'Edit Item'}
              </h2>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-white/10"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? 'כותרת' : 'Title'}
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-2 glass-input"
                  dir="auto"
                />
              </div>

              {/* Artist */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? 'אמן' : 'Artist'}
                </label>
                <input
                  type="text"
                  value={editForm.artist}
                  onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                  className="w-full px-4 py-2 glass-input"
                  dir="auto"
                />
              </div>

              {/* Genre */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? "ז'אנר" : 'Genre'}
                </label>
                <input
                  type="text"
                  value={editForm.genre}
                  onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                  className="w-full px-4 py-2 glass-input"
                  dir="auto"
                  list="genre-list"
                />
                {Array.isArray(genres) && genres.length > 0 && (
                  <datalist id="genre-list">
                    {genres.map((g: string) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                )}
              </div>

              {/* Type (editable) */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {isRTL ? 'סוג' : 'Type'}
                </label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="w-full px-4 py-2 glass-input capitalize"
                >
                  {contentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {isRTL ? option.labelHe : option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-lg text-dark-300 hover:text-dark-100 hover:bg-white/10 transition-colors"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateContentMutation.isPending}
                className="glass-button-primary flex items-center gap-2 px-4 py-2"
              >
                <Save size={16} />
                {updateContentMutation.isPending
                  ? (isRTL ? 'שומר...' : 'Saving...')
                  : (isRTL ? 'שמור' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-dark-100 mb-4">
              {isRTL ? 'מחיקת פריט' : 'Delete Item'}
            </h3>
            <p className="text-dark-300 mb-2" dir="auto">
              {isRTL ? `האם למחוק את "${confirmDelete.title}"?` : `Delete "${confirmDelete.title}"?`}
            </p>
            <p className="text-yellow-400 text-sm mb-6 flex items-center gap-2">
              <AlertTriangle size={16} />
              {isRTL ? 'פעולה זו אינה ניתנת לביטול' : 'This action cannot be undone'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 glass-button py-2"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeleteAction}
                disabled={deleteContentMutation.isPending}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg py-2 transition-colors"
              >
                {deleteContentMutation.isPending
                  ? (isRTL ? 'מוחק...' : 'Deleting...')
                  : (isRTL ? 'מחק' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {confirmBatchDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-dark-100 mb-4">
              {isRTL ? 'מחיקת פריטים' : 'Delete Items'}
            </h3>
            <p className="text-dark-300 mb-2">
              {isRTL
                ? `האם למחוק ${selectedItems.size} פריטים?`
                : `Delete ${selectedItems.size} items?`}
            </p>
            <p className="text-yellow-400 text-sm mb-6 flex items-center gap-2">
              <AlertTriangle size={16} />
              {isRTL ? 'פעולה זו אינה ניתנת לביטול' : 'This action cannot be undone'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmBatchDelete(false)}
                className="flex-1 glass-button py-2"
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={confirmBatchDeleteAction}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg py-2 transition-colors"
              >
                {isRTL ? 'מחק הכל' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

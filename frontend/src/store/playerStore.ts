import { create } from 'zustand'
import { api } from '../services/api'

interface Track {
  _id: string
  title: string
  artist?: string
  type: string
  duration_seconds?: number
  genre?: string
  google_drive_path?: string
  play_count?: number
  last_played?: string
  created_at?: string
  batches?: number[]
  metadata?: {
    album?: string
    year?: number
    language?: string
    tags?: string[]
  }
}

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  volume: number
  hasUserInteracted: boolean  // Track if user has interacted with page (for autoplay policy)

  // Actions
  setCurrentTrack: (track: Track | null) => void
  setQueue: (queue: Track[]) => void  // Set queue from backend
  fetchQueue: () => Promise<void>     // Fetch queue from backend
  validateQueue: (queue: Track[]) => Promise<Track[]>  // Validate queue items exist
  play: (track: Track) => void
  playNow: (track: Track) => void      // Interrupt current and play immediately
  playOrQueue: (track: Track) => void  // Play if nothing playing, else queue next
  addToQueue: (track: Track) => Promise<void>
  queueNext: (track: Track) => void    // Insert at front of queue
  removeFromQueue: (index: number) => Promise<void>
  clearQueue: () => Promise<void>
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<void>
  playNext: () => Promise<void>
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setUserInteracted: () => void  // Mark that user has interacted with the page
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 80,
  hasUserInteracted: false,

  setCurrentTrack: (track) => set({ currentTrack: track }),

  // Set queue from backend (used by WebSocket)
  setQueue: (queue) => set({ queue: Array.isArray(queue) ? queue : [] }),

  // Fetch queue from backend
  fetchQueue: async () => {
    try {
      const queue = await api.getQueue()
      const validatedQueue = await get().validateQueue(Array.isArray(queue) ? queue : [])
      set({ queue: validatedQueue })
    } catch (error) {
      console.error('Failed to fetch queue:', error)
      set({ queue: [] })
    }
  },

  // Validate queue items exist and are accessible - removes stale items
  validateQueue: async (queue: Track[]) => {
    if (queue.length === 0) return []

    // Validate items in parallel (check if content exists)
    const validationResults = await Promise.all(
      queue.map(async (track) => {
        try {
          // Try to fetch content info - if it exists, it's valid
          await api.getContentById(track._id)
          return { track, valid: true }
        } catch (error) {
          // Content doesn't exist or is inaccessible
          console.warn(`Queue validation: removing stale track "${track.title}" (${track._id})`)
          return { track, valid: false }
        }
      })
    )

    const validTracks = validationResults.filter(r => r.valid).map(r => r.track)
    const invalidCount = queue.length - validTracks.length

    if (invalidCount > 0) {
      console.log(`Queue validation: removed ${invalidCount} stale item(s)`)
    }

    return validTracks
  },

  play: (track) => {
    set({ currentTrack: track, isPlaying: true })
  },

  // Interrupt current playback and play immediately (for chat requests)
  playNow: (track) => {
    const { currentTrack } = get()

    // If same track is already playing, just ensure it's playing
    if (currentTrack && currentTrack._id === track._id) {
      set({ isPlaying: true })
      return
    }

    // Play the new track immediately
    set({ currentTrack: track, isPlaying: true })
  },

  // Play immediately if nothing playing, otherwise queue as next track
  playOrQueue: async (track) => {
    const { currentTrack, isPlaying } = get()
    if (!currentTrack || !isPlaying) {
      // Nothing playing - play immediately
      set({ currentTrack: track, isPlaying: true })
    } else {
      // Something playing - add to backend queue
      try {
        await api.addToQueue(track._id)
      } catch (error) {
        console.error('Failed to queue track:', error)
      }
    }
  },

  addToQueue: async (track) => {
    const { currentTrack, isPlaying } = get()

    // If nothing is playing, play immediately instead of queuing
    if (!currentTrack || !isPlaying) {
      set({ currentTrack: track, isPlaying: true })
      return
    }

    // Add to backend queue (backend will broadcast update)
    try {
      await api.addToQueue(track._id)
    } catch (error) {
      console.error('Failed to add to queue:', error)
    }
  },

  // Insert at front of queue (will play next after current track)
  queueNext: async (track) => {
    const { currentTrack, isPlaying } = get()

    // If nothing is playing, play immediately instead of queuing
    if (!currentTrack || !isPlaying) {
      set({ currentTrack: track, isPlaying: true })
      return
    }

    // Add to backend queue then reorder to front
    try {
      await api.addToQueue(track._id)
      // Get current queue length to find the newly added item (it's at the end)
      const currentQueue = get().queue
      const newItemIndex = currentQueue.length
      // Reorder to position 0 (front of queue)
      await api.reorderQueue(newItemIndex, 0)
    } catch (error) {
      console.error('Failed to queue next:', error)
    }
  },

  removeFromQueue: async (index) => {
    const originalQueue = get().queue

    // Optimistic update - remove locally first for instant UI feedback
    const newQueue = [...originalQueue]
    newQueue.splice(index, 1)
    set({ queue: newQueue })

    // Then sync with backend
    try {
      await api.removeFromQueue(index)
      // Don't fetchQueue after remove - we already have the correct state locally
    } catch (error) {
      console.error('Failed to remove from queue:', error)
      // Revert to original queue on error
      set({ queue: originalQueue })
    }
  },

  clearQueue: async () => {
    const originalQueue = get().queue

    // Optimistic update - clear locally first for instant UI feedback
    set({ queue: [] })

    // Then sync with backend
    try {
      await api.clearQueue()
    } catch (error) {
      console.error('Failed to clear queue:', error)
      // Revert to original queue on error
      set({ queue: originalQueue })
    }
  },

  reorderQueue: async (fromIndex: number, toIndex: number) => {
    const originalQueue = get().queue

    // Optimistic update - reorder locally first for instant UI feedback
    const newQueue = [...originalQueue]
    const [movedItem] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, movedItem)
    set({ queue: newQueue })

    // Then sync with backend
    try {
      await api.reorderQueue(fromIndex, toIndex)
      // Don't fetchQueue after reorder - we already have the correct order locally
      // This prevents race conditions and duplicate index issues
    } catch (error) {
      console.error('Failed to reorder queue:', error)
      // Revert to original queue on error
      set({ queue: originalQueue })
    }
  },

  playNext: async () => {
    // Set isPlaying immediately to prevent race conditions with auto-play triggers
    set({ isPlaying: true })

    // Call backend to get next track - this ensures server knows playback state
    try {
      const response = await api.getNextTrack()

      if (response.next_track) {
        // Server returned a track - play it
        set({ currentTrack: response.next_track, isPlaying: true })
        console.log('Playing next track from server:', response.next_track.title)
      } else {
        // Queue is empty on server - it will be refilled automatically
        // For now, stop playback (server will broadcast when queue is ready)
        console.log('Queue empty, waiting for server to refill...')
        set({ currentTrack: null, isPlaying: false })
      }
    } catch (error) {
      console.error('Failed to get next track from server:', error)
      // Fallback to local queue if server unavailable
      const { queue } = get()
      if (queue.length > 0) {
        const [next, ...rest] = queue
        set({ currentTrack: next, queue: rest, isPlaying: true })
        console.log('Fallback: playing next from local queue:', next.title)
      } else {
        set({ currentTrack: null, isPlaying: false })
      }
    }
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setVolume: (volume) => set({ volume }),

  setUserInteracted: () => set({ hasUserInteracted: true })
}))

// Fetch and validate queue on store initialization (gracefully handle missing backend)
api.getQueue().then(async (queue) => {
  if (Array.isArray(queue) && queue.length > 0) {
    // Validate queue items exist before setting
    const validatedQueue = await usePlayerStore.getState().validateQueue(queue)
    usePlayerStore.setState({ queue: validatedQueue })
  } else {
    usePlayerStore.setState({ queue: [] })
  }
}).catch(error => {
  console.warn('Backend not available, using empty queue:', error.message)
  usePlayerStore.setState({ queue: [] })
})

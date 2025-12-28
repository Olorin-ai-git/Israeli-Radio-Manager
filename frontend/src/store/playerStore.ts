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

  // Actions
  setCurrentTrack: (track: Track | null) => void
  play: (track: Track) => void
  playOrQueue: (track: Track) => void  // Play if nothing playing, else queue next
  addToQueue: (track: Track) => void
  queueNext: (track: Track) => void    // Insert at front of queue
  removeFromQueue: (index: number) => Promise<void>
  clearQueue: () => Promise<void>
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<void>
  playNext: () => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 80,

  setCurrentTrack: (track) => set({ currentTrack: track }),

  play: (track) => {
    set({ currentTrack: track, isPlaying: true })
  },

  // Play immediately if nothing playing, otherwise queue as next track
  playOrQueue: (track) => {
    const { currentTrack, isPlaying } = get()
    if (!currentTrack || !isPlaying) {
      // Nothing playing - play immediately
      set({ currentTrack: track, isPlaying: true })
    } else {
      // Something playing - add to front of queue (plays next)
      set((state) => ({ queue: [track, ...state.queue] }))
    }
  },

  addToQueue: async (track) => {
    // Add to local queue state
    set((state) => ({ queue: [...state.queue, track] }))

    // Call backend API to handle auto-play logic
    try {
      const response = await api.addToQueue(track._id)
      console.log('Queue response:', response)

      // If backend auto-played it, update our state
      if (response.auto_played) {
        set({ currentTrack: track, isPlaying: true, queue: get().queue.filter(t => t._id !== track._id) })
      }
    } catch (error) {
      console.error('Failed to add to queue:', error)
    }
  },

  // Insert at front of queue (will play next after current track)
  queueNext: (track) => {
    set((state) => ({ queue: [track, ...state.queue] }))
  },

  removeFromQueue: async (index) => {
    // Optimistically update UI
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index)
    }))

    // Call backend API
    try {
      await api.removeFromQueue(index)
    } catch (error) {
      console.error('Failed to remove from queue:', error)
    }
  },

  clearQueue: async () => {
    // Optimistically update UI
    set({ queue: [] })

    // Call backend API
    try {
      await api.clearQueue()
    } catch (error) {
      console.error('Failed to clear queue:', error)
    }
  },

  reorderQueue: async (fromIndex: number, toIndex: number) => {
    const { queue } = get()

    // Optimistically update UI
    const newQueue = [...queue]
    const [movedItem] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, movedItem)
    set({ queue: newQueue })

    // Call backend API
    try {
      await api.reorderQueue(fromIndex, toIndex)
    } catch (error) {
      console.error('Failed to reorder queue:', error)
      // Revert on error
      set({ queue })
    }
  },

  playNext: () => {
    const { queue } = get()
    if (queue.length > 0) {
      const [next, ...rest] = queue
      set({ currentTrack: next, queue: rest, isPlaying: true })
    } else {
      set({ currentTrack: null, isPlaying: false })
    }
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setVolume: (volume) => set({ volume })
}))

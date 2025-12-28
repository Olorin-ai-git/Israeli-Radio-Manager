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

  // Actions
  setCurrentTrack: (track: Track | null) => void
  setQueue: (queue: Track[]) => void  // Set queue from backend
  fetchQueue: () => Promise<void>     // Fetch queue from backend
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
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 80,

  setCurrentTrack: (track) => set({ currentTrack: track }),

  // Set queue from backend (used by WebSocket)
  setQueue: (queue) => set({ queue }),

  // Fetch queue from backend
  fetchQueue: async () => {
    try {
      const queue = await api.getQueue()
      set({ queue })
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
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
  queueNext: (track) => {
    // For now, just add to front of local queue
    // TODO: Add backend support for queue position
    set((state) => ({ queue: [track, ...state.queue] }))
  },

  removeFromQueue: async (index) => {
    // Call backend API (backend will broadcast update)
    try {
      await api.removeFromQueue(index)
    } catch (error) {
      console.error('Failed to remove from queue:', error)
    }
  },

  clearQueue: async () => {
    // Call backend API (backend will broadcast update)
    try {
      await api.clearQueue()
    } catch (error) {
      console.error('Failed to clear queue:', error)
    }
  },

  reorderQueue: async (fromIndex: number, toIndex: number) => {
    // Call backend API (backend will broadcast update)
    try {
      await api.reorderQueue(fromIndex, toIndex)
    } catch (error) {
      console.error('Failed to reorder queue:', error)
    }
  },

  playNext: async () => {
    const { queue } = get()
    if (queue.length > 0) {
      const [next, ...rest] = queue
      set({ currentTrack: next, queue: rest, isPlaying: true })

      // Remove from backend queue
      try {
        await api.removeFromQueue(0)
      } catch (error) {
        console.error('Failed to remove played track from queue:', error)
      }
    } else {
      set({ currentTrack: null, isPlaying: false })
    }
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setVolume: (volume) => set({ volume })
}))

// Fetch queue on store initialization
api.getQueue().then(queue => {
  usePlayerStore.setState({ queue })
}).catch(error => {
  console.error('Failed to fetch initial queue:', error)
})

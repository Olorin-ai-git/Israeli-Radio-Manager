import { create } from 'zustand'
import { api } from '../services/api'

interface Track {
  _id: string
  title: string
  artist?: string
  type: string
  duration_seconds?: number
  genre?: string
}

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  volume: number

  // Actions
  setCurrentTrack: (track: Track | null) => void
  play: (track: Track) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
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

  addToQueue: (track) => {
    set((state) => ({ queue: [...state.queue, track] }))
  },

  removeFromQueue: (index) => {
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index)
    }))
  },

  clearQueue: () => set({ queue: [] }),

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

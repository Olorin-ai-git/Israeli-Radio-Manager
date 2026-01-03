import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Demo Store - Sandboxed state for demo mode
 *
 * When users are in demo mode, all write operations use this local store
 * instead of affecting production data. This provides a safe sandbox
 * for demo users to explore the interface.
 */

export interface DemoTrack {
  _id: string
  title: string
  artist?: string
  type: string
  duration_seconds?: number
  genre?: string
}

interface DemoState {
  // Playback
  demoQueue: DemoTrack[]
  demoCurrentTrack: DemoTrack | null
  demoIsPlaying: boolean

  // Actions - Playback
  addToDemoQueue: (track: DemoTrack) => void
  removeFromDemoQueue: (index: number) => void
  clearDemoQueue: () => void
  reorderDemoQueue: (fromIndex: number, toIndex: number) => void
  playDemoTrack: (track: DemoTrack) => void
  playNextDemo: () => void
  setDemoPlaying: (playing: boolean) => void
  stopDemo: () => void

  // Reset
  resetDemoState: () => void
}

const initialState = {
  demoQueue: [],
  demoCurrentTrack: null,
  demoIsPlaying: false,
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Add track to demo queue
      addToDemoQueue: (track) => {
        set((state) => ({
          demoQueue: [...state.demoQueue, track],
        }))
      },

      // Remove track from demo queue
      removeFromDemoQueue: (index) => {
        set((state) => ({
          demoQueue: state.demoQueue.filter((_, i) => i !== index),
        }))
      },

      // Clear demo queue
      clearDemoQueue: () => {
        set({ demoQueue: [] })
      },

      // Reorder demo queue
      reorderDemoQueue: (fromIndex, toIndex) => {
        set((state) => {
          const newQueue = [...state.demoQueue]
          const [removed] = newQueue.splice(fromIndex, 1)
          newQueue.splice(toIndex, 0, removed)
          return { demoQueue: newQueue }
        })
      },

      // Play a track immediately in demo mode
      playDemoTrack: (track) => {
        set({
          demoCurrentTrack: track,
          demoIsPlaying: true,
        })
      },

      // Play next track from demo queue
      playNextDemo: () => {
        const { demoQueue } = get()
        if (demoQueue.length > 0) {
          const [nextTrack, ...remainingQueue] = demoQueue
          set({
            demoCurrentTrack: nextTrack,
            demoQueue: remainingQueue,
            demoIsPlaying: true,
          })
        } else {
          set({
            demoCurrentTrack: null,
            demoIsPlaying: false,
          })
        }
      },

      // Set playing state
      setDemoPlaying: (playing) => {
        set({ demoIsPlaying: playing })
      },

      // Stop demo playback
      stopDemo: () => {
        set({
          demoCurrentTrack: null,
          demoIsPlaying: false,
        })
      },

      // Reset all demo state
      resetDemoState: () => {
        set(initialState)
      },
    }),
    {
      name: 'demo-store',
      partialize: (state) => ({
        demoQueue: state.demoQueue,
        demoCurrentTrack: state.demoCurrentTrack,
      }),
    }
  )
)

export default useDemoStore

import { useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useDemoStore, DemoTrack } from '../store/demoStore'
import { useDemoMode } from './useDemoMode'
import { toast } from '../store/toastStore'
import { useTranslation } from 'react-i18next'

/**
 * Demo-aware player hook
 *
 * When in demo mode (viewer on demo site), all playback operations
 * are sandboxed to the demo store. Production playback is never affected.
 *
 * When not in demo mode, operations go to the real player store.
 */
export function useDemoAwarePlayer() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const { isViewer, isDemoHost } = useDemoMode()
  const isInDemoMode = isViewer && isDemoHost

  // Real player store
  const playerStore = usePlayerStore()

  // Demo store
  const demoStore = useDemoStore()

  // Get current state based on mode
  const currentTrack = isInDemoMode ? demoStore.demoCurrentTrack : playerStore.currentTrack
  const queue = isInDemoMode ? demoStore.demoQueue : playerStore.queue
  const isPlaying = isInDemoMode ? demoStore.demoIsPlaying : playerStore.isPlaying

  // Convert any track to DemoTrack format
  const toDemoTrack = (track: any): DemoTrack => ({
    _id: track._id,
    title: track.title,
    artist: track.artist,
    type: track.type,
    duration_seconds: track.duration_seconds,
    genre: track.genre,
  })

  // Play a track
  const play = useCallback((track: any) => {
    if (isInDemoMode) {
      demoStore.playDemoTrack(toDemoTrack(track))
      toast.info(isRTL ? 'מצב הדגמה - הנגינה מדומה' : 'Demo mode - playback is simulated')
    } else {
      playerStore.play(track)
    }
  }, [isInDemoMode, demoStore, playerStore, isRTL])

  // Add to queue
  const addToQueue = useCallback(async (track: any) => {
    if (isInDemoMode) {
      const demoTrack = toDemoTrack(track)
      if (!demoStore.demoCurrentTrack) {
        demoStore.playDemoTrack(demoTrack)
      } else {
        demoStore.addToDemoQueue(demoTrack)
      }
      toast.info(isRTL ? 'נוסף לתור ההדגמה' : 'Added to demo queue')
    } else {
      await playerStore.addToQueue(track)
    }
  }, [isInDemoMode, demoStore, playerStore, isRTL])

  // Remove from queue
  const removeFromQueue = useCallback(async (index: number) => {
    if (isInDemoMode) {
      demoStore.removeFromDemoQueue(index)
    } else {
      await playerStore.removeFromQueue(index)
    }
  }, [isInDemoMode, demoStore, playerStore])

  // Clear queue
  const clearQueue = useCallback(async () => {
    if (isInDemoMode) {
      demoStore.clearDemoQueue()
    } else {
      await playerStore.clearQueue()
    }
  }, [isInDemoMode, demoStore, playerStore])

  // Reorder queue
  const reorderQueue = useCallback(async (fromIndex: number, toIndex: number) => {
    if (isInDemoMode) {
      demoStore.reorderDemoQueue(fromIndex, toIndex)
    } else {
      await playerStore.reorderQueue(fromIndex, toIndex)
    }
  }, [isInDemoMode, demoStore, playerStore])

  // Play next
  const playNext = useCallback(async () => {
    if (isInDemoMode) {
      demoStore.playNextDemo()
    } else {
      await playerStore.playNext()
    }
  }, [isInDemoMode, demoStore, playerStore])

  // Set playing state
  const setIsPlaying = useCallback((playing: boolean) => {
    if (isInDemoMode) {
      demoStore.setDemoPlaying(playing)
    } else {
      playerStore.setIsPlaying(playing)
    }
  }, [isInDemoMode, demoStore, playerStore])

  // Stop playback
  const stop = useCallback(() => {
    if (isInDemoMode) {
      demoStore.stopDemo()
    } else {
      playerStore.setIsPlaying(false)
      playerStore.setCurrentTrack(null)
    }
  }, [isInDemoMode, demoStore, playerStore])

  return {
    // State
    currentTrack,
    queue,
    isPlaying,
    isInDemoMode,
    volume: playerStore.volume,

    // Actions
    play,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    playNext,
    setIsPlaying,
    stop,
    setVolume: playerStore.setVolume,

    // For direct access when needed
    playerStore,
    demoStore,
  }
}

export default useDemoAwarePlayer

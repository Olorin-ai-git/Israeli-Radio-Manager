import { useState, useRef, useEffect, useCallback } from 'react'
import { Campaign, getSlotPlayCount } from '../../../store/campaignStore'
import { useService } from '../../../services'

export function useSlotPlayback(campaigns: Campaign[]) {
  const service = useService()
  const [playingSlot, setPlayingSlot] = useState<{ slotDate: string; slotIndex: number } | null>(null)
  const [playQueue, setPlayQueue] = useState<string[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlayingSlot(null)
    setPlayQueue([])
  }, [])

  // Handle playing next item in queue
  useEffect(() => {
    if (playQueue.length === 0) {
      if (playingSlot) {
        setPlayingSlot(null)
      }
      return
    }

    const currentContentId = playQueue[0]
    const streamUrl = service.getStreamUrl(currentContentId)

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current

    const handleEnded = () => {
      setPlayQueue(prev => prev.slice(1))
    }

    const handleError = () => {
      console.error('Audio playback error, skipping to next')
      setPlayQueue(prev => prev.slice(1))
    }

    audio.src = streamUrl
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.play().catch(err => {
      console.error('Play error:', err)
      setPlayQueue(prev => prev.slice(1))
    })

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [playQueue, playingSlot])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const handlePlaySlot = useCallback((slotDate: string, slotIndex: number) => {
    // If already playing this slot, stop
    if (playingSlot?.slotDate === slotDate && playingSlot?.slotIndex === slotIndex) {
      stopPlayback()
      return
    }

    // Stop any current playback
    stopPlayback()

    // Gather all content IDs from all campaigns scheduled for this slot
    const contentIds: string[] = []
    const campaignsForSlot: Array<{ campaign: Campaign; playCount: number }> = []

    campaigns.forEach(campaign => {
      if (campaign.status !== 'active') return

      const count = getSlotPlayCount(campaign.schedule_grid, slotDate, slotIndex)
      if (count > 0) {
        campaignsForSlot.push({ campaign, playCount: count })
      }
    })

    // Sort by priority (highest first)
    campaignsForSlot.sort((a, b) => b.campaign.priority - a.campaign.priority)

    // Build the queue
    campaignsForSlot.forEach(({ campaign, playCount }) => {
      for (let i = 0; i < playCount; i++) {
        campaign.content_refs.forEach(ref => {
          if (ref.content_id) {
            contentIds.push(ref.content_id)
          }
        })
      }
    })

    if (contentIds.length === 0) {
      return
    }

    setPlayingSlot({ slotDate, slotIndex })
    setPlayQueue(contentIds)
  }, [campaigns, playingSlot, stopPlayback])

  return {
    playingSlot,
    playQueue,
    handlePlaySlot,
    stopPlayback,
  }
}

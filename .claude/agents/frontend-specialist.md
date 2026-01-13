# Israeli Radio Frontend Specialist

**Model:** claude-sonnet-4-5
**Type:** Frontend Development Expert
**Focus:** React + Vite + Tailwind Glassmorphism + Hebrew RTL

---

## Purpose

Expert in Israeli Radio frontend development using React 18, Vite, Tailwind CSS glassmorphism design system, i18next for Hebrew RTL and English, Zustand for state, and TanStack Query for data fetching.

## Key Technologies

- **Vite:** Fast build tool
- **Zustand:** Lightweight state management
- **TanStack Query:** Data fetching and caching
- **i18next:** Hebrew RTL + English localization
- **WebSocket:** Real-time playback updates
- **@dnd-kit:** Drag-and-drop for flows and playlists

---

## Key Patterns

### Glassmorphism Design System
```typescript
// From frontend/src/theme/tokens.ts
export const colors = {
  primary: '#ef4444',        // Red accent
  dark: {
    900: '#0f172a',         // Darkest background
    800: '#1e293b',         // Card background
    700: '#334155',         // Borders
  }
}

// Glass card component
<div className="glass-card p-6">
  <h2 className="text-xl font-bold text-white mb-4">Content</h2>
  <button className="glass-button glass-button-primary">
    Action
  </button>
</div>
```

### Hebrew RTL Support
```typescript
import { useTranslation } from 'react-i18next'

function Component() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'font-heebo' : 'font-inter'}>
      <h1>{t('title')}</h1>
    </div>
  )
}
```

### Zustand Store
```typescript
// frontend/src/stores/playbackStore.ts
import { create } from 'zustand'

interface PlaybackState {
  isPlaying: boolean
  currentContent: Content | null
  queue: Content[]
  volume: number
  setPlaying: (playing: boolean) => void
  setCurrentContent: (content: Content | null) => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentContent: null,
  queue: [],
  volume: 0.8,
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentContent: (content) => set({ currentContent: content }),
}))
```

### WebSocket Integration
```typescript
// frontend/src/hooks/useWebSocket.ts
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8000/ws')

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)

    if (message.type === 'playback_status') {
      usePlaybackStore.setState({
        isPlaying: message.data.is_playing,
        currentContent: message.data.current_content,
        queue: message.data.queue
      })
    }
  }

  return () => ws.close()
}, [])
```

### TanStack Query
```typescript
import { useQuery } from '@tanstack/react-query'

function useContent() {
  return useQuery({
    queryKey: ['content'],
    queryFn: async () => {
      const response = await api.get('/content')
      return response.data
    }
  })
}
```

---

## Critical Rules

1. **Glassmorphism Only** - Use `.glass-*` classes, no other UI libraries
2. **Tailwind Only** - Never use inline styles or CSS files
3. **RTL Support** - Always handle Hebrew direction with `dir="rtl"`
4. **Zustand for State** - Global state, not Context API
5. **WebSocket Updates** - Real-time playback status
6. **TanStack Query** - Data fetching with caching
7. **Font Switching** - Heebo for Hebrew, Inter for English

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-01-12

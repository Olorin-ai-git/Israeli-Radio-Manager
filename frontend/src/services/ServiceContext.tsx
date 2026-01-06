/**
 * Service Context - Provides the active service (production or demo) to components
 *
 * This is the core of the demo/production mode separation. Components use useService()
 * to get the active service, which automatically routes to the correct implementation.
 *
 * Mode Detection:
 * - Demo mode: hostname contains 'demo' AND user role is 'viewer'
 * - Production mode: all other cases
 *
 * IMPORTANT:
 * - In production mode: Only real API calls, no mock data
 * - In demo mode: Only mock data, no real API calls
 */

import { createContext, useContext, useMemo, ReactNode, useEffect, useState } from 'react'
import { RadioService } from './types'
import { api as productionService } from './api'
import { demoService } from './demo/demoService'
import { useAuth } from '../contexts/AuthContext'

// =============================================================================
// Types
// =============================================================================

type ServiceMode = 'production' | 'demo'

interface ServiceContextValue {
  /** The active service instance - either production API or demo service */
  service: RadioService
  /** Current mode: 'production' or 'demo' */
  mode: ServiceMode
  /** True if running in demo mode */
  isDemoMode: boolean
  /** True if on demo host (regardless of role) */
  isDemoHost: boolean
  /** True if user can perform write operations (admin/editor) */
  canWrite: boolean
}

// =============================================================================
// Context
// =============================================================================

const ServiceContext = createContext<ServiceContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

interface ServiceProviderProps {
  children: ReactNode
}

/**
 * Determines if the current host is a demo host
 */
function checkIsDemoHost(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.includes('demo')
}

export function ServiceProvider({ children }: ServiceProviderProps) {
  const { role, loading: authLoading } = useAuth()
  const [isReady, setIsReady] = useState(false)

  // Wait for auth to be ready before determining mode
  useEffect(() => {
    if (!authLoading) {
      setIsReady(true)
    }
  }, [authLoading])

  const value = useMemo<ServiceContextValue>(() => {
    const isDemoHost = checkIsDemoHost()
    const isViewer = role === 'viewer'

    // Full demo mode requires both: demo host AND viewer role
    // Admins/editors on demo host still use production API
    const isDemoMode = isDemoHost && isViewer

    // Can write: admin or editor (not viewer)
    const canWrite = role === 'admin' || role === 'editor'

    // Select the appropriate service
    const service = isDemoMode ? demoService : productionService

    const mode: ServiceMode = isDemoMode ? 'demo' : 'production'

    // Log mode for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && isReady) {
      console.log(`[ServiceContext] Mode: ${mode}, isDemoHost: ${isDemoHost}, role: ${role}`)
    }

    return {
      service,
      mode,
      isDemoMode,
      isDemoHost,
      canWrite,
    }
  }, [role, isReady])

  // Show nothing while waiting for auth (prevents flash of wrong mode)
  // The AuthProvider should handle its own loading state
  if (!isReady) {
    return null
  }

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Get the active service (production API or demo service)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const service = useService()
 *   const { data: songs } = useQuery({
 *     queryKey: ['songs'],
 *     queryFn: () => service.getSongs(),
 *   })
 * }
 * ```
 */
export function useService(): RadioService {
  const context = useContext(ServiceContext)
  if (!context) {
    throw new Error('useService must be used within ServiceProvider')
  }
  return context.service
}

/**
 * Get the current service mode and related flags
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isDemoMode, canWrite, mode } = useServiceMode()
 *   if (!canWrite) {
 *     return <ReadOnlyBanner />
 *   }
 * }
 * ```
 */
export function useServiceMode() {
  const context = useContext(ServiceContext)
  if (!context) {
    throw new Error('useServiceMode must be used within ServiceProvider')
  }
  return {
    mode: context.mode,
    isDemoMode: context.isDemoMode,
    isDemoHost: context.isDemoHost,
    canWrite: context.canWrite,
  }
}

/**
 * Check if in demo mode (convenience hook)
 */
export function useIsDemoMode(): boolean {
  const { isDemoMode } = useServiceMode()
  return isDemoMode
}

/**
 * Check if user can perform write operations (convenience hook)
 */
export function useCanWrite(): boolean {
  const { canWrite } = useServiceMode()
  return canWrite
}

export default ServiceContext

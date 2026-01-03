import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to detect demo mode and viewer restrictions
 *
 * Restrictions:
 * - Viewers cannot perform write operations on ANY site
 * - Demo banner only shows on demo.radio.olorin.ai for viewers
 * - Admin/Editor users have full access everywhere
 */
export function useDemoMode() {
  const { role } = useAuth();

  // Check if running on demo domain
  const isDemoHost = typeof window !== 'undefined' &&
    window.location.hostname.includes('demo');

  // Check if user is a viewer (regardless of domain)
  const isViewer = role === 'viewer';

  // Show demo banner: on demo domain AND has viewer role
  const showDemoBanner = isDemoHost && isViewer;

  // Can perform write operations: only editors and admins can write (on any site)
  const canWrite = role === 'admin' || role === 'editor';

  return {
    isDemoHost,       // true if on demo.radio.olorin.ai
    isViewer,         // true if user has viewer role
    showDemoBanner,   // true if should show demo banner (viewer on demo site)
    canWrite,         // true only for admin/editor roles
  };
}

export default useDemoMode;

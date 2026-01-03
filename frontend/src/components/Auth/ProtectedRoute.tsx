import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDemoMode } from '../../hooks/useDemoMode';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireEditor?: boolean;
  requireWrite?: boolean; // Block demo viewers from write-only pages
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireEditor = false,
  requireWrite = false
}: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { canWrite, isViewer, isDemoHost } = useDemoMode();

  // Redirect viewers from production to demo site
  useEffect(() => {
    if (!loading && user && isViewer && !isDemoHost) {
      // Viewer on production site - redirect to demo
      const demoUrl = window.location.href.replace(
        window.location.host,
        'demo.radio.olorin.ai'
      );
      window.location.href = demoUrl;
    }
  }, [loading, user, isViewer, isDemoHost]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <Loader2 className="animate-spin text-primary-400" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Viewer on production site - show loading while redirecting
  if (isViewer && !isDemoHost) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={48} />
          <p className="text-dark-300">Redirecting to demo site...</p>
        </div>
      </div>
    );
  }

  // Admin access required - only admin can access
  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Editor access required - admin or editor can access
  if (requireEditor && role !== 'admin' && role !== 'editor') {
    return <Navigate to="/" replace />;
  }

  // Write access required - viewers cannot access (on any site)
  if (requireWrite && !canWrite) {
    return <Navigate to="/library" replace />;
  }

  return <>{children}</>;
}

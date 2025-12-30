import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireEditor?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireEditor = false
}: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

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

  // Admin access required - only admin can access
  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Editor access required - admin or editor can access
  if (requireEditor && role !== 'admin' && role !== 'editor') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

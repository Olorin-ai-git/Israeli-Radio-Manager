import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, handleRedirectResult } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function Login() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check for redirect result (when user returns from Google OAuth)
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        setLoading(true);
        console.log('[Login] Checking for redirect result...');
        const result = await handleRedirectResult();
        console.log('[Login] Redirect result:', result);
        if (result) {
          // User successfully signed in via redirect
          console.log('[Login] Successfully signed in via redirect:', result.email);
          // Don't navigate immediately - let AuthContext handle it
          // The second useEffect will navigate once user state is set
        } else {
          console.log('[Login] No redirect result found');
        }
      } catch (error: any) {
        console.error('[Login] Redirect result error:', error);
        setError(error.message || 'Failed to complete sign in');
      } finally {
        setLoading(false);
      }
    };
    
    checkRedirectResult();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    console.log('[Login] User state changed:', user?.email || 'null');
    if (user) {
      console.log('[Login] User authenticated, navigating to dashboard');
      navigate('/');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      // Don't navigate here - let the user state change trigger navigation
      // For redirect mode (production), user is redirected away to Google
      // For popup mode (localhost), the second useEffect will handle navigation
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };


  return (
    <div className="h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* Content Container */}
      <div className="relative flex items-center justify-center">
        {/* Neon Title - Absolute positioned */}
        <h1 
          className="absolute font-bold text-center neon-text whitespace-nowrap z-10" 
          style={{ fontSize: '2.5rem', top: '100px', left: '50%', transform: 'translateX(-50%)' }}
        >
          The Israeli Radio | הרדיו הישראלי
        </h1>

        {/* Background Image */}
        <img 
          src="/Login2.png" 
          alt="Israeli Radio Manager - Sign in with Google" 
          className="max-w-5xl max-h-[90vh] w-auto h-auto object-contain cursor-pointer"
          onClick={handleGoogleSignIn}
        />
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-dark-100 text-lg font-medium">
              {isRTL ? 'מתחבר...' : 'Signing in...'}
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="glass-card p-4 bg-red-500/20 border-red-500/30 flex items-start gap-3 animate-slide-in">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <p className="text-red-400 font-medium mb-1">
                {isRTL ? 'שגיאת התחברות' : 'Sign In Error'}
              </p>
              <p className="text-red-300 text-sm">{error}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setError(null)
                }}
                className="text-red-400 text-xs underline mt-2 hover:text-red-300"
              >
                {isRTL ? 'סגור' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

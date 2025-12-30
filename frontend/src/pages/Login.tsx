import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Radio, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function Login() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      navigate('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-950 to-dark-900 p-4">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <Radio className="mx-auto mb-4 text-primary-400" size={64} />
        <h1 className="text-3xl font-bold text-dark-100 mb-2">
          {isRTL ? 'מנהל רדיו ישראלי' : 'Israeli Radio Manager'}
        </h1>
        <p className="text-dark-400 mb-8">
          {isRTL ? 'התחבר עם חשבון Google שלך' : 'Sign in with your Google account'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="glass-button-primary w-full flex items-center justify-center gap-3 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <LogIn size={20} />
              <span>{isRTL ? 'התחבר עם Google' : 'Sign in with Google'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

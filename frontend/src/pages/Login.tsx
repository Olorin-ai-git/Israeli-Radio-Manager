import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, handleRedirectResult } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Radio, LogIn, Music, Calendar, Mic2, Zap, Clock, BarChart3, Bot, Library } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export default function Login() {
  const { t, i18n } = useTranslation();
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

  const features = [
    { icon: Music, title: t('login.features.content.title'), desc: t('login.features.content.desc') },
    { icon: Calendar, title: t('login.features.scheduling.title'), desc: t('login.features.scheduling.desc') },
    { icon: Mic2, title: t('login.features.announcements.title'), desc: t('login.features.announcements.desc') },
    { icon: Zap, title: t('login.features.broadcasting.title'), desc: t('login.features.broadcasting.desc') },
    { icon: Clock, title: t('login.features.workflows.title'), desc: t('login.features.workflows.desc') },
    { icon: BarChart3, title: t('login.features.analytics.title'), desc: t('login.features.analytics.desc') },
    { icon: Bot, title: t('login.features.aiAgent.title'), desc: t('login.features.aiAgent.desc'), highlight: true },
    { icon: Library, title: t('login.features.librarian.title'), desc: t('login.features.librarian.desc'), highlight: true }
  ];

  return (
    <div className="min-h-screen flex overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
        {/* Animated circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }}></div>
      </div>

      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-12 xl:px-20">
        <div className="max-w-xl">
          {/* Logo & Title */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <Radio className="text-primary-500 drop-shadow-glow" size={64} />
              <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full"></div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-dark-100 mb-1">
                {t('login.title')}
              </h1>
              <p className="text-primary-400 text-lg font-medium">
                {t('login.tagline')}
              </p>
            </div>
          </div>

          {/* AI Powered Badge */}
          <div className="mb-6 glass-card p-4 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="text-primary-400" size={24} />
              <h3 className="text-primary-400 font-bold text-sm">
                {t('login.aiPowered')}
              </h3>
            </div>
            <p className="text-dark-300 text-xs leading-relaxed">
              {t('login.aiDescription')}
            </p>
          </div>

          {/* Features Grid */}
          <div className="space-y-6 mb-12">
            <h2 className="text-2xl font-semibold text-dark-100 mb-6">
              {t('login.features.title')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className={`glass-card p-4 hover:border-primary-500/30 transition-all duration-300 hover:scale-105 hover:shadow-glow ${
                    feature.highlight ? 'bg-gradient-to-br from-primary-500/5 to-purple-500/5 border-primary-500/20' : ''
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <feature.icon className={feature.highlight ? "text-primary-400 mb-3" : "text-primary-400 mb-3"} size={24} />
                  <h3 className="text-dark-100 font-semibold mb-1 text-sm">
                    {feature.title}
                  </h3>
                  <p className="text-dark-400 text-xs leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary-400 mb-1">24/7</div>
              <div className="text-dark-400 text-sm">{t('login.stats.automated')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-400 mb-1">2x AI</div>
              <div className="text-dark-400 text-sm">{t('login.stats.ai')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-400 mb-1">∞</div>
              <div className="text-dark-400 text-sm">{t('login.stats.unlimited')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Radio className="mx-auto mb-4 text-primary-500 drop-shadow-glow" size={64} />
            <h1 className="text-3xl font-bold text-dark-100 mb-2">
              {t('login.title')}
            </h1>
            <p className="text-primary-400 font-medium">
              {t('login.tagline')}
            </p>
            
            {/* Mobile AI Badge */}
            <div className="mt-4 glass-card p-3 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/30">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Bot className="text-primary-400" size={18} />
                <p className="text-primary-400 font-bold text-xs">
                  {t('login.aiPowered')}
                </p>
              </div>
              <p className="text-dark-300 text-xs leading-relaxed">
                {t('login.aiDescription')}
              </p>
            </div>
          </div>

          {/* Login Card */}
          <div className="glass-card p-8 lg:p-10 hover:border-primary-500/20 transition-all duration-300">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-dark-100 mb-2">
                {t('login.welcome')}
              </h2>
              <p className="text-dark-400">
                {t('login.subtitle')}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3 animate-slide-in">
                <div className="mt-0.5">⚠️</div>
                <div className="flex-1">{error}</div>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="glass-button-primary w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center gap-3">
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>{t('login.signInButton')}</span>
                  </>
                )}
              </div>
            </button>

            <div className="mt-6 text-center">
              <p className="text-dark-400 text-sm">
                {t('login.security')}
              </p>
            </div>
          </div>

          {/* Mobile Features - Show AI Agents prominently */}
          <div className="lg:hidden mt-8 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {features.filter(f => f.highlight).map((feature, index) => (
                <div 
                  key={index} 
                  className="glass-card p-4 text-center bg-gradient-to-br from-primary-500/5 to-purple-500/5 border-primary-500/20"
                >
                  <feature.icon className="text-primary-400 mx-auto mb-2" size={24} />
                  <p className="text-dark-100 text-xs font-semibold mb-1">{feature.title}</p>
                  <p className="text-dark-400 text-[10px] leading-tight">{feature.desc}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {features.filter(f => !f.highlight).slice(0, 4).map((feature, index) => (
                <div key={index} className="glass-card p-3 text-center">
                  <feature.icon className="text-primary-400 mx-auto mb-2" size={20} />
                  <p className="text-dark-100 text-xs font-semibold">{feature.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

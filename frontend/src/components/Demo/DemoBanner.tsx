import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, X, ExternalLink } from 'lucide-react';

interface DemoBannerProps {
  onLearnMore?: () => void;
}

export function DemoBanner({ onLearnMore }: DemoBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const handleLearnMore = () => {
    if (onLearnMore) {
      onLearnMore();
    } else {
      window.open('https://marketing.radio.olorin.ai', '_blank');
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Info size={18} className="flex-shrink-0" />
          <span className="text-sm font-medium">
            {t('demo.banner')} — {t('demo.viewerRestriction')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLearnMore}
            className="flex items-center gap-1 px-3 py-1 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-md transition-colors"
          >
            {t('demo.signUpPrompt')}
            <ExternalLink size={14} />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
            aria-label={t('demo.dismiss')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DemoBanner;

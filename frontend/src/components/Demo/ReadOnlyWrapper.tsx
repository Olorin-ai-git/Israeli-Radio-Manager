import { ReactNode, MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

interface ReadOnlyWrapperProps {
  children: ReactNode;
  isReadOnly: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function ReadOnlyWrapper({
  children,
  isReadOnly,
  showTooltip = true,
  className = '',
}: ReadOnlyWrapperProps) {
  const { t } = useTranslation();
  const [showMessage, setShowMessage] = useState(false);

  if (!isReadOnly) {
    return <>{children}</>;
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showTooltip) {
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 2000);
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onClick={handleClick}
    >
      <div className="opacity-50 cursor-not-allowed pointer-events-none select-none">
        {children}
      </div>

      {showMessage && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-md shadow-lg whitespace-nowrap flex items-center gap-2">
            <Lock size={12} />
            {t('demo.readOnly')}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReadOnlyButton({
  children,
  isReadOnly,
  onClick,
  className = '',
  ...props
}: {
  children: ReactNode;
  isReadOnly: boolean;
  onClick?: () => void;
  className?: string;
  [key: string]: unknown;
}) {
  const { t } = useTranslation();
  const [showMessage, setShowMessage] = useState(false);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (isReadOnly) {
      e.preventDefault();
      e.stopPropagation();
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 2000);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="relative inline-block">
      <button
        {...props}
        onClick={handleClick}
        className={`${className} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={isReadOnly}
      >
        {children}
      </button>

      {showMessage && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-md shadow-lg whitespace-nowrap flex items-center gap-2">
            <Lock size={12} />
            {t('demo.readOnly')}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReadOnlyWrapper;

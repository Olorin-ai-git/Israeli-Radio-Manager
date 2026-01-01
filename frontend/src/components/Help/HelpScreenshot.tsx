import { useState } from 'react'
import { X, ZoomIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface HelpScreenshotProps {
  src: string
  alt: string
  caption?: string
  captionHe?: string
}

export default function HelpScreenshot({
  src,
  alt,
  caption,
  captionHe
}: HelpScreenshotProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  const displayCaption = isRTL ? (captionHe || caption) : caption

  if (imageError) {
    return (
      <div className="my-4 p-8 rounded-xl bg-dark-800/50 border border-white/10 text-center">
        <p className="text-dark-400 text-sm">
          {isRTL ? 'תמונה לא זמינה' : 'Image not available'}
        </p>
        {displayCaption && (
          <p className="text-dark-500 text-xs mt-2">{displayCaption}</p>
        )}
      </div>
    )
  }

  return (
    <>
      <figure className="my-4">
        <div
          className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-dark-800/30"
          onClick={() => setIsLightboxOpen(true)}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity p-3 rounded-full bg-white/20 backdrop-blur-sm">
              <ZoomIn size={24} className="text-white" />
            </div>
          </div>
        </div>
        {displayCaption && (
          <figcaption className="text-center text-sm text-dark-400 mt-2">
            {displayCaption}
          </figcaption>
        )}
      </figure>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setIsLightboxOpen(false)}
          >
            <X size={24} className="text-white" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {displayCaption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-4 py-2 rounded-lg">
              {displayCaption}
            </p>
          )}
        </div>
      )}
    </>
  )
}

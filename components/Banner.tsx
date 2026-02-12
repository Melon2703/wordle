'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Banner } from '@/lib/types';
import { trackEvent } from '@/lib/analytics';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

interface BannerProps {
  banner: Banner;
  onDismiss: (bannerId: string) => void;
}

const variantStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  promo: 'bg-purple-50 border-purple-200 text-purple-800',
};

const ctaStyles = {
  success: 'text-green-600 hover:text-green-700',
  info: 'text-blue-600 hover:text-blue-700',
  warning: 'text-amber-600 hover:text-amber-700',
  promo: 'text-purple-600 hover:text-purple-700',
};

export function Banner({ banner, onDismiss }: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasLoggedImpressionRef = useRef(false);


  const handleDismiss = () => {
    trackEvent('home_banner_dismissed', {
      mode: 'home',
      banner_id: banner.id
    });
    if (!prefersReducedMotion) {
      setIsVisible(false);
      // Small delay to allow animation to complete
      setTimeout(() => onDismiss(banner.id), 150);
    } else {
      onDismiss(banner.id);
    }
  };

  const handleCtaClick = () => {
    const ctaType = banner.ctaLink?.startsWith('/') ? 'internal' : 'external';
    trackEvent('home_banner_cta_clicked', {
      mode: 'home',
      banner_id: banner.id,
      cta_id: banner.ctaText ?? 'cta',
      cta_type: ctaType
    });
    if (banner.ctaLink) {
      if (banner.ctaLink.startsWith('/')) {
        // Internal link
        window.location.href = banner.ctaLink;
      } else {
        // External link
        window.open(banner.ctaLink, '_blank', 'noopener,noreferrer');
      }
    }
  };

  useEffect(() => {
    if (!hasLoggedImpressionRef.current && isVisible) {
      trackEvent('home_banner_shown', {
        mode: 'home',
        banner_id: banner.id,
        variant: banner.variant
      });
      hasLoggedImpressionRef.current = true;
    }
  }, [isVisible, banner.id, banner.variant]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`relative rounded-lg border px-4 py-3 text-sm transition-all duration-150 ${prefersReducedMotion ? '' : 'animate-in slide-in-from-top-2'
        } ${variantStyles[banner.variant]}`}
      role="banner"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="leading-relaxed break-words">
            {banner.message}
          </p>
        </div>

        {/* CTA Button */}
        {banner.ctaText && banner.ctaLink && (
          <button
            onClick={handleCtaClick}
            className={`flex-shrink-0 text-sm font-medium underline-offset-2 hover:underline transition-colors ${ctaStyles[banner.variant]
              }`}
            aria-label={`${banner.ctaText} - ${banner.message}`}
          >
            {banner.ctaText}
          </button>
        )}

        {/* Dismiss Button */}
        {banner.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
            aria-label="Закрыть уведомление"
            style={{ minWidth: '44px', minHeight: '44px' }} // WCAG touch target
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

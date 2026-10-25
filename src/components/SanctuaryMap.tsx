import React, { useMemo } from 'react';
import { CafeSettings } from '../types/cafe';
import { resolveGoogleMapsEmbedUrl, getGoogleMapsDirectionsUrl } from '../lib/mapUtils';
import { MapPin, Navigation, Compass } from 'lucide-react';

interface SanctuaryMapProps {
  settings: CafeSettings;
  className?: string;
}

export const SanctuaryMap: React.FC<SanctuaryMapProps> = ({ settings, className = '' }) => {
  const embedUrl = useMemo(
    () => resolveGoogleMapsEmbedUrl(settings.googleMapsEmbedUrl || settings.address || settings.coordinates),
    [settings.googleMapsEmbedUrl, settings.address, settings.coordinates]
  );

  const directionsUrl = useMemo(
    () => getGoogleMapsDirectionsUrl(settings.googleMapsEmbedUrl || settings.address || settings.coordinates),
    [settings.googleMapsEmbedUrl, settings.address, settings.coordinates]
  );

  const title = settings.mapTitle?.trim() || 'Our Sanctuary Location';
  const subtitle =
    settings.mapSubtitle?.trim() ||
    (settings.address
      ? `${settings.address} · Sigiriya`
      : 'Lion Rock Sanctuary Road, Kimbissa, Sigiriya · 1.5 km west of Sigiriya Lion Rock Fortress');

  return (
    <section
      id="sanctuary-map"
      className={`scroll-mt-24 max-w-7xl mx-auto px-6 lg:px-12 py-16 sm:py-24 border-b border-[#E7DED3] space-y-8 ${className}`}
      aria-label="Sanctuary Map Location"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#C65B2B]" />
            <span>Sigiriya Cultural Triangle · Geographical Position</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-editorial font-normal text-[#171513]">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-[#171513]/70 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Minimal external directions link */}
        <div className="shrink-0">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 border border-[#171513] text-xs uppercase tracking-widest font-medium hover:bg-[#171513] hover:text-[#F8F4EE] transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Open in Google Maps ↗</span>
          </a>
        </div>
      </div>

      {/* Pristine, clean map window - strictly no controls or internal clutter */}
      <div className="relative w-full bg-[#EFE9DF] border border-[#E7DED3] overflow-hidden shadow-xs">
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-[400px] sm:h-[480px] lg:h-[540px] border-0 block"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen={false}
        />
      </div>

      {/* Minimal subtle location strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs text-[#171513]/75 font-mono-tabular">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#C65B2B] shrink-0" />
          <span className="truncate">{settings.address || 'Lion Rock Sanctuary Road, Kimbissa, Sigiriya'}</span>
        </div>
        <div className="flex items-center sm:justify-center gap-2">
          <span className="text-[#171513]/40">GPS:</span>
          <span>{settings.coordinates || '07°57\'25"N · 80°45\'37"E'}</span>
        </div>
        <div className="flex items-center sm:justify-end gap-2 text-[#58644E]">
          <span className="w-2 h-2 rounded-full bg-[#58644E] inline-block animate-pulse" />
          <span>Open Daily · Sunrise to Candlelight</span>
        </div>
      </div>
    </section>
  );
};

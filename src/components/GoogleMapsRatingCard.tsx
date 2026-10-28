import React, { useState } from 'react';
import { ExternalLink, Check, MapPin, Navigation } from 'lucide-react';
import {
  OFFICIAL_ONELOVE_MAPS_PLACE_URL,
  OFFICIAL_ONELOVE_MAPS_DIRECTIONS_URL,
} from '../lib/mapUtils';

export const GoogleMapsRatingCard: React.FC = () => {
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [hoveredStars, setHoveredStars] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  const activeStars = hoveredStars ?? selectedStars;

  const handleOpenGoogleMapsReview = () => {
    const trimmed = reviewDraft.trim();
    if (trimmed && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(trimmed).catch(() => {});
      setCopiedNotice(true);
      window.setTimeout(() => setCopiedNotice(false), 4500);
    }
  };

  return (
    <div
      data-gsap-voice
      className="relative bg-white border border-[#E7DED3] shadow-[0_14px_38px_rgba(23,21,19,0.06)] overflow-hidden"
    >
      {/* Top Google Maps Signature 4-Color Accent Bar */}
      <div className="h-1 w-full grid grid-cols-4">
        <div className="bg-[#4285F4]" />
        <div className="bg-[#EA4335]" />
        <div className="bg-[#FBBC05]" />
        <div className="bg-[#34A853]" />
      </div>

      <div className="p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left Column: Authentic Google Maps Place Identity */}
        <div className="lg:col-span-5 space-y-5 border-b lg:border-b-0 lg:border-r border-[#E7DED3] pb-6 lg:pb-0 lg:pr-8">
          <div className="flex items-center gap-3">
            {/* Official Google "G" + Maps Pin Emblem */}
            <div className="w-11 h-11 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] flex items-center justify-center shrink-0 shadow-2xs">
              <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#5F6368] font-semibold">
                <span>Google Maps</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-editorial font-semibold text-[#171513] leading-tight mt-0.5">
                One Love cafe sigiriya
              </h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#171513]/75 leading-relaxed font-light">
            Dined beneath the palms or enjoyed a morning highland pour-over after climbing Lion Rock?
            Your 5-star rating on Google Maps helps fellow travelers discover our Sigiriya sanctuary.
          </p>

          {/* Google Maps Place Summary Strip */}
          <div className="pt-2 space-y-2 text-xs text-[#5F6368]">
            <div className="flex items-center gap-2 text-[#171513] font-medium">
              <MapPin className="w-4 h-4 text-[#EA4335] shrink-0" />
              <span>Lion Rock Sanctuary Road, Kimbissa, Sigiriya 21120</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 pl-6 text-[11px] font-mono-tabular text-[#5F6368]">
              <a
                href={OFFICIAL_ONELOVE_MAPS_DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#1A73E8] hover:underline font-sans font-medium"
              >
                <Navigation className="w-3 h-3" /> Get Directions
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 5-Star Rating & Review Experience */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-widest text-[#171513] font-semibold">
                Tap a Star to Rate Your Experience on Google Maps
              </span>
              <span className="text-xs font-mono-tabular font-semibold text-[#D9622B]">
                {activeStars}.0 / 5.0 ★
              </span>
            </div>

            {/* Interactive 5-Star Bar in Authentic Google Maps Amber (#FBBC04) */}
            <div
              className="flex items-center gap-2 sm:gap-3 pt-1"
              onMouseLeave={() => setHoveredStars(null)}
              role="radiogroup"
              aria-label="Rate One Love cafe sigiriya out of 5 stars"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= activeStars;
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={selectedStars === star}
                    aria-label={`Rate ${star} out of 5 stars`}
                    onMouseEnter={() => setHoveredStars(star)}
                    onClick={() => setSelectedStars(star)}
                    className="group/star p-2 sm:p-2.5 rounded-xl bg-[#F8F9FA] hover:bg-[#FEF7E0] border border-[#E8EAED] hover:border-[#FBBC04] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-7 h-7 sm:w-9 sm:h-9 transition-transform duration-200 group-hover/star:scale-110 ${
                        isFilled ? 'text-[#FBBC04] drop-shadow-[0_2px_6px_rgba(251,188,4,0.35)]' : 'text-[#DADCE0]'
                      }`}
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Quick Review Note & Direct Google Maps Review CTA */}
          <div className="space-y-3 pt-1">
            <input
              type="text"
              value={reviewDraft}
              onChange={(e) => setReviewDraft(e.target.value)}
              placeholder="Write a quick note about your favorite dish, coffee, or table (copied when you open Google Maps)..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#F8F9FA] text-[#171513] border border-[#DADCE0] rounded-lg focus:outline-none focus:border-[#1A73E8] focus:bg-white transition-colors"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <a
                href={OFFICIAL_ONELOVE_MAPS_PLACE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenGoogleMapsReview}
                className="w-full sm:w-auto justify-center min-h-[44px] px-6 py-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2.5 shadow-xs transition-colors cursor-pointer"
              >
                <span>Rate {selectedStars} Stars on Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {copiedNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#1E8E3E] font-medium">
                  <Check className="w-4 h-4" /> Review note copied to clipboard — paste directly in Google Maps!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useCafe } from '../context/CafeContext';
import { EditorialVisual } from './EditorialVisual';

gsap.registerPlugin(ScrollTrigger);

interface LateriteStorySectionProps {
  onReadMonograph?: () => void;
  showMonographButton?: boolean;
}

export const LateriteStorySection: React.FC<LateriteStorySectionProps> = ({
  onReadMonograph,
  showMonographButton = true,
}) => {
  const { siteContent } = useCafe();
  const sectionRef = useRef<HTMLElement | null>(null);

  const storyContent = siteContent.find((s) => s.sectionKey === 'story');

  const getSlotImage = (slotIndex: number, fallbackSrc: string): string => {
    const key = `story_collage_${slotIndex}`;
    const found = siteContent.find((s) => s.sectionKey === key);
    if (found && found.imageUrl && found.imageUrl.trim().length > 0) {
      return found.imageUrl;
    }
    if (
      slotIndex === 1 &&
      storyContent?.imageUrl &&
      !storyContent.imageUrl.startsWith('editorial:')
    ) {
      return storyContent.imageUrl;
    }
    return fallbackSrc;
  };

  useLayoutEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-story-reveal]',
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: sectionEl,
            start: 'top 82%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionEl);

    return () => ctx.revert();
  }, []);

  const primaryStoryImage = getSlotImage(
    1,
    'https://cdn.onelovecafesigiriya.com/content/1793182321672-wp2352856-coffee-shop-wallpapers.webp'
  );
  const secondaryStoryImage = getSlotImage(
    2,
    'https://cdn.onelovecafesigiriya.com/collage/1793182271989-wp2352856-coffee-shop-wallpapers.webp'
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#F7F3ED] border-b border-[#E7DED3] py-16 sm:py-24 lg:py-28"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* LEFT STORY COLUMN */}
          <div className="lg:col-span-6 space-y-6">
            <div data-story-reveal>
              <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-white border border-[#14110E]/10 text-[10px] font-mono-tabular uppercase tracking-[0.22em] text-[#C65B2B] font-medium">
                {storyContent?.kicker || 'Our Story'}
              </span>
            </div>

            <h2
              data-story-reveal
              style={{ textWrap: 'balance' }}
              className="font-outfit text-4xl sm:text-5xl lg:text-[52px] font-normal leading-[1.08] tracking-[-0.02em] text-[#14110E]"
            >
              {storyContent?.heading ||
                'Crafted from Laterite Earth, Teak & Monsoon Light.'}
            </h2>

            <div
              data-story-reveal
              className="space-y-4 text-sm sm:text-[15px] text-[#14110E]/75 leading-[1.75] font-light max-w-xl"
            >
              <p>
                {storyContent?.body ||
                  'OneLove Café began with a simple dream along the forested road beneath Sigiriya Lion Rock—building an open-air refuge around existing Banyan and Frangipani trees using porous red laterite stone, reclaimed teak, and hand-troweled lime plaster.'}
              </p>
              <p>
                {storyContent?.subheading ||
                  'Whether you arrive straight after a sunrise climb for single-estate highland coffee or gather beneath candlelit palms for wood-fired coastal plates, every visit is made for unhurried moments.'}
              </p>
            </div>

            {/* Editorial Pull-Quote */}
            <blockquote
              data-story-reveal
              className="border-l-2 border-[#C65B2B] pl-5 py-1 font-editorial italic text-lg sm:text-xl text-[#14110E]/85 leading-relaxed max-w-lg"
            >
              “Sigiriya is at its best when you don&apos;t rush. We created a sanctuary to slow
              down, sip, and stay awhile.”
            </blockquote>

            {/* Two Clean Feature Cards */}
            <div
              data-story-reveal
              className="pt-4 border-t border-[#14110E]/10 grid grid-cols-2 gap-3.5 max-w-md"
            >
              <div className="bg-white rounded-2xl border border-[#14110E]/8 p-4 sm:p-5 shadow-[0_2px_12px_rgba(18,14,11,0.03)] space-y-1.5">
                <div className="font-outfit text-lg sm:text-xl font-normal text-[#14110E] leading-snug">
                  100% Fresh Daily
                </div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-[0.16em] text-[#14110E]/50">
                  Local Harvest
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#14110E]/8 p-4 sm:p-5 shadow-[0_2px_12px_rgba(18,14,11,0.03)] space-y-1.5">
                <div className="font-outfit text-lg sm:text-xl font-normal text-[#14110E] leading-snug">
                  Direct Sourced
                </div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-[0.16em] text-[#14110E]/50">
                  Ceylon Roastery
                </div>
              </div>
            </div>

            {showMonographButton && (
              <div data-story-reveal className="pt-2">
                <a
                  href="/story"
                  onClick={(e) => {
                    if (onReadMonograph) {
                      e.preventDefault();
                      onReadMonograph();
                    }
                  }}
                  className="inline-flex items-center justify-center min-h-[44px] px-7 py-3 rounded-full bg-[#C65B2B] hover:bg-[#B04E22] text-white text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors cursor-pointer"
                >
                  {storyContent?.ctaLabel || 'Read Our Story'}
                </a>
              </div>
            )}
          </div>

          {/* RIGHT PHOTOGRAPHY COLUMN (Clean Large Rounded Frame + Subtle Overlapping Inset) */}
          <div data-story-reveal className="lg:col-span-6 relative pb-8 sm:pb-10 lg:pl-6">
            <div className="relative rounded-[28px] overflow-hidden aspect-[4/5] w-full max-w-[520px] ml-auto bg-[#EAE2D6] shadow-[0_20px_50px_rgba(18,14,11,0.12)]">
              <EditorialVisual
                src={primaryStoryImage}
                alt="OneLove Café Sigiriya open-air pavilion and teak dining sanctuary"
                priority={true}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="absolute bottom-0 left-2 sm:left-0 lg:left-0 w-36 sm:w-48 aspect-square rounded-2xl overflow-hidden border-[5px] border-white bg-[#EAE2D6] shadow-[0_14px_34px_rgba(18,14,11,0.16)]">
              <EditorialVisual
                src={secondaryStoryImage}
                alt="OneLove Café Sigiriya interior and natural light"
                priority={true}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

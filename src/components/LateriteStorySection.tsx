import React, { useLayoutEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
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
  const collageRef = useRef<HTMLDivElement | null>(null);

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
      // 1. Left Editorial Column Staggered Reveal
      gsap.fromTo(
        '[data-story-reveal]',
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.95,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionEl,
            start: 'top 78%',
            toggleActions: 'play none none none',
          },
        }
      );

      // 2. Scrapbook Paper Layers & Botanical Sprigs Entrance
      gsap.fromTo(
        '[data-collage-paper]',
        { scale: 0.82, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1.1,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionEl,
            start: 'top 75%',
          },
        }
      );

      // 3. 5 Archival Polaroid Frames — Fan-Out Deal Animation
      const frames = gsap.utils.toArray<HTMLElement>('[data-collage-frame]');
      const restingRotations = [-6, 4, -0.5, -7, 7];
      frames.forEach((frame, idx) => {
        const startX = idx === 0 ? -36 : idx === 1 ? 40 : idx === 2 ? 0 : idx === 3 ? -44 : 44;
        const startY = idx === 2 ? 28 : idx < 2 ? -24 : 36;
        const endRot = restingRotations[idx] ?? 0;
        const startRot = endRot + (idx % 2 === 0 ? -10 : 10);

        frame.style.transition = 'none';
        gsap.fromTo(
          frame,
          {
            x: startX,
            y: startY,
            rotation: startRot,
            scale: 0.88,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            rotation: endRot,
            scale: 1,
            opacity: 1,
            duration: 0.95,
            delay: 0.06 + idx * 0.09,
            ease: 'power3.out',
            onComplete: () => {
              gsap.set(frame, { clearProps: 'transform,opacity' });
              frame.style.transition = '';
            },
            scrollTrigger: {
              trigger: sectionEl,
              start: 'top 78%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // 4. Continuous Gentle Botanical Sway
      gsap.to('[data-collage-botanical="top-left"]', {
        rotation: -4,
        y: -4,
        duration: 3.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      gsap.to('[data-collage-botanical="bottom-right"]', {
        rotation: 3.5,
        y: 4,
        duration: 4.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }, sectionEl);

    return () => ctx.revert();
  }, []);

  const handleCollageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = collageRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;

    gsap.to(container, {
      rotateY: relX * 7,
      rotateX: -relY * 7,
      duration: 0.5,
      ease: 'power2.out',
      transformPerspective: 1100,
    });
  };

  const handleCollageMouseLeave = () => {
    const container = collageRef.current;
    if (!container) return;
    gsap.to(container, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.7,
      ease: 'power3.out',
    });
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#FCF9F4] border-b border-[#DFD5C6] py-16 sm:py-24 lg:py-28"
    >
      {/* Sunlit Ambient Paper Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,252,245,0.95),transparent_55%),radial-gradient(circle_at_72%_48%,rgba(217,98,43,0.09),transparent_62%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-10 items-center">
          {/* LEFT EDITORIAL COLUMN */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6 z-10">
            <div
              data-story-reveal
              className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.22em] text-[#C65B2B] font-semibold"
            >
              <span className="w-6 h-[1px] bg-[#C65B2B]" />
              <span>{storyContent?.kicker || 'Architectural Sanctuary · Sigiriya'}</span>
            </div>

            <h2
              data-story-reveal
              style={{ textWrap: 'balance' }}
              className="text-3xl sm:text-5xl lg:text-[52px] font-editorial font-medium leading-[1.1] tracking-tight text-[#110F0D]"
            >
              {storyContent?.heading ||
                'Crafted from Laterite Earth, Teak & Monsoon Light.'}
            </h2>

            <p
              data-story-reveal
              className="text-sm sm:text-[15px] text-[#110F0D]/80 leading-[1.8] font-normal max-w-xl"
            >
              {storyContent?.body ||
                'OneLove Café began as a quiet refuge along the forested road between Kimbissa and the ancient fortress of Sigiriya in Central Province, Sri Lanka. We built around the existing Banyan, Frangipani, and Mara trees—using porous red laterite stone, reclaimed railway teak, and hand-troweled lime plaster so the pavilion breathes naturally with the rhythm of the jungle.'}
            </p>

            {/* Architectural Material & Provenance Ledger */}
            <div
              data-story-reveal
              className="grid grid-cols-3 gap-3 pt-2 pb-1 border-y border-[#E5DDD0] text-left"
            >
              <div className="py-2">
                <div className="text-[10px] uppercase tracking-widest text-[#58644E] font-mono-tabular">
                  Elevation
                </div>
                <div className="text-sm sm:text-base font-editorial font-semibold text-[#110F0D]">
                  1,140 m Roast
                </div>
              </div>
              <div className="py-2 border-x border-[#E5DDD0] px-3">
                <div className="text-[10px] uppercase tracking-widest text-[#58644E] font-mono-tabular">
                  Materiality
                </div>
                <div className="text-sm sm:text-base font-editorial font-semibold text-[#110F0D]">
                  Laterite &amp; Teak
                </div>
              </div>
              <div className="py-2 pl-1">
                <div className="text-[10px] uppercase tracking-widest text-[#58644E] font-mono-tabular">
                  Canopy
                </div>
                <div className="text-sm sm:text-base font-editorial font-semibold text-[#110F0D]">
                  6 Min to Rock
                </div>
              </div>
            </div>

            {showMonographButton && (
              <div data-story-reveal className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="/story"
                  onClick={(e) => {
                    if (onReadMonograph) {
                      e.preventDefault();
                      onReadMonograph();
                    }
                  }}
                  className="group/btn w-full sm:w-auto justify-center min-h-[46px] px-7 py-3.5 rounded-full bg-[#110F0D] text-[#FCF9F4] text-[11px] font-semibold uppercase tracking-[0.16em] inline-flex items-center gap-3 hover:bg-[#D9622B] transition-all duration-300 shadow-[0_10px_24px_rgba(17,15,13,0.18)] cursor-pointer"
                >
                  <span>Read Sigiriya Monograph</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </a>
              </div>
            )}
          </div>

          {/* RIGHT ARCHIVAL SCRAPBOOK COLLAGE COLUMN (GSAP 3D Tilt + Scroll Fan-Out) */}
          <div className="lg:col-span-7">
            <div
              ref={collageRef}
              onMouseMove={handleCollageMouseMove}
              onMouseLeave={handleCollageMouseLeave}
              style={{ transformStyle: 'preserve-3d' }}
              className="group/collage relative w-full max-w-[740px] mx-auto aspect-[4/3] sm:aspect-[16/11] select-none contrast-[1.08] saturate-[1.12]"
            >
              {/* Background Watercolor & Torn Parchment Scrapbook Layers */}
              <div
                data-collage-paper
                aria-hidden="true"
                className="pointer-events-none absolute left-[28%] top-[10%] w-[32%] h-[28%] rounded-full bg-[#7A8767]/15 blur-xl transition-transform duration-700 group-hover/collage:scale-110"
              />
              <div
                data-collage-paper
                aria-hidden="true"
                className="pointer-events-none absolute left-[18%] bottom-[6%] w-[28%] h-[22%] rounded-full bg-[#8B9474]/18 blur-xl transition-transform duration-700 group-hover/collage:scale-110"
              />
              {/* Torn Kraft Paper Layer Under Bottom-Right of Main Print */}
              <div
                data-collage-paper
                aria-hidden="true"
                className="pointer-events-none absolute right-[12%] bottom-[5%] w-[38%] h-[24%] bg-[#C8A97E] border border-[#B59469] shadow-md rotate-[8deg] transition-transform duration-700 ease-out group-hover/collage:rotate-[11deg] group-hover/collage:translate-x-1.5 group-hover/collage:translate-y-1"
                style={{
                  clipPath:
                    'polygon(2% 8%, 96% 0%, 100% 88%, 92% 100%, 4% 94%, 0% 24%)',
                }}
              />
              {/* Torn Vintage Cream Paper Strip Behind Left Print */}
              <div
                data-collage-paper
                aria-hidden="true"
                className="pointer-events-none absolute left-[4%] top-[24%] w-[18%] h-[38%] bg-[#EFE7D6] shadow-sm -rotate-[12deg] transition-transform duration-700 ease-out group-hover/collage:-rotate-[15deg] group-hover/collage:-translate-x-1.5"
                style={{
                  clipPath:
                    'polygon(6% 0%, 95% 4%, 100% 96%, 12% 100%, 0% 68%)',
                }}
              />

              {/* TOP-LEFT BOTANICAL MARA / BANYAN LEAVES */}
              <svg
                data-collage-botanical="top-left"
                viewBox="0 0 220 260"
                aria-hidden="true"
                className="pointer-events-none absolute -left-[2%] top-[2%] w-[26%] sm:w-[24%] z-0 drop-shadow-md origin-bottom-right"
              >
                {/* Stem */}
                <path
                  d="M165,240 Q135,165 110,45"
                  stroke="#3A4B28"
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Top Leaf */}
                <path
                  d="M110,45 Q90,15 112,2 Q134,18 118,52 Z"
                  fill="#3F5729"
                />
                {/* Upper Left Leaf */}
                <path
                  d="M118,88 Q62,55 42,74 Q68,112 122,98 Z"
                  fill="#4A6432"
                />
                <path d="M118,92 L52,75" stroke="#6E8B52" strokeWidth="1.2" />
                {/* Middle Left Leaf */}
                <path
                  d="M128,136 Q55,108 24,132 Q62,168 134,148 Z"
                  fill="#3B5326"
                />
                <path d="M130,141 L36,133" stroke="#67834C" strokeWidth="1.3" />
                {/* Lower Left Leaf */}
                <path
                  d="M142,188 Q68,172 38,204 Q82,232 148,198 Z"
                  fill="#4E6835"
                />
                <path d="M144,193 L48,202" stroke="#78945B" strokeWidth="1.2" />
              </svg>

              {/* PHOTO 2: TOP-LEFT VERTICAL PRINT (Monsoon Sunbeams Through Canopy) */}
              <div
                data-collage-frame
                className="group/frame absolute left-[5%] top-[6%] w-[34%] aspect-[3/4] z-10 bg-[#FAF6EE] p-2 sm:p-3 shadow-[0_16px_36px_rgba(23,21,19,0.18)] border border-[#E2D9C8] -rotate-[6deg] transition-all duration-500 ease-out group-hover/collage:-translate-x-2 group-hover/collage:-translate-y-1.5 group-hover/collage:-rotate-[8deg] hover:!z-40 hover:!scale-105 hover:!rotate-[-1deg] hover:!-translate-y-2.5 hover:shadow-[0_26px_55px_rgba(23,21,19,0.28)]"
              >
                <div className="relative w-full h-full overflow-hidden bg-[#EAE2D6]">
                  <EditorialVisual
                    src={getSlotImage(2, 'https://cdn.onelovecafesigiriya.com/collage/1793182271989-wp2352856-coffee-shop-wallpapers.webp')}
                    alt="Monsoon Sunbeams Through Canopy"
                    priority={true}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-108"
                  />
                </div>
              </div>

              {/* PHOTO 3: TOP-RIGHT ARCHIVAL MONOCHROME PRINT (Archival Sigiriya Lithograph) */}
              <div
                data-collage-frame
                className="group/frame absolute right-[4%] top-[2%] w-[46%] aspect-[16/10] z-10 bg-[#F3EFE4] p-2.5 sm:p-3.5 shadow-[0_14px_32px_rgba(23,21,19,0.14)] border border-[#DFD6C3] rotate-[4deg] transition-all duration-500 ease-out group-hover/collage:translate-x-2 group-hover/collage:-translate-y-1.5 group-hover/collage:rotate-[6deg] hover:!z-40 hover:!scale-105 hover:!rotate-[1deg] hover:!-translate-y-2 hover:shadow-[0_26px_55px_rgba(23,21,19,0.25)]"
              >
                <div className="relative w-full h-full overflow-hidden bg-[#EAE2D6]">
                  <EditorialVisual
                    src={getSlotImage(3, 'https://cdn.onelovecafesigiriya.com/collage/1793182275393-wp11934956-cozy-cafe-4k-wallpapers.webp')}
                    alt="Archival Sigiriya Rock Fortress Lithograph"
                    priority={true}
                    className="w-full h-full object-cover grayscale contrast-110 transition-all duration-700 group-hover/frame:grayscale-0 group-hover/frame:scale-105"
                  />
                </div>
              </div>

              {/* PHOTO 1: CENTER-MAIN HERO LANDSCAPE PRINT (Wild Elephants & Sigiriya Horizon) */}
              <div
                data-collage-frame
                className="group/frame absolute left-[18%] top-[21%] w-[63%] aspect-[4/3] z-20 bg-[#FAF6EE] p-2.5 sm:p-4 shadow-[0_22px_50px_rgba(23,21,19,0.22)] border border-[#E2D9C8] -rotate-[0.5deg] transition-all duration-500 ease-out group-hover/collage:-translate-y-1 hover:!z-40 hover:!scale-[1.035] hover:!rotate-0 hover:!-translate-y-2 hover:shadow-[0_30px_65px_rgba(23,21,19,0.3)]"
              >
                <div className="relative w-full h-full overflow-hidden bg-[#EAE2D6]">
                  <EditorialVisual
                    src={getSlotImage(1, 'https://cdn.onelovecafesigiriya.com/collage/1793182269079-wp11877848-cozy-rain-wallpapers.webp')}
                    alt="Wild Sri Lankan Elephants with Sigiriya Lion Rock in Background"
                    priority={true}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-105"
                  />
                </div>
              </div>

              {/* PHOTO 4: BOTTOM-LEFT PINNED VERTICAL PRINT (Reclaimed Railway Teak Pavilion) */}
              <div
                data-collage-frame
                className="group/frame absolute left-[3%] bottom-[3%] w-[26%] aspect-[3/4] z-30 bg-[#FAF6EE] p-2 sm:p-2.5 shadow-[0_18px_38px_rgba(23,21,19,0.24)] border border-[#E2D9C8] -rotate-[7deg] transition-all duration-500 ease-out group-hover/collage:-translate-x-2.5 group-hover/collage:translate-y-2 group-hover/collage:-rotate-[9deg] hover:!z-40 hover:!scale-110 hover:!rotate-[-1.5deg] hover:!-translate-y-1 hover:shadow-[0_28px_58px_rgba(23,21,19,0.32)]"
              >
                {/* Brass / Wood Thumbtack Pin at Top Center */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 z-30 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#D6BA8A] via-[#B4935F] to-[#7D6238] border border-[#6B522D] shadow-[0_3px_6px_rgba(0,0,0,0.35)] flex items-center justify-center"
                >
                  <div className="w-2 h-2 rounded-full bg-[#EAD6B3]/60" />
                </div>

                <div className="relative w-full h-full overflow-hidden bg-[#EAE2D6]">
                  <EditorialVisual
                    src={getSlotImage(4, 'https://cdn.onelovecafesigiriya.com/collage/1793182279743-42957eec-2f66-492e-b754-eaeb2e0420af--1-.webp')}
                    alt="Reclaimed Railway Teak Pavilion"
                    priority={true}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-108"
                  />
                </div>
              </div>

              {/* PHOTO 5: RIGHT TAPED VERTICAL PRINT (Porous Red Laterite Earth Stone) */}
              <div
                data-collage-frame
                className="group/frame absolute right-[1%] top-[30%] w-[23%] aspect-[3/4] z-30 bg-[#FAF6EE] p-2 sm:p-2.5 shadow-[0_18px_38px_rgba(23,21,19,0.22)] border border-[#E2D9C8] rotate-[7deg] transition-all duration-500 ease-out group-hover/collage:translate-x-2.5 group-hover/collage:translate-y-1 group-hover/collage:rotate-[9deg] hover:!z-40 hover:!scale-110 hover:!rotate-[1.5deg] hover:!-translate-y-1.5 hover:shadow-[0_28px_58px_rgba(23,21,19,0.32)]"
              >
                {/* Translucent Archival Masking Tape at Top Center */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 z-30 w-12 sm:w-14 h-5 sm:h-6 bg-[#EFE6D2]/85 border border-[#DDD1B8] shadow-xs -rotate-[4deg] backdrop-blur-[1px]"
                />

                <div className="relative w-full h-full overflow-hidden bg-[#EAE2D6]">
                  <EditorialVisual
                    src={getSlotImage(5, 'https://cdn.onelovecafesigiriya.com/collage/1793182284924-cozy-coffee-shop-interior--1-.webp')}
                    alt="Porous Red Laterite Earth Stone"
                    priority={true}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-108"
                  />
                </div>
              </div>

              {/* BOTTOM-RIGHT FRANGIPANI (PLUMERIA) BLOSSOMS & BOTANICAL LINE ART */}
              <svg
                data-collage-botanical="bottom-right"
                viewBox="0 0 280 260"
                aria-hidden="true"
                className="pointer-events-none absolute right-[1%] -bottom-[2%] w-[34%] sm:w-[32%] z-35 drop-shadow-[0_12px_20px_rgba(23,21,19,0.22)] origin-center"
              >
                {/* Delicate Line-Art Botanical Sketch Behind Leaves */}
                <g stroke="#9B8D78" strokeWidth="1" fill="none" opacity="0.55">
                  <path d="M185,140 Q230,105 272,88" />
                  <path d="M215,118 Q232,96 254,96 Q240,118 215,118 Z" />
                  <path d="M225,112 Q252,115 268,132 Q242,135 225,112 Z" />
                  <path d="M195,152 Q238,148 265,168 Q228,175 195,152 Z" />
                </g>

                {/* Deep Emerald Frangipani Leaves */}
                <path
                  d="M128,135 Q122,45 148,18 Q174,48 152,135 Z"
                  fill="#3E582B"
                />
                <path d="M140,132 L147,26" stroke="#6F8C52" strokeWidth="1.5" />

                <path
                  d="M142,138 Q185,68 224,62 Q212,108 150,145 Z"
                  fill="#4A6734"
                />
                <path d="M146,141 L215,69" stroke="#7A985C" strokeWidth="1.5" />

                <path
                  d="M145,148 Q218,132 252,168 Q204,192 142,158 Z"
                  fill="#374F25"
                />
                <path d="M145,152 L242,166" stroke="#68844D" strokeWidth="1.5" />

                <path
                  d="M135,152 Q155,212 142,250 Q112,216 126,152 Z"
                  fill="#435E2E"
                />
                <path d="M132,154 L141,240" stroke="#718E55" strokeWidth="1.4" />

                <path
                  d="M124,142 Q64,112 34,132 Q68,166 125,150 Z"
                  fill="#4C6835"
                />
                <path d="M124,146 L44,133" stroke="#78965A" strokeWidth="1.4" />

                {/* Frangipani Blossom 1 (Left / Upper White & Golden Plumeria) */}
                <g transform="translate(105, 128)">
                  {[0, 72, 144, 216, 288].map((deg) => (
                    <path
                      key={deg}
                      transform={`rotate(${deg})`}
                      d="M0,0 C-14,-12 -18,-36 -2,-42 C14,-38 14,-14 0,0 Z"
                      fill="#FAF8F2"
                      stroke="#E6DFD1"
                      strokeWidth="0.8"
                    />
                  ))}
                  <circle cx="0" cy="0" r="11" fill="#EAB338" />
                  <circle cx="0" cy="0" r="5" fill="#D48817" />
                </g>

                {/* Frangipani Blossom 2 (Right / Lower White & Golden Plumeria) */}
                <g transform="translate(154, 156) scale(0.9)">
                  {[18, 90, 162, 234, 306].map((deg) => (
                    <path
                      key={deg}
                      transform={`rotate(${deg})`}
                      d="M0,0 C-14,-12 -18,-36 -2,-42 C14,-38 14,-14 0,0 Z"
                      fill="#FAF8F2"
                      stroke="#E6DFD1"
                      strokeWidth="0.8"
                    />
                  ))}
                  <circle cx="0" cy="0" r="11" fill="#EAB338" />
                  <circle cx="0" cy="0" r="5" fill="#D48817" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { ArrowRight, Camera, Upload, RotateCcw, Check, Sparkles } from 'lucide-react';
import { useCafe } from '../context/CafeContext';
import { EditorialVisual } from './EditorialVisual';

interface LateriteStorySectionProps {
  onReadMonograph?: () => void;
  showMonographButton?: boolean;
}

const COLLAGE_SLOTS = [
  {
    index: 1,
    sectionKey: 'story_collage_1',
    label: '01 · Center Main Print',
    title: 'Wild Elephants & Sigiriya Horizon',
    defaultSrc: 'editorial:collage-elephants-sigiriya',
  },
  {
    index: 2,
    sectionKey: 'story_collage_2',
    label: '02 · Top-Left Canopy Print',
    title: 'Monsoon Sunbeams Through Canopy',
    defaultSrc: 'editorial:collage-jungle-sunbeams',
  },
  {
    index: 3,
    sectionKey: 'story_collage_3',
    label: '03 · Top-Right Archival Print',
    title: 'Archival Sigiriya Lithograph',
    defaultSrc: 'editorial:collage-archival-rock',
  },
  {
    index: 4,
    sectionKey: 'story_collage_4',
    label: '04 · Bottom-Left Pinned Print',
    title: 'Reclaimed Railway Teak Pavilion',
    defaultSrc: 'editorial:collage-teak-pavilion',
  },
  {
    index: 5,
    sectionKey: 'story_collage_5',
    label: '05 · Right Taped Print',
    title: 'Porous Red Laterite Earth Stone',
    defaultSrc: 'editorial:collage-laterite-stone',
  },
];

export const LateriteStorySection: React.FC<LateriteStorySectionProps> = ({
  onReadMonograph,
  showMonographButton = true,
}) => {
  const {
    siteContent,
    updateCollageImageFromDevice,
    resetCollageImage,
  } = useCafe();

  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [recentlyUpdatedSlot, setRecentlyUpdatedSlot] = useState<number | null>(null);
  const [showDeviceUploaderPanel, setShowDeviceUploaderPanel] = useState(false);

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

  const handleFileChange = async (slotIndex: number, file?: File) => {
    if (!file) return;
    setUploadingSlot(slotIndex);
    try {
      await updateCollageImageFromDevice(slotIndex, file);
      setRecentlyUpdatedSlot(slotIndex);
      window.setTimeout(() => {
        setRecentlyUpdatedSlot((prev) => (prev === slotIndex ? null : prev));
      }, 2800);
    } finally {
      setUploadingSlot(null);
    }
  };

  const renderFrameUploadBadge = (slotIndex: number, shortLabel: string) => {
    const isBusy = uploadingSlot === slotIndex;
    const isDone = recentlyUpdatedSlot === slotIndex;
    return (
      <label
        onClick={(e) => e.stopPropagation()}
        title={`Upload ${shortLabel} from your device`}
        className="absolute bottom-2.5 right-2.5 z-30 opacity-0 group-hover/frame:opacity-100 focus-within:opacity-100 transition-all duration-300 px-2.5 py-1.5 rounded-full bg-[#171513]/90 hover:bg-[#C65B2B] text-[#F8F4EE] text-[10px] uppercase tracking-wider font-medium inline-flex items-center gap-1.5 shadow-lg cursor-pointer backdrop-blur-xs"
      >
        {isBusy ? (
          <span>Uploading...</span>
        ) : isDone ? (
          <>
            <Check className="w-3 h-3 text-[#A3D9A5]" />
            <span>Updated</span>
          </>
        ) : (
          <>
            <Camera className="w-3 h-3" />
            <span>Update Photo</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFileChange(slotIndex, e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
    );
  };

  return (
    <section className="relative overflow-hidden bg-[#F5F2EB] border-b border-[#E7DED3] py-20 sm:py-28">
      {/* Subtle Ambient Paper Texture Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(198,91,43,0.06),transparent_60%)]" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* LEFT EDITORIAL COLUMN */}
          <div className="lg:col-span-5 space-y-6 z-10">
            <h2
              style={{ textWrap: 'balance' }}
              className="text-4xl sm:text-5xl lg:text-[52px] font-editorial font-normal leading-[1.12] tracking-tight text-[#171513]"
            >
              {storyContent?.heading ||
                'Crafted from Laterite Earth, Teak & Monsoon Light.'}
            </h2>

            <p className="text-sm sm:text-[15px] text-[#171513]/75 leading-[1.78] font-light max-w-xl">
              {storyContent?.body ||
                'OneLove Café began as a quiet refuge along the forested road between Kimbissa and the ancient fortress of Sigiriya. We built around the existing Banyan, Frangipani, and Mara trees—using porous red laterite stone, reclaimed railway teak, and hand-troweled lime plaster so the pavilion breathes naturally with the rhythm of the jungle.'}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {showMonographButton && (
                <button
                  type="button"
                  onClick={onReadMonograph}
                  className="px-7 py-3.5 rounded-full bg-[#171513] text-[#F8F4EE] text-[11px] font-medium uppercase tracking-[0.16em] inline-flex items-center gap-3 hover:bg-[#C65B2B] transition-all duration-300 shadow-sm cursor-pointer"
                >
                  <span>Read Sigiriya Monograph</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDeviceUploaderPanel((v) => !v)}
                className="px-4 py-3 rounded-full border border-[#D8CFC2] bg-white/80 hover:bg-white hover:border-[#171513] text-[#171513]/80 hover:text-[#171513] text-[11px] font-medium uppercase tracking-wider inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#C65B2B]" />
                <span>{showDeviceUploaderPanel ? 'Hide Photo Updater' : 'Update Collage Photos'}</span>
              </button>
            </div>
          </div>

          {/* RIGHT ARCHIVAL SCRAPBOOK COLLAGE COLUMN (Hover-Animated) */}
          <div className="lg:col-span-7">
            <div className="group/collage relative w-full max-w-[740px] mx-auto aspect-[16/12] sm:aspect-[16/11] select-none">
              {/* Background Watercolor & Torn Parchment Scrapbook Layers */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[28%] top-[10%] w-[32%] h-[28%] rounded-full bg-[#7A8767]/15 blur-xl transition-transform duration-700 group-hover/collage:scale-110"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[18%] bottom-[6%] w-[28%] h-[22%] rounded-full bg-[#8B9474]/18 blur-xl transition-transform duration-700 group-hover/collage:scale-110"
              />
              {/* Torn Kraft Paper Layer Under Bottom-Right of Main Print */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-[12%] bottom-[5%] w-[38%] h-[24%] bg-[#C8A97E] border border-[#B59469] shadow-md rotate-[8deg] transition-transform duration-700 ease-out group-hover/collage:rotate-[11deg] group-hover/collage:translate-x-1.5 group-hover/collage:translate-y-1"
                style={{
                  clipPath:
                    'polygon(2% 8%, 96% 0%, 100% 88%, 92% 100%, 4% 94%, 0% 24%)',
                }}
              />
              {/* Torn Vintage Cream Paper Strip Behind Left Print */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[4%] top-[24%] w-[18%] h-[38%] bg-[#EFE7D6] shadow-sm -rotate-[12deg] transition-transform duration-700 ease-out group-hover/collage:-rotate-[15deg] group-hover/collage:-translate-x-1.5"
                style={{
                  clipPath:
                    'polygon(6% 0%, 95% 4%, 100% 96%, 12% 100%, 0% 68%)',
                }}
              />

              {/* TOP-LEFT BOTANICAL MARA / BANYAN LEAVES */}
              <svg
                viewBox="0 0 220 260"
                aria-hidden="true"
                className="pointer-events-none absolute -left-[2%] top-[2%] w-[26%] sm:w-[24%] z-0 drop-shadow-md transition-transform duration-700 ease-out origin-bottom-right group-hover/collage:-rotate-6 group-hover/collage:-translate-x-2 group-hover/collage:-translate-y-1.5"
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
                className="group/frame absolute left-[5%] top-[6%] w-[34%] aspect-[3/4] z-10 bg-[#FAF6EE] p-2 sm:p-3 shadow-[0_16px_36px_rgba(23,21,19,0.18)] border border-[#E2D9C8] -rotate-[6deg] transition-all duration-500 ease-out group-hover/collage:-translate-x-2 group-hover/collage:-translate-y-1.5 group-hover/collage:-rotate-[8deg] hover:!z-40 hover:!scale-105 hover:!rotate-[-1deg] hover:!-translate-y-2.5 hover:shadow-[0_26px_55px_rgba(23,21,19,0.28)] cursor-pointer"
              >
                <div className="relative w-full h-full overflow-hidden bg-[#162417]">
                  <EditorialVisual
                    src={getSlotImage(2, 'editorial:collage-jungle-sunbeams')}
                    alt="Monsoon Sunbeams Through Canopy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-108"
                  />
                  {renderFrameUploadBadge(2, 'Top-Left Canopy Photo')}
                </div>
              </div>

              {/* PHOTO 3: TOP-RIGHT ARCHIVAL MONOCHROME PRINT (Archival Sigiriya Lithograph) */}
              <div
                className="group/frame absolute right-[4%] top-[2%] w-[46%] aspect-[16/10] z-10 bg-[#F3EFE4] p-2.5 sm:p-3.5 shadow-[0_14px_32px_rgba(23,21,19,0.14)] border border-[#DFD6C3] rotate-[4deg] transition-all duration-500 ease-out group-hover/collage:translate-x-2 group-hover/collage:-translate-y-1.5 group-hover/collage:rotate-[6deg] hover:!z-40 hover:!scale-105 hover:!rotate-[1deg] hover:!-translate-y-2 hover:shadow-[0_26px_55px_rgba(23,21,19,0.25)] cursor-pointer"
              >
                <div className="relative w-full h-full overflow-hidden bg-[#EFECE4]">
                  <EditorialVisual
                    src={getSlotImage(3, 'editorial:collage-archival-rock')}
                    alt="Archival Sigiriya Rock Fortress Lithograph"
                    className="w-full h-full object-cover grayscale contrast-110 transition-all duration-700 group-hover/frame:grayscale-0 group-hover/frame:scale-105"
                  />
                  {renderFrameUploadBadge(3, 'Top-Right Archival Photo')}
                </div>
              </div>

              {/* PHOTO 1: CENTER-MAIN HERO LANDSCAPE PRINT (Wild Elephants & Sigiriya Horizon) */}
              <div
                className="group/frame absolute left-[18%] top-[21%] w-[63%] aspect-[4/3] z-20 bg-[#FAF6EE] p-2.5 sm:p-4 shadow-[0_22px_50px_rgba(23,21,19,0.22)] border border-[#E2D9C8] -rotate-[0.5deg] transition-all duration-500 ease-out group-hover/collage:-translate-y-1 hover:!z-40 hover:!scale-[1.035] hover:!rotate-0 hover:!-translate-y-2 hover:shadow-[0_30px_65px_rgba(23,21,19,0.3)] cursor-pointer"
              >
                <div className="relative w-full h-full overflow-hidden bg-[#C7D7E2]">
                  <EditorialVisual
                    src={getSlotImage(1, 'editorial:collage-elephants-sigiriya')}
                    alt="Wild Sri Lankan Elephants with Sigiriya Lion Rock in Background"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-105"
                  />
                  {renderFrameUploadBadge(1, 'Main Center Photo')}
                </div>
              </div>

              {/* PHOTO 4: BOTTOM-LEFT PINNED VERTICAL PRINT (Reclaimed Railway Teak Pavilion) */}
              <div
                className="group/frame absolute left-[3%] bottom-[3%] w-[26%] aspect-[3/4] z-30 bg-[#FAF6EE] p-2 sm:p-2.5 shadow-[0_18px_38px_rgba(23,21,19,0.24)] border border-[#E2D9C8] -rotate-[7deg] transition-all duration-500 ease-out group-hover/collage:-translate-x-2.5 group-hover/collage:translate-y-2 group-hover/collage:-rotate-[9deg] hover:!z-40 hover:!scale-110 hover:!rotate-[-1.5deg] hover:!-translate-y-1 hover:shadow-[0_28px_58px_rgba(23,21,19,0.32)] cursor-pointer"
              >
                {/* Brass / Wood Thumbtack Pin at Top Center */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 z-30 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#D6BA8A] via-[#B4935F] to-[#7D6238] border border-[#6B522D] shadow-[0_3px_6px_rgba(0,0,0,0.35)] flex items-center justify-center"
                >
                  <div className="w-2 h-2 rounded-full bg-[#EAD6B3]/60" />
                </div>

                <div className="relative w-full h-full overflow-hidden bg-[#2C2219]">
                  <EditorialVisual
                    src={getSlotImage(4, 'editorial:collage-teak-pavilion')}
                    alt="Reclaimed Railway Teak Pavilion"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-108"
                  />
                  {renderFrameUploadBadge(4, 'Bottom-Left Teak Photo')}
                </div>
              </div>

              {/* PHOTO 5: RIGHT TAPED VERTICAL PRINT (Porous Red Laterite Earth Stone) */}
              <div
                className="group/frame absolute right-[1%] top-[30%] w-[23%] aspect-[3/4] z-30 bg-[#FAF6EE] p-2 sm:p-2.5 shadow-[0_18px_38px_rgba(23,21,19,0.22)] border border-[#E2D9C8] rotate-[7deg] transition-all duration-500 ease-out group-hover/collage:translate-x-2.5 group-hover/collage:translate-y-1 group-hover/collage:rotate-[9deg] hover:!z-40 hover:!scale-110 hover:!rotate-[1.5deg] hover:!-translate-y-1.5 hover:shadow-[0_28px_58px_rgba(23,21,19,0.32)] cursor-pointer"
              >
                {/* Translucent Archival Masking Tape at Top Center */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 z-30 w-12 sm:w-14 h-5 sm:h-6 bg-[#EFE6D2]/85 border border-[#DDD1B8] shadow-xs -rotate-[4deg] backdrop-blur-[1px]"
                />

                <div className="relative w-full h-full overflow-hidden bg-[#4A1E10]">
                  <EditorialVisual
                    src={getSlotImage(5, 'editorial:collage-laterite-stone')}
                    alt="Porous Red Laterite Earth Stone"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover/frame:scale-108"
                  />
                  {renderFrameUploadBadge(5, 'Right Laterite Photo')}
                </div>
              </div>

              {/* BOTTOM-RIGHT FRANGIPANI (PLUMERIA) BLOSSOMS & BOTANICAL LINE ART */}
              <svg
                viewBox="0 0 280 260"
                aria-hidden="true"
                className="pointer-events-none absolute right-[1%] -bottom-[2%] w-[34%] sm:w-[32%] z-35 drop-shadow-[0_12px_20px_rgba(23,21,19,0.22)] transition-transform duration-700 ease-out origin-center group-hover/collage:scale-106 group-hover/collage:rotate-3 group-hover/collage:translate-x-1.5"
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

        {/* EXPANDABLE ON-PAGE DEVICE IMAGE UPDATER DRAWER */}
        {showDeviceUploaderPanel && (
          <div className="mt-12 bg-white border border-[#E7DED3] p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED3] pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[#C65B2B] font-semibold inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Interactive Collage Studio · Upload from Device
                </div>
                <h3 className="text-xl font-editorial font-semibold text-[#171513] mt-0.5">
                  Customize the 5 Collage Photographs
                </h3>
                <p className="text-xs text-[#171513]/65">
                  Select any of the 5 frames below to upload a new photo directly from your phone or computer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceUploaderPanel(false)}
                className="text-xs uppercase tracking-wider font-medium text-[#171513]/60 hover:text-[#171513]"
              >
                Close Panel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {COLLAGE_SLOTS.map((slot) => {
                const currentSrc = getSlotImage(slot.index, slot.defaultSrc);
                const isCustom = !currentSrc.startsWith('editorial:');
                const isUploading = uploadingSlot === slot.index;

                return (
                  <div
                    key={slot.index}
                    className="bg-[#F8F4EE] border border-[#E7DED3] p-3 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#C65B2B] font-semibold">
                        {slot.label}
                      </div>
                      <div className="text-xs font-semibold text-[#171513] truncate">
                        {slot.title}
                      </div>
                      <div className="aspect-[4/3] bg-white border border-[#E7DED3] overflow-hidden">
                        <EditorialVisual src={currentSrc} alt={slot.title} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <label className="flex-1 py-2 px-2.5 bg-[#171513] hover:bg-[#C65B2B] text-[#F8F4EE] text-[11px] font-medium uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>{isUploading ? 'Saving...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            handleFileChange(slot.index, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {isCustom && (
                        <button
                          type="button"
                          title="Reset to default artwork"
                          onClick={() => resetCollageImage(slot.index)}
                          className="p-2 border border-[#E7DED3] bg-white text-[#9E3F16] hover:bg-[#FDF3EF] transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

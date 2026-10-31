import React, { useState } from 'react';

interface EditorialVisualProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export const EditorialVisual: React.FC<EditorialVisualProps> = ({
  src,
  alt,
  className = '',
  priority = false,
}) => {
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [src]);

  if (!src || src === 'loading' || imgError) {
    return (
      <div
        className={`w-full h-full bg-[#EAE2D6] ${className}`}
        role="img"
        aria-label={alt}
      />
    );
  }

  const isEditorialKey = src.startsWith('editorial:');
  const key = src.replace('editorial:', '');

  if (!isEditorialKey) {
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        fetchPriority={priority ? 'high' : undefined}
        decoding="sync"
        onError={() => setImgError(true)}
        className={`w-full h-full object-cover bg-[#EAE2D6] contrast-[1.15] saturate-[1.2] brightness-[1.05] ${className}`}
      />
    );
  }

  // Bespoke architectural, botanical & culinary SVG compositions tailored to Sigiriya & OneLove Café
  switch (key) {
    case 'hero-sanctuary':
    case 'sigiriya-mist':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EAE2D6] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 1200 675" className="w-full h-full object-cover contrast-[1.12] saturate-[1.15]" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1A2616" />
                <stop offset="38%" stopColor="#3B5428" />
                <stop offset="72%" stopColor="#7C9D3E" stopOpacity="0.88" />
                <stop offset="100%" stopColor="#0E130B" />
              </linearGradient>
              <radialGradient id="sunGlow" cx="58%" cy="34%" r="48%">
                <stop offset="0%" stopColor="#FFF6C2" stopOpacity="0.92" />
                <stop offset="38%" stopColor="#B8D458" stopOpacity="0.52" />
                <stop offset="75%" stopColor="#48682B" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0E130B" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sunlitRidge" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8FB33E" />
                <stop offset="45%" stopColor="#65882B" />
                <stop offset="100%" stopColor="#263816" />
              </linearGradient>
              <linearGradient id="midValley" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#567729" />
                <stop offset="60%" stopColor="#2C4219" />
                <stop offset="100%" stopColor="#121B0C" />
              </linearGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#skyGrad)" />
            <circle cx="700" cy="230" r="340" fill="url(#sunGlow)" />
            {/* Sunlit Highland Tea & Jungle Ridges */}
            <path d="M0,370 Q260,265 560,335 T1200,295 L1200,675 L0,675 Z" fill="url(#sunlitRidge)" />
            {/* Iconic Sigiriya Lion Rock Monolith Silhouette */}
            <path
              d="M680,385 L705,235 L730,215 L855,215 L880,235 L905,385 Z"
              fill="#2B241E"
            />
            <path
              d="M722,215 L848,215 L848,203 L735,203 Z"
              fill="#4D6A2E"
            />
            {/* Sunlit Golden Mist across Valley */}
            <rect x="0" y="345" width="1200" height="44" fill="#FFF9D6" fillOpacity="0.18" />
            {/* Rich Emerald Midground Canopy */}
            <path d="M0,435 Q320,365 650,420 T1200,390 L1200,675 L0,675 Z" fill="url(#midValley)" />
            {/* Deep Obsidian Foreground Jungle Shadow for High Contrast */}
            <path d="M0,515 Q260,465 560,505 T1200,485 L1200,675 L0,675 Z" fill="#0B1108" />
            {/* Warm Hanging Sanctuary Lanterns */}
            <line x1="260" y1="0" x2="260" y2="155" stroke="#FFF6DC" strokeWidth="1.5" strokeOpacity="0.55" />
            <ellipse cx="260" cy="175" rx="22" ry="28" fill="#D9622B" fillOpacity="0.92" />
            <circle cx="260" cy="175" r="9" fill="#FFF8E1" />
            <line x1="940" y1="0" x2="940" y2="135" stroke="#FFF6DC" strokeWidth="1.5" strokeOpacity="0.55" />
            <ellipse cx="940" cy="155" rx="18" ry="24" fill="#D9622B" fillOpacity="0.92" />
            <circle cx="940" cy="155" r="7" fill="#FFF8E1" />
            {/* Deep High-Contrast Tropical Framing Foliage */}
            <path d="M960,0 Q1060,95 1200,40 L1200,220 Q1065,175 960,0 Z" fill="#0A1007" />
            <path d="M0,540 Q180,470 310,575 L0,675 Z" fill="#090E06" />
          </svg>
        </div>
      );

    case 'courtyard':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#E7DED3] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 800 600" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <rect width="800" height="600" fill="#DFD3C3" />
            {/* Warm Laterite Terracotta Archway */}
            <rect x="60" y="40" width="680" height="520" fill="#C65B2B" fillOpacity="0.82" />
            <path d="M180,560 L180,240 A220,220 0 0,1 620,240 L620,560 Z" fill="#F8F4EE" />
            {/* Reflecting Lotus Pool */}
            <rect x="180" y="450" width="440" height="110" fill="#58644E" fillOpacity="0.85" />
            <ellipse cx="320" cy="495" rx="34" ry="8" fill="#E7DED3" fillOpacity="0.5" />
            <ellipse cx="470" cy="515" rx="28" ry="7" fill="#E7DED3" fillOpacity="0.5" />
            {/* Botanical Tree & Teak Table inside Arch */}
            <circle cx="400" cy="270" r="85" fill="#58644E" fillOpacity="0.22" />
            <path d="M350,450 L375,380 L425,380 L450,450 Z" fill="#8C4A27" />
            <rect x="330" y="372" width="140" height="10" fill="#171513" />
          </svg>
        </div>
      );

    case 'evening-hearth':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EAE2D6] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 1200 675" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <rect width="1200" height="675" fill="#171513" />
            <radialGradient id="hearthGlow" cx="50%" cy="62%" r="45%">
              <stop offset="0%" stopColor="#E27B43" stopOpacity="0.6" />
              <stop offset="55%" stopColor="#C65B2B" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#171513" stopOpacity="0" />
            </radialGradient>
            <rect width="1200" height="675" fill="url(#hearthGlow)" />
            {/* Arching Hearth Oven */}
            <path d="M440,540 L440,360 A160,160 0 0,1 760,360 L760,540 Z" fill="#27211D" stroke="#C65B2B" strokeWidth="2" strokeOpacity="0.4" />
            <path d="M510,540 L510,420 A90,90 0 0,1 690,420 L690,540 Z" fill="#C65B2B" fillOpacity="0.85" />
            <circle cx="600" cy="490" r="45" fill="#F9D49C" fillOpacity="0.9" />
            {/* String of Warm Garden Lanterns */}
            <path d="M0,120 Q600,240 1200,110" fill="none" stroke="#E7DED3" strokeWidth="1" strokeOpacity="0.3" />
            {[200, 380, 560, 740, 920, 1060].map((cx, i) => (
              <g key={cx}>
                <circle cx={cx} cy={155 + (i % 2) * 18} r="14" fill="#C65B2B" fillOpacity="0.45" />
                <circle cx={cx} cy={155 + (i % 2) * 18} r="5" fill="#FFF3DC" />
              </g>
            ))}
          </svg>
        </div>
      );

    case 'pourover':
    case 'coffee-tonic':
    case 'flatwhite':
    case 'botanical-spritz':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EFE8DD] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 600 450" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <rect width="600" height="450" fill="#EFE8DD" />
            {/* Dappled Window Shadow */}
            <polygon points="0,0 380,0 180,450 0,450" fill="#E3D8C8" />
            {/* Travertine Plinth */}
            <rect x="80" y="330" width="440" height="120" fill="#D5C7B4" />
            {/* Handblown Carafe / Glass Vessel */}
            <ellipse cx="300" cy="330" rx="76" ry="18" fill="#171513" fillOpacity="0.12" />
            <path
              d="M245,175 L355,175 L370,315 A70,20 0 0,1 230,315 Z"
              fill={key === 'flatwhite' ? '#C65B2B' : '#2C1D14'}
              fillOpacity="0.88"
            />
            {/* Golden King Coconut / Crema Top Layer */}
            <path d="M245,175 L355,175 L358,215 L242,215 Z" fill="#D99B52" fillOpacity="0.85" />
            {/* Botanical Leaf Garnish */}
            <path d="M310,175 Q355,115 390,145 Q350,185 310,175 Z" fill="#58644E" />
          </svg>
        </div>
      );

    case 'collage-elephants-sigiriya':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#C7D7E2] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 800 560" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="eleSky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#9AB6CE" />
                <stop offset="55%" stopColor="#D7E3EC" />
                <stop offset="100%" stopColor="#E9ECE4" />
              </linearGradient>
              <linearGradient id="eleGrass" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#7C9647" />
                <stop offset="50%" stopColor="#657F36" />
                <stop offset="100%" stopColor="#465A24" />
              </linearGradient>
            </defs>
            {/* Sky & Soft Monsoon Clouds */}
            <rect width="800" height="300" fill="url(#eleSky)" />
            <ellipse cx="190" cy="95" rx="140" ry="38" fill="#F8F9FA" fillOpacity="0.78" />
            <ellipse cx="560" cy="80" rx="180" ry="44" fill="#F8F9FA" fillOpacity="0.82" />
            <ellipse cx="670" cy="120" rx="110" ry="28" fill="#EDEFF2" fillOpacity="0.7" />

            {/* Sigiriya Lion Rock Monolith on Horizon */}
            <path
              d="M425,245 L446,138 L478,122 L592,124 L618,142 L642,245 Z"
              fill="#7A5A46"
            />
            <path
              d="M446,138 L478,122 L592,124 L610,138 L585,152 L462,150 Z"
              fill="#556B3E"
            />
            {/* Laterite Rock Striations */}
            <path d="M452,165 L612,168 L624,205 L440,202 Z" fill="#9A6849" fillOpacity="0.65" />
            <path d="M468,142 L590,144 L595,188 L460,186 Z" fill="#5E4638" fillOpacity="0.45" />

            {/* Dense Jungle Tree Line at Base of Sigiriya */}
            <path
              d="M0,255 Q90,210 185,235 Q275,198 375,228 Q470,202 575,225 Q690,198 800,232 L800,285 L0,285 Z"
              fill="#3A5129"
            />
            <path
              d="M0,268 Q140,235 290,256 Q460,228 630,254 Q730,238 800,258 L800,290 L0,290 Z"
              fill="#2B3E1E"
            />
            {/* Red Laterite Shoreline */}
            <rect x="460" y="276" width="340" height="8" fill="#B56542" fillOpacity="0.8" />

            {/* Minneriya / Kaudulla Sanctuary Lake */}
            <rect x="0" y="282" width="800" height="88" fill="#9BB3C7" />
            <path d="M0,298 L800,294" stroke="#DCE6EE" strokeWidth="1.5" strokeOpacity="0.6" />
            <path d="M120,322 L680,318" stroke="#DCE6EE" strokeWidth="1" strokeOpacity="0.45" />

            {/* Lush Marsh Meadow Foreground */}
            <path d="M0,355 Q240,342 520,352 T800,348 L800,560 L0,560 Z" fill="url(#eleGrass)" />
            {/* Shallow Foreground Water Reflection */}
            <ellipse cx="520" cy="525" rx="250" ry="26" fill="#7D949E" fillOpacity="0.65" />

            {/* Background Grazing Elephant Herd */}
            <g fill="#383838">
              {/* Distant Left Elephant */}
              <ellipse cx="145" cy="368" rx="34" ry="24" />
              <circle cx="172" cy="360" r="15" />
              <path d="M182,360 Q190,378 184,392" stroke="#383838" strokeWidth="6" fill="none" strokeLinecap="round" />
              <rect x="122" y="382" width="8" height="24" />
              <rect x="156" y="382" width="8" height="24" />

              {/* Mid-Left Cluster */}
              <ellipse cx="275" cy="362" rx="28" ry="20" />
              <ellipse cx="308" cy="358" rx="35" ry="25" />
              <circle cx="335" cy="352" r="16" />
              <rect x="290" y="374" width="8" height="24" />
              <rect x="322" y="374" width="8" height="24" />

              {/* Mid-Right Elephant & Calf */}
              <ellipse cx="520" cy="365" rx="32" ry="23" />
              <circle cx="494" cy="358" r="15" />
              <path d="M482,358 Q476,376 482,390" stroke="#383838" strokeWidth="6" fill="none" strokeLinecap="round" />
              <rect x="502" y="378" width="8" height="24" />
              <rect x="536" y="378" width="8" height="24" />

              {/* Center-Right Bull Elephant */}
              <ellipse cx="615" cy="358" rx="44" ry="32" fill="#2E2E2E" />
              <circle cx="580" cy="348" r="22" fill="#2E2E2E" />
              <path d="M562,350 Q554,376 562,398" stroke="#2E2E2E" strokeWidth="8" fill="none" strokeLinecap="round" />
              <rect x="588" y="380" width="11" height="32" fill="#2E2E2E" />
              <rect x="636" y="380" width="11" height="32" fill="#2E2E2E" />
            </g>

            {/* Foreground Principal Sri Lankan Elephants */}
            {/* Foreground Left Elephant */}
            <g>
              <ellipse cx="235" cy="472" rx="64" ry="44" fill="#3A3837" />
              <circle cx="288" cy="458" r="30" fill="#43403E" />
              <ellipse cx="268" cy="456" rx="18" ry="24" fill="#2F2D2C" />
              <path d="M310,462 Q324,495 314,524" stroke="#3A3837" strokeWidth="13" fill="none" strokeLinecap="round" />
              <rect x="192" y="502" width="16" height="42" rx="4" fill="#2F2D2C" />
              <rect x="220" y="505" width="15" height="40" rx="4" fill="#3A3837" />
              <rect x="262" y="504" width="16" height="42" rx="4" fill="#2F2D2C" />
            </g>

            {/* Foreground Center Matriarch Elephant with Warm Laterite Dust */}
            <g>
              <ellipse cx="445" cy="462" rx="78" ry="54" fill="#32302F" />
              <ellipse cx="450" cy="442" rx="58" ry="32" fill="#4A4542" />
              {/* Head & Warm Trunk */}
              <circle cx="518" cy="444" r="36" fill="#383533" />
              <ellipse cx="492" cy="442" rx="22" ry="30" fill="#282625" />
              {/* Warm Laterite-dusted Trunk & Forehead */}
              <path
                d="M544,446 Q564,485 550,526"
                stroke="#8D5B42"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="530" cy="436" r="3.5" fill="#171513" />
              <rect x="392" y="498" width="18" height="48" rx="4" fill="#282625" />
              <rect x="424" y="502" width="18" height="46" rx="4" fill="#32302F" />
              <rect x="476" y="500" width="18" height="48" rx="4" fill="#282625" />
              <rect x="504" y="502" width="17" height="46" rx="4" fill="#32302F" />
            </g>
          </svg>
        </div>
      );

    case 'collage-jungle-sunbeams':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EAE2D6] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 480 640" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="canopySun" cx="46%" cy="28%" r="55%">
                <stop offset="0%" stopColor="#FFF7D6" stopOpacity="0.95" />
                <stop offset="35%" stopColor="#E1C97B" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#1B2E1B" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="beamGrad" x1="45%" y1="22%" x2="65%" y2="100%">
                <stop offset="0%" stopColor="#FFF6CC" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#A9B97A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="480" height="640" fill="#182819" />
            <circle cx="220" cy="180" r="240" fill="url(#canopySun)" />
            {/* Sunbeams Streaming Through Trees */}
            <polygon points="210,150 40,520 125,520" fill="url(#beamGrad)" />
            <polygon points="220,150 165,540 275,540" fill="url(#beamGrad)" />
            <polygon points="230,150 315,520 445,520" fill="url(#beamGrad)" />
            {/* Calm Jungle Lake Reflection */}
            <rect x="0" y="385" width="480" height="255" fill="#273828" />
            <ellipse cx="225" cy="455" rx="140" ry="45" fill="#DCE3B8" fillOpacity="0.35" />
            <path d="M40,425 L430,425" stroke="#E8EDD0" strokeWidth="1.5" strokeOpacity="0.35" />
            <path d="M75,465 L395,465" stroke="#E8EDD0" strokeWidth="1" strokeOpacity="0.28" />
            {/* Dense Overhanging Banyan & Mara Canopy */}
            <path d="M0,0 L480,0 L480,190 Q360,115 240,165 Q120,110 0,210 Z" fill="#111E11" />
            <circle cx="65" cy="95" r="95" fill="#1D331B" fillOpacity="0.85" />
            <circle cx="405" cy="85" r="105" fill="#1A2E18" fillOpacity="0.85" />
            <circle cx="285" cy="60" r="78" fill="#294422" fillOpacity="0.7" />
            {/* Foreground Reeds & Ferns */}
            <path d="M0,640 L0,510 Q90,535 160,640 Z" fill="#0E190E" />
            <path d="M480,640 L480,520 Q385,545 330,640 Z" fill="#0E190E" />
          </svg>
        </div>
      );

    case 'collage-archival-rock':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EFECE4] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 640 420" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <rect width="640" height="420" fill="#EFECE4" />
            {/* Aged Archival Monochrome Lithograph of Sigiriya Rock */}
            <ellipse cx="320" cy="210" rx="280" ry="165" fill="#E3DEC9" fillOpacity="0.55" />
            {/* Sketchy Horizon Foliage */}
            <path
              d="M20,315 Q120,275 230,295 Q340,270 460,292 Q550,275 620,305 L620,375 L20,375 Z"
              fill="#5C5A54"
              fillOpacity="0.85"
            />
            {/* Monochrome Sigiriya Fortress Monolith */}
            <path
              d="M175,295 L205,135 L255,112 L425,115 L468,142 L495,295 Z"
              fill="#6E6B64"
            />
            {/* Archival Charcoal Shading & Fissures */}
            <path d="M215,142 L455,145 L472,215 L195,212 Z" fill="#52504A" fillOpacity="0.7" />
            <path d="M250,112 L420,115 L435,135 L235,132 Z" fill="#3E3C37" />
            <line x1="285" y1="125" x2="275" y2="285" stroke="#3B3935" strokeWidth="2" strokeOpacity="0.6" />
            <line x1="355" y1="122" x2="365" y2="285" stroke="#3B3935" strokeWidth="2.5" strokeOpacity="0.6" />
            <line x1="410" y1="130" x2="422" y2="280" stroke="#3B3935" strokeWidth="1.5" strokeOpacity="0.5" />
            {/* Summit Citadel Trees */}
            <circle cx="290" cy="106" r="10" fill="#474540" />
            <circle cx="315" cy="104" r="12" fill="#474540" />
            <circle cx="385" cy="108" r="9" fill="#474540" />
          </svg>
        </div>
      );

    case 'collage-teak-pavilion':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EAE2D6] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 450 600" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            {/* Forest Canopy Background */}
            <rect width="450" height="600" fill="#3B492E" />
            <circle cx="340" cy="310" r="160" fill="#6E8052" fillOpacity="0.45" />
            <circle cx="120" cy="420" r="140" fill="#25311C" fillOpacity="0.7" />
            {/* Thatched Eaves & Reclaimed Railway Teak Rafters */}
            <polygon points="0,0 450,0 450,210 0,115" fill="#4A321F" />
            <polygon points="0,45 450,155 450,225 0,120" fill="#6E492C" />
            {/* Rafters */}
            {[40, 105, 170, 235, 300, 365, 420].map((x) => (
              <line key={x} x1={x} y1={0} x2={x + 35} y2={215} stroke="#2A1B10" strokeWidth="6" />
            ))}
            {/* Heavy Hand-Joined Teak Pillars */}
            <rect x="42" y="95" width="44" height="505" fill="#5A3921" />
            <rect x="52" y="95" width="12" height="505" fill="#7C5132" />
            <rect x="195" y="120" width="58" height="480" fill="#6B4426" />
            <rect x="208" y="120" width="16" height="480" fill="#8E5D37" />
            <rect x="335" y="155" width="38" height="445" fill="#4E311B" />
            {/* Horizontal Timber Louvers & Balustrade */}
            {[260, 310, 360, 410, 460].map((y) => (
              <line key={y} x1="86" y1={y} x2="195" y2={y - 12} stroke="#7A4E2D" strokeWidth="8" />
            ))}
            <rect x="0" y="535" width="450" height="65" fill="#3B2516" />
          </svg>
        </div>
      );

    case 'collage-laterite-stone':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EAE2D6] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 420 540" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            {/* Deep Mortar Bed */}
            <rect width="420" height="540" fill="#2A120A" />
            {/* Porous Red Laterite Stone Blocks */}
            {[
              { x: 14, y: 16, w: 185, h: 148, c: '#A84724' },
              { x: 215, y: 12, w: 192, h: 154, c: '#963D1E' },
              { x: -20, y: 182, w: 155, h: 162, c: '#B8522D' },
              { x: 152, y: 184, w: 195, h: 160, c: '#AE4A26' },
              { x: 362, y: 186, w: 90, h: 158, c: '#8E381B' },
              { x: 18, y: 362, w: 205, h: 164, c: '#C15A32' },
              { x: 240, y: 364, w: 170, h: 162, c: '#9E4120' },
            ].map((b, idx) => (
              <g key={idx}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill={b.c} />
                <rect
                  x={b.x + 6}
                  y={b.y + 6}
                  width={b.w - 12}
                  height={b.h - 12}
                  rx="6"
                  fill="#D46B40"
                  fillOpacity="0.28"
                />
                {/* Porous Laterite Cavities */}
                {Array.from({ length: 18 }).map((_, pIdx) => {
                  const px = b.x + 18 + ((pIdx * 37 + idx * 19) % Math.max(20, b.w - 32));
                  const py = b.y + 18 + ((pIdx * 53 + idx * 29) % Math.max(20, b.h - 32));
                  const pr = 2.5 + ((pIdx + idx) % 4) * 1.4;
                  return (
                    <circle
                      key={pIdx}
                      cx={px}
                      cy={py}
                      r={pr}
                      fill="#3B170C"
                      fillOpacity="0.65"
                    />
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      );

    default:
      // Culinary Stoneware Plate Composition (hopper-bowl, curry-bowl, ember-prawns, waffle, tartine, pasta, cacao-torte)
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#EDE5D8] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 600 450" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <rect width="600" height="450" fill="#EDE5D8" />
            {/* Warm linen table runner */}
            <rect x="0" y="60" width="600" height="330" fill="#F8F4EE" fillOpacity="0.7" />
            {/* Ceramic Stoneware Plate Shadow & Rim */}
            <circle cx="308" cy="232" r="148" fill="#171513" fillOpacity="0.08" />
            <circle cx="300" cy="225" r="146" fill="#2A2623" />
            <circle cx="300" cy="225" r="118" fill="#39332E" />
            {/* Artisanal Dish Centerpiece */}
            <circle cx="285" cy="220" r="68" fill="#C65B2B" fillOpacity="0.9" />
            <circle cx="290" cy="215" r="32" fill="#F8F4EE" />
            <circle cx="292" cy="215" r="15" fill="#E58A2E" />
            {/* Botanical Sambol & Herb Accents */}
            <circle cx="355" cy="255" r="26" fill="#58644E" />
            <circle cx="340" cy="175" r="18" fill="#8F3B1B" />
          </svg>
        </div>
      );
  }
};

// Deterministic SVG QR Code Generator for Reservation Vouchers
export const QrCodeSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 148 }) => {
  const grid = 21;
  // Deterministic hash seed from value string
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinderPattern = (r: number, c: number) => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= grid - 7;
    const inBottomLeft = r >= grid - 7 && c < 7;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const renderFinder = (startR: number, startC: number) => (
    <g key={`${startR}-${startC}`}>
      <rect x={startC} y={startR} width={7} height={7} fill="#171513" />
      <rect x={startC + 1} y={startR + 1} width={5} height={5} fill="#FFFFFF" />
      <rect x={startC + 2} y={startR + 2} width={3} height={3} fill="#171513" />
    </g>
  );

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (isFinderPattern(r, c)) continue;
      const cellSeed = Math.imul(hash ^ (r * 31 + c * 17), 1597334677);
      const bit = (Math.abs(cellSeed) + value.charCodeAt((r + c) % value.length)) % 3 === 0;
      if (bit) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#171513" />);
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-2 -2 ${grid + 4} ${grid + 4}`}
      className="bg-white border border-[#E7DED3] p-2"
      aria-label={`Reservation QR code for ${value}`}
    >
      {renderFinder(0, 0)}
      {renderFinder(0, grid - 7)}
      {renderFinder(grid - 7, 0)}
      {cells}
    </svg>
  );
};

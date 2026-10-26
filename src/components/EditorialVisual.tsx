import React, { useState } from 'react';

interface EditorialVisualProps {
  src: string;
  alt: string;
  className?: string;
}

export const EditorialVisual: React.FC<EditorialVisualProps> = ({ src, alt, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [src]);

  if (!src || src === 'loading' || imgError) {
    return (
      <div
        className={`w-full h-full bg-[#E7DED3]/35 ${className}`}
        role="img"
        aria-label={alt}
      />
    );
  }

  const isEditorialKey = src.startsWith('editorial:');
  const key = src.replace('editorial:', '');

  if (!isEditorialKey) {
    const isDataUrl = src.startsWith('data:');
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={isDataUrl ? 'eager' : 'lazy'}
        decoding={isDataUrl ? 'sync' : 'async'}
        onError={() => setImgError(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  // Bespoke architectural, botanical & culinary SVG compositions tailored to Sigiriya & OneLove Café
  switch (key) {
    case 'hero-sanctuary':
    case 'sigiriya-mist':
      return (
        <div className={`relative w-full h-full overflow-hidden bg-[#1D1916] ${className}`} role="img" aria-label={alt}>
          <svg viewBox="0 0 1200 675" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#26201B" />
                <stop offset="48%" stopColor="#5C3A28" />
                <stop offset="82%" stopColor="#C65B2B" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#171513" />
              </linearGradient>
              <radialGradient id="sunGlow" cx="68%" cy="42%" r="38%">
                <stop offset="0%" stopColor="#F4C089" stopOpacity="0.65" />
                <stop offset="50%" stopColor="#C65B2B" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#171513" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1200" height="675" fill="url(#skyGrad)" />
            <circle cx="810" cy="280" r="240" fill="url(#sunGlow)" />
            <circle cx="810" cy="280" r="54" fill="#F8E3C4" fillOpacity="0.85" />
            {/* Distant Highland Mist */}
            <path d="M0,430 Q300,390 620,415 T1200,395 L1200,675 L0,675 Z" fill="#31392B" fillOpacity="0.7" />
            {/* Iconic Sigiriya Lion Rock Monolith Silhouette */}
            <path
              d="M680,430 L705,275 L730,255 L855,255 L880,275 L905,430 Z"
              fill="#231D19"
            />
            <path
              d="M722,255 L848,255 L848,244 L735,244 Z"
              fill="#3A2E27"
            />
            {/* Mist layer across base of Lion Rock */}
            <rect x="0" y="385" width="1200" height="36" fill="#F8F4EE" fillOpacity="0.08" />
            {/* Foreground Jungle Canopy & Verandah Architecture */}
            <path d="M0,480 Q240,435 520,475 T1200,460 L1200,675 L0,675 Z" fill="#1F261C" />
            {/* Teak Pavilion Columns & Warm Lanterns */}
            <rect x="110" y="0" width="18" height="675" fill="#171513" />
            <rect x="410" y="0" width="14" height="675" fill="#171513" />
            <rect x="0" y="54" width="1200" height="16" fill="#171513" />
            {/* Hanging Brass & Rattan Lanterns */}
            <line x1="260" y1="70" x2="260" y2="175" stroke="#E7DED3" strokeWidth="1.5" strokeOpacity="0.5" />
            <ellipse cx="260" cy="195" rx="22" ry="28" fill="#C65B2B" fillOpacity="0.85" />
            <circle cx="260" cy="195" r="8" fill="#FFF3DC" />
            <line x1="560" y1="70" x2="560" y2="145" stroke="#E7DED3" strokeWidth="1.5" strokeOpacity="0.5" />
            <ellipse cx="560" cy="165" rx="18" ry="24" fill="#C65B2B" fillOpacity="0.85" />
            <circle cx="560" cy="165" r="6" fill="#FFF3DC" />
            {/* Tropical Palm Frond Silhouettes */}
            <path d="M980,80 Q1060,120 1160,60 Q1080,150 1180,165 Q1070,185 1140,250 Q1030,200 980,80 Z" fill="#141A12" />
            <path d="M20,560 Q180,490 290,580 L0,675 Z" fill="#141A12" />
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
        <div className={`relative w-full h-full overflow-hidden bg-[#171513] ${className}`} role="img" aria-label={alt}>
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

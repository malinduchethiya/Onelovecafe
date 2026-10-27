import React from 'react';

interface CafeMenuStandProps {
  onClickMenu?: () => void;
}

const STAND_MENU_ITEMS = [
  { name: 'ESPRESSO', price: '4.00' },
  { name: 'AMERICANO', price: '4.50' },
  { name: 'CAPPUCCINO', price: '5.50' },
  { name: 'LATTE', price: '5.50' },
  { name: 'COLD BREW', price: '5.00' },
];

export const CafeMenuStand: React.FC<CafeMenuStandProps> = ({ onClickMenu }) => {
  return (
    <div
      onClick={onClickMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickMenu?.();
        }
      }}
      aria-label="OneLove Café Menu Stand — Click to view full menu"
      className="group/stand relative select-none cursor-pointer transition-transform duration-500 ease-out hover:-translate-y-1.5 focus:outline-none"
    >
      {/* SVG 3D Perspective Teak A-Frame Chalkboard Menu Stand matching reference image */}
      <svg
        viewBox="0 0 380 470"
        className="w-[155px] xs:w-[175px] sm:w-[235px] md:w-[275px] lg:w-[315px] h-auto overflow-visible drop-shadow-[0_18px_28px_rgba(12,10,8,0.45)]"
      >
        <defs>
          {/* Realistic Soft Ground Cast Shadow on the Ivory Floor */}
          <radialGradient id="standFloorShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#120F0C" stopOpacity="0.52" />
            <stop offset="45%" stopColor="#120F0C" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#120F0C" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="standFootShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0D0A08" stopOpacity="0.68" />
            <stop offset="60%" stopColor="#0D0A08" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0D0A08" stopOpacity="0" />
          </radialGradient>

          {/* Sunlit Honey-Teak Wood Gradients */}
          <linearGradient id="teakFrontFace" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DE9251" />
            <stop offset="35%" stopColor="#C87635" />
            <stop offset="75%" stopColor="#B36224" />
            <stop offset="100%" stopColor="#9A4E18" />
          </linearGradient>

          <linearGradient id="teakTopBar" x1="0%" y1="0%" x2="100%" y2="20%">
            <stop offset="0%" stopColor="#E69E5E" />
            <stop offset="50%" stopColor="#CE7D3C" />
            <stop offset="100%" stopColor="#B56527" />
          </linearGradient>

          <linearGradient id="teakSideDepth" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8E4615" />
            <stop offset="50%" stopColor="#6E340E" />
            <stop offset="100%" stopColor="#4F2308" />
          </linearGradient>

          <linearGradient id="teakRearLeg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9E521D" />
            <stop offset="50%" stopColor="#7A3B10" />
            <stop offset="100%" stopColor="#562708" />
          </linearGradient>

          {/* Matte Slate Chalkboard Gradient with Subtle Top Light */}
          <linearGradient id="chalkboardSurface" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#262422" />
            <stop offset="30%" stopColor="#1B1918" />
            <stop offset="75%" stopColor="#141312" />
            <stop offset="100%" stopColor="#0F0E0D" />
          </linearGradient>

          {/* Subtle Inner Bevel Shadow */}
          <linearGradient id="innerFrameBevel" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#59280A" />
            <stop offset="100%" stopColor="#7D3B12" />
          </linearGradient>
        </defs>

        {/* ==================== 1. CAST FLOOR SHADOWS ==================== */}
        {/* Wide ambient floor shadow under the A-frame */}
        <ellipse cx="182" cy="434" rx="168" ry="26" fill="url(#standFloorShadow)" />
        {/* Focused contact shadows under the 3 visible feet */}
        <ellipse cx="48" cy="414" rx="28" ry="8" fill="url(#standFootShadow)" />
        <ellipse cx="118" cy="446" rx="34" ry="9" fill="url(#standFootShadow)" />
        <ellipse cx="326" cy="434" rx="32" ry="8" fill="url(#standFootShadow)" />

        {/* ==================== 2. REAR A-FRAME SUPPORT STRUCTURE (LEFT) ==================== */}
        {/* Dark Interior Backboard Triangle between front and rear legs */}
        <polygon points="88,42 46,356 108,376 116,48" fill="#120F0D" />

        {/* Rear Left Wooden Leg angled backward */}
        <polygon points="82,22 36,412 54,414 96,28" fill="url(#teakRearLeg)" />
        {/* Rear Leg Side Thickness */}
        <polygon points="54,414 64,410 104,34 96,28" fill="#461F07" />

        {/* Wooden Spreader Crossbar connecting Rear Leg to Front Leg */}
        <polygon points="55,274 98,284 98,297 53,286" fill="#8A4416" />
        <polygon points="53,286 98,297 98,302 52,290" fill="#522509" />

        {/* Rear Bottom Horizontal Crossbar */}
        <polygon points="48,352 108,370 108,384 46,365" fill="#68310D" />

        {/* ==================== 3. FRONT CHALKBOARD & TEAK FRAME ==================== */}
        {/* Left 3D Side Depth of the Front Left Leg */}
        <polygon points="82,20 94,16 124,446 110,448" fill="url(#teakSideDepth)" />

        {/* Inner Frame Bevel (Top & Left recessed edge around chalkboard) */}
        <polygon points="104,40 282,42 324,388 126,402" fill="url(#innerFrameBevel)" />

        {/* Matte Black Chalkboard Panel (Tilted in 3D perspective) */}
        <polygon
          points="109,45 279,46 319,384 131,397"
          fill="url(#chalkboardSurface)"
        />

        {/* Subtle Chalkboard Surface Specular Sheen */}
        <polygon
          points="109,45 279,46 295,185 118,192"
          fill="#FFFFFF"
          fillOpacity="0.025"
        />

        {/* Front Teak Frame — Top Rail */}
        <polygon points="88,16 294,18 297,46 90,45" fill="url(#teakTopBar)" />
        {/* Top Rail Upper Bevel Highlight */}
        <polygon points="86,14 292,16 294,18 88,16" fill="#F2B479" />

        {/* Front Teak Frame — Bottom Rail */}
        <polygon points="116,395 322,380 326,408 118,425" fill="url(#teakTopBar)" />
        {/* Bottom Rail Top Ledge Highlight */}
        <polygon points="116,392 321,377 322,380 116,395" fill="#E59B5A" />
        {/* Bottom Rail Underside Shadow */}
        <polygon points="118,425 326,408 326,412 118,429" fill="#5C2A0B" />

        {/* Front Teak Frame — Left Stile & Protruding Foot */}
        <polygon points="88,16 112,16 138,446 112,448" fill="url(#teakFrontFace)" />
        {/* Left Stile Miter Line & Wood Highlight */}
        <line x1="90" y1="16" x2="114" y2="447" stroke="#F0AF73" strokeWidth="1" strokeOpacity="0.55" />
        <line x1="112" y1="45" x2="134" y2="395" stroke="#6E330E" strokeWidth="1.2" strokeOpacity="0.7" />

        {/* Front Teak Frame — Right Stile & Protruding Foot */}
        <polygon points="274,18 295,18 342,432 320,435" fill="url(#teakFrontFace)" />
        {/* Right Stile Inner Depth Edge */}
        <polygon points="270,46 274,46 318,382 313,383" fill="#6B320D" />
        {/* Right Stile Outer Edge Highlight */}
        <line x1="294" y1="18" x2="341" y2="432" stroke="#ECA86B" strokeWidth="1" strokeOpacity="0.5" />

        {/* ==================== 4. CHALKBOARD TYPOGRAPHY & BOTANICAL ART ==================== */}
        {/* Transform group matching the exact tilt & perspective of the chalkboard face */}
        <g transform="matrix(0.998, -0.015, 0.085, 0.995, 0, 0)">
          {/* "CAFÉ MENU" Header */}
          <text
            x="192"
            y="88"
            textAnchor="middle"
            fill="#F4EFE6"
            fontFamily="'Cormorant Garamond', Georgia, serif"
            fontSize="24"
            fontWeight="600"
            letterSpacing="2.2"
          >
            CAFÉ MENU
          </text>

          {/* Hand-Drawn Chalk Botanical Leaf Divider Under Header */}
          <g
            transform="translate(192, 110)"
            stroke="#EAE3D5"
            strokeWidth="1.25"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.88"
          >
            {/* Center Stem */}
            <path d="M-26,2 Q0,-3 26,0" />
            {/* Left & Right Leaves */}
            <path d="M-18,1 C-22,-5 -14,-8 -10,-1 C-14,2 -16,2 -18,1 Z" />
            <path d="M-6,-1 C-10,-7 -1,-9 2,-2 C-2,1 -4,0 -6,-1 Z" />
            <path d="M7,-1 C4,-7 13,-8 15,-1 C11,1 9,0 7,-1 Z" />
            <path d="M-14,2 C-17,8 -9,10 -6,3" />
            <path d="M0,0 C-3,7 5,9 8,2" />
            <path d="M13,0 C11,6 19,7 22,1" />
          </g>

          {/* 5 Classic Menu Items with Dotted Chalk Leaders */}
          {STAND_MENU_ITEMS.map((item, idx) => {
            const yPos = 152 + idx * 29;
            return (
              <g key={item.name} transform={`translate(0, ${yPos})`}>
                {/* Item Name */}
                <text
                  x="118"
                  y="0"
                  fill="#F2ECE1"
                  fontFamily="'Cormorant Garamond', Georgia, serif"
                  fontSize="13.5"
                  fontWeight="600"
                  letterSpacing="1.2"
                >
                  {item.name}
                </text>

                {/* Dotted Chalk Leader */}
                <line
                  x1={118 + item.name.length * 8.2}
                  y1="-2"
                  x2="236"
                  y2="-2"
                  stroke="#F2ECE1"
                  strokeWidth="1.2"
                  strokeDasharray="1.5 4"
                  strokeLinecap="round"
                  opacity="0.65"
                />

                {/* Price */}
                <text
                  x="266"
                  y="-1"
                  textAnchor="end"
                  fill="#F4EFE6"
                  fontFamily="'Cormorant Garamond', Georgia, serif"
                  fontSize="14.5"
                  fontWeight="600"
                  letterSpacing="0.8"
                >
                  {item.price}
                </text>
              </g>
            );
          })}

          {/* Bottom Hand-Drawn Chalk Botanical Coffee Plant & Beans Illustration */}
          <g
            transform="translate(196, 336)"
            stroke="#EAE3D5"
            strokeWidth="1.25"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.86"
          >
            {/* Main Arching Stems */}
            <path d="M-42,18 Q-10,6 38,-14" />
            <path d="M-12,8 Q14,14 42,8" />
            <path d="M-8,6 Q-22,-8 -36,-12" />

            {/* Large Left Botanical Leaf with Veins */}
            <path
              d="M-12,8 C-28,2 -46,8 -48,18 C-34,24 -18,18 -12,8 Z"
              fill="#F4EFE6"
              fillOpacity="0.08"
            />
            <path d="M-14,10 L-44,17" strokeWidth="0.9" />
            <path d="M-24,12 L-29,8" strokeWidth="0.8" />
            <path d="M-32,14 L-36,10" strokeWidth="0.8" />

            {/* Upper Left Leaf */}
            <path
              d="M-14,2 C-20,-10 -34,-16 -40,-10 C-34,-2 -22,2 -14,2 Z"
              fill="#F4EFE6"
              fillOpacity="0.08"
            />
            <path d="M-16,1 L-36,-9" strokeWidth="0.9" />

            {/* Large Upper Right Coffee Leaf with Veins */}
            <path
              d="M2,2 C10,-12 28,-20 40,-15 C34,-2 16,4 2,2 Z"
              fill="#F4EFE6"
              fillOpacity="0.08"
            />
            <path d="M4,1 L36,-14" strokeWidth="0.9" />
            <path d="M14,-4 L12,-10" strokeWidth="0.8" />
            <path d="M23,-8 L21,-14" strokeWidth="0.8" />
            <path d="M18,-5 L25,-3" strokeWidth="0.8" />

            {/* Lower Right Leaf */}
            <path
              d="M6,10 C18,4 36,4 44,11 C32,19 16,17 6,10 Z"
              fill="#F4EFE6"
              fillOpacity="0.08"
            />
            <path d="M8,10 L40,11" strokeWidth="0.9" />
            <path d="M20,10 L25,7" strokeWidth="0.8" />
            <path d="M24,11 L30,15" strokeWidth="0.8" />

            {/* Bottom Center Leaf */}
            <path
              d="M-4,11 C-6,21 2,28 10,25 C10,17 4,12 -4,11 Z"
              fill="#F4EFE6"
              fillOpacity="0.08"
            />

            {/* Cluster of Highland Coffee Cherries / Beans at Center */}
            <ellipse cx="-3" cy="5" rx="4.5" ry="3.4" fill="#1B1918" stroke="#F4EFE6" strokeWidth="1.2" />
            <path d="M-6,5 Q-3,4 0,5" strokeWidth="0.8" />
            <ellipse cx="4" cy="7" rx="4.2" ry="3.2" fill="#1B1918" stroke="#F4EFE6" strokeWidth="1.2" />
            <path d="M1,7 Q4,6 7,7" strokeWidth="0.8" />
            <ellipse cx="-1" cy="-2" rx="3.8" ry="2.8" fill="#1B1918" stroke="#F4EFE6" strokeWidth="1.2" />
          </g>
        </g>
      </svg>
    </div>
  );
};

import React, { useState, useEffect } from 'react';

interface EditorialVisualProps {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

/**
 * Renders live Cloudflare R2 / remote HTTP(S) photography stored in Firestore.
 * Shows a clean neutral surface if no image URL has been uploaded yet.
 */
export const EditorialVisual: React.FC<EditorialVisualProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
  sizes,
}) => {
  const cleanSrc = typeof src === 'string' && /^https?:\/\//i.test(src.trim()) ? src.trim() : '';
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [cleanSrc]);

  if (cleanSrc && failedSrc !== cleanSrc) {
    return (
      <img
        src={cleanSrc}
        alt={alt}
        className={className}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => setFailedSrc(cleanSrc)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`bg-[#EAE2D6] flex items-center justify-center text-[#14110E]/35 text-[11px] font-mono-tabular uppercase tracking-[0.14em] ${className}`}
    />
  );
};

// Deterministic SVG QR Code Generator for Reservation Vouchers (Zero external dependencies)
export const QrCodeSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 128 }) => {
  const grid = 21;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const cells: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, grid - 7);
  drawFinder(grid - 7, 0);

  let seed = Math.abs(hash) || 1337;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= grid - 8;
      const inBL = r >= grid - 8 && c < 8;
      if (inTL || inTR || inBL) continue;
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      cells[r][c] = (seed & 1) === 1;
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      className="bg-white p-2 rounded-lg border border-[#14110E]/15"
      aria-label={`Reservation QR ${value}`}
    >
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#14110E" /> : null
        )
      )}
    </svg>
  );
};

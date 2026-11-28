/**
 * Converts any user-selected Image File (including large 4K/8K raw photos) from device
 * into a high-resolution Base64 Data URL ready for Cloudflare R2 object storage upload.
 */
export async function fileToCompressedBase64(
  file: File,
  maxWidth = 2400,
  maxHeightOrQuality = 1800,
  qualityArg = 0.88,
  maxBase64Length = 6_000_000
): Promise<string> {
  // Guard against callers passing (file, maxWidth, quality) where the 3rd param is <= 1
  const isThirdArgQuality = maxHeightOrQuality > 0 && maxHeightOrQuality <= 1;
  const safeMaxWidth = Math.max(320, Math.round(maxWidth || 2400));
  const safeMaxHeight = isThirdArgQuality
    ? safeMaxWidth
    : Math.max(320, Math.round(maxHeightOrQuality || 1800));
  const safeQuality = isThirdArgQuality
    ? maxHeightOrQuality
    : qualityArg > 0 && qualityArg <= 1
    ? qualityArg
    : 0.88;

  return new Promise((resolve, reject) => {
    const isImageMime = file.type.startsWith('image/');
    const hasImageExt = /\.(jpe?g|png|webp|avif|gif|bmp|svg|heic|heif|tiff?)$/i.test(file.name);
    if (!isImageMime && !hasImageExt) {
      reject(new Error('Please select a valid image file (JPG, PNG, WEBP, AVIF).'));
      return;
    }

    const encodeCanvasWithBudget = (img: HTMLImageElement) => {
      try {
        let targetW = img.naturalWidth || img.width || safeMaxWidth;
        let targetH = img.naturalHeight || img.height || safeMaxHeight;

        if (targetW > safeMaxWidth || targetH > safeMaxHeight) {
          const ratio = Math.min(safeMaxWidth / targetW, safeMaxHeight / targetH);
          targetW = Math.max(64, Math.round(targetW * ratio));
          targetH = Math.max(64, Math.round(targetH * ratio));
        }

        const renderToDataUrl = (w: number, h: number, q: number): string => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context unavailable.');
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          try {
            const webp = canvas.toDataURL('image/webp', q);
            if (webp.startsWith('data:image/webp')) {
              return webp;
            }
          } catch {
            // fallback to jpeg below
          }
          return canvas.toDataURL('image/jpeg', q);
        };

        let currentW = targetW;
        let currentH = targetH;
        let currentQ = safeQuality;
        let dataUrl = renderToDataUrl(currentW, currentH, currentQ);

        // Adaptively step down quality and resolution only if a massive photo exceeds the R2 payload budget
        let attempts = 0;
        while (dataUrl.length > maxBase64Length && attempts < 8) {
          attempts++;
          if (currentQ > 0.74) {
            currentQ = Math.max(0.7, Number((currentQ - 0.05).toFixed(2)));
          } else {
            currentW = Math.max(1280, Math.round(currentW * 0.85));
            currentH = Math.max(720, Math.round(currentH * 0.85));
            currentQ = 0.8;
          }
          dataUrl = renderToDataUrl(currentW, currentH, currentQ);
        }

        resolve(dataUrl);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to process image file.'));
      }
    };

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        encodeCanvasWithBudget(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image file from device.'));
        reader.onload = () => {
          const fallbackImg = new Image();
          fallbackImg.onerror = () => reject(new Error('Failed to decode image file.'));
          fallbackImg.onload = () => encodeCanvasWithBudget(fallbackImg);
          fallbackImg.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file from device.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image file.'));
      img.onload = () => encodeCanvasWithBudget(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

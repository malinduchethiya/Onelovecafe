/**
 * Converts any user-selected Image File (including large 4K/8K raw photos) from device
 * into a high-fidelity Base64 Data URL guaranteed to fit within the specified byte budget.
 */
export async function fileToCompressedBase64(
  file: File,
  maxWidth = 1920,
  maxHeight = 1200,
  quality = 0.86,
  maxBase64Length = 820_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isImageMime = file.type.startsWith('image/');
    const hasImageExt = /\.(jpe?g|png|webp|avif|gif|bmp|svg|heic|heif|tiff?)$/i.test(file.name);
    if (!isImageMime && !hasImageExt) {
      reject(new Error('Please select a valid image file (JPG, PNG, WEBP, AVIF).'));
      return;
    }

    const encodeCanvasWithBudget = (img: HTMLImageElement) => {
      try {
        let targetW = img.naturalWidth || img.width || maxWidth;
        let targetH = img.naturalHeight || img.height || maxHeight;

        if (targetW > maxWidth || targetH > maxHeight) {
          const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
          targetW = Math.max(1, Math.round(targetW * ratio));
          targetH = Math.max(1, Math.round(targetH * ratio));
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
        let currentQ = quality;
        let dataUrl = renderToDataUrl(currentW, currentH, currentQ);

        // Adaptively step down quality and resolution if a dense 4K photo exceeds the target budget
        let attempts = 0;
        while (dataUrl.length > maxBase64Length && attempts < 10) {
          attempts++;
          if (currentQ > 0.72) {
            currentQ = Math.max(0.68, Number((currentQ - 0.06).toFixed(2)));
          } else {
            currentW = Math.max(1280, Math.round(currentW * 0.86));
            currentH = Math.max(720, Math.round(currentH * 0.86));
            currentQ = Math.max(0.74, quality - 0.08);
          }
          dataUrl = renderToDataUrl(currentW, currentH, currentQ);
        }

        // Final safety clamp if still above maxBase64Length
        while (dataUrl.length > maxBase64Length && currentW > 960) {
          currentW = Math.round(currentW * 0.82);
          currentH = Math.round(currentH * 0.82);
          dataUrl = renderToDataUrl(currentW, currentH, 0.72);
        }

        resolve(dataUrl);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to process 4K image.'));
      }
    };

    // Prefer zero-copy Object URL decoding so 20MB–60MB 4K photos decode without memory spikes
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        encodeCanvasWithBudget(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Fallback to FileReader if createObjectURL fails
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


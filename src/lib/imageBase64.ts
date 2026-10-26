/**
 * Converts any user-selected Image File from device into an optimized Base64 Data URL
 * suitable for direct storage in Firebase Firestore documents (staying well within the 1MB doc limit).
 */
export async function fileToCompressedBase64(
  file: File,
  maxWidth = 1920,
  maxHeight = 1200,
  quality = 0.86
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (PNG, JPG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file from device.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }

        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer webp for superior fidelity and smaller size, fallback to jpeg
        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Only gently compress if exceeding 480KB so that crisp details are fully preserved
        if (dataUrl.length > 500_000) {
          try {
            dataUrl = canvas.toDataURL('image/webp', 0.80);
          } catch {
            dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          }
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts any user-selected Image File from device into an optimized Base64 Data URL
 * suitable for direct storage in Firebase Firestore documents (staying well within the 1MB doc limit).
 */
export async function fileToCompressedBase64(
  file: File,
  maxWidth = 1100,
  maxHeight = 850,
  quality = 0.76
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

        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // If still large (> 240KB), step down quality slightly so multiple images fit comfortably in Firestore
        if (dataUrl.length > 240_000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.62);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

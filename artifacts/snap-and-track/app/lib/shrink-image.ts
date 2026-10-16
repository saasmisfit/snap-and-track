// Shrinks a photo in the browser before it is uploaded for analysis, so phone
// photos (often 3–10 MB) travel as a few hundred KB instead.
//
// Never throws: on any failure (a format the browser cannot decode, a canvas
// or memory error, an old browser without createImageBitmap options) the
// original file is returned untouched. HEIC is converted separately below.

const SKIP_BELOW_BYTES = 600 * 1024;
const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.82;

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY);
  });
}

function jpegName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name || 'photo';
  return `${base}.jpg`;
}

export async function shrinkImage(file: File): Promise<File> {
  if (file.size < SKIP_BELOW_BYTES) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    // "from-image" applies the EXIF rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_SIDE_PX ? MAX_SIDE_PX / longest : 1; // never upscale
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no transparency: paint white first so transparent PNG areas do not turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToJpeg(canvas);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

// iPhone photos are often HEIC/HEIF. The analysis API (and most browsers)
// cannot use them, so they are converted to JPEG in the browser first.
// Safari can decode HEIC natively; desktop Chrome and Firefox usually cannot.
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

export function isHeic(file: File): boolean {
  // Some systems (e.g. Windows) report an empty type for HEIC, so check the name too.
  return HEIC_TYPES.includes(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name);
}

function loadWithImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

/**
 * Converts a HEIC/HEIF photo to a JPEG no larger than the normal upload size
 * (also keeping the canvas within iPhone memory limits for 24/48 MP photos).
 * Returns null if this browser cannot decode HEIC. Never throws.
 */
export async function convertHeicToJpeg(file: File): Promise<File | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    let source: CanvasImageSource;
    let srcWidth: number;
    let srcHeight: number;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      source = bitmap;
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
    } catch {
      // Older Safari decodes HEIC in an <img> but not in createImageBitmap.
      const img = await loadWithImageElement(file);
      source = img;
      srcWidth = img.naturalWidth;
      srcHeight = img.naturalHeight;
    }
    if (!srcWidth || !srcHeight) return null;

    const longest = Math.max(srcWidth, srcHeight);
    const scale = longest > MAX_SIDE_PX ? MAX_SIDE_PX / longest : 1;
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    const blob = await canvasToJpeg(canvas);
    if (!blob) return null;
    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

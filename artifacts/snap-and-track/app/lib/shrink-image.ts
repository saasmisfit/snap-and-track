// Shrinks a photo in the browser before it is uploaded for analysis, so phone
// photos (often 3–10 MB) travel as a few hundred KB instead.
//
// Never throws: on any failure (a format the browser cannot decode, such as
// HEIC, a canvas or memory error, an old browser without createImageBitmap
// options) the original file is returned untouched.

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

"use client";

// Client-side image compression, applied before anything reaches Supabase.
//
// Storage was growing ~40MB/day on a 1GB free tier, almost entirely from raw
// camera uploads: the largest single object was 28.6MB and avatars averaged
// 750KB. Phones shoot 12MP; nothing on this platform displays more than about
// 1600px. Compressing at the source fixes storage, upload time on campus wifi,
// and page weight in one place.
//
// Fails open, always. A browser that cannot decode the file (HEIC on some
// Androids, a corrupt image, canvas blocked) returns the original file rather
// than blocking someone's upload — losing an upload is far worse than storing
// a large one.

export interface CompressOptions {
  /** Longest edge of the output, in pixels. */
  maxDimension?: number;
  /** JPEG/WebP quality, 0..1. */
  quality?: number;
  /** Files already smaller than this are returned untouched. */
  skipUnderBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  skipUnderBytes: 150 * 1024,
};

/** Presets, so call sites don't each invent their own numbers. */
export const COMPRESS_PRESETS = {
  /** Student ID cards — must stay legible for the Gemini OCR check. */
  kyc: { maxDimension: 1600, quality: 0.85, skipUnderBytes: 200 * 1024 },
  /** Profile photos: never rendered above ~160px, but keep some room for retina. */
  avatar: { maxDimension: 512, quality: 0.82, skipUnderBytes: 60 * 1024 },
  /** Gig attachments, chat images, company logos. */
  attachment: { maxDimension: 1600, quality: 0.82, skipUnderBytes: 150 * 1024 },
} satisfies Record<string, CompressOptions>;

const isCompressibleImage = (file: File): boolean =>
  /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);

/**
 * Returns a compressed File, or the original when compression is not possible
 * or not worthwhile. Never throws.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  // Documents (PDF/doc/ppt/md) and formats canvas cannot re-encode reliably
  // pass straight through.
  if (!isCompressibleImage(file)) return file;
  if (file.size <= opts.skipUnderBytes) return file;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return file;

  try {
    // `from-image` applies the EXIF orientation, so portrait phone photos do not
    // come out rotated — drawing a bitmap to canvas otherwise discards it.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > opts.maxDimension ? opts.maxDimension / longest : 1;
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }

    // PNGs with transparency become JPEG below, so paint white first rather
    // than letting transparent pixels render as black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", opts.quality)
    );
    if (!blob) return file;

    // If compression did not actually help (already-optimised small JPEGs can
    // grow), keep the original.
    if (blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Convenience for multi-file pickers. Order is preserved. */
export async function compressImages(files: File[], options: CompressOptions = {}): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)));
}

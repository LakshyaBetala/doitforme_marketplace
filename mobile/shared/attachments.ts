// Single source of truth for gig/task attachments.
//
// Files land in the `gig-images` bucket regardless of type, so the *extension*
// is what decides how a path is rendered: images go to the gallery, everything
// else to the download list. Classify by an explicit image allow-list rather
// than by "not a PDF" — otherwise a new doc type (.pptx, .md) silently renders
// as a broken <Image>.

import { isCompressible } from "./imageCompress";

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic"] as const;

export const DOC_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "md", "txt"] as const;

/** `accept` value for attachment file inputs. */
export const ATTACHMENT_ACCEPT = "image/*,.pdf,.doc,.docx,.ppt,.pptx,.md,.txt";

const extensionOf = (path: string): string =>
  (path.split("?")[0].split(".").pop() || "").toLowerCase();

export const isImageAttachment = (path: string): boolean =>
  (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(path));

/** Anything that isn't an image is offered as a download, known type or not. */
export const isDocAttachment = (path: string): boolean => !isImageAttachment(path);

/** Short uppercase label for the download card, e.g. "PDF", "DOCX". */
export const attachmentLabel = (path: string): string =>
  extensionOf(path).toUpperCase() || "FILE";

/**
 * How big an attachment may be — the rule that was missing.
 *
 * Attachments are deliberately not images-only: a poster attaching the brief,
 * the assignment or the deck is the point, which is why DOC_EXTENSIONS exists
 * above. But lib/imageCompress.ts only knows how to shrink images and passes
 * every document straight through, so a PDF arrives at full size and the cost
 * surfaced in the storage quota rather than anywhere a person would see it:
 *
 *   gig-images holds 310 MB, of which 145 MB is NOT images — 52 PDFs, 15 Word
 *   documents, 8 PowerPoints. Ten files over 5 MB account for 111 MB between
 *   them, the largest a single 29 MB PDF.
 *
 * Supabase storage sits at 726 MB of a 1 GB free tier and grows ~335 MB a
 * month, so about a fifth of the whole quota is uncompressed coursework that
 * nobody decided to allow — it was simply never refused.
 *
 * DOCUMENT is the limit that matters, because it is the one nothing downstream
 * can reduce: it has to be refused at the picker, with a reason. UPLOAD is the
 * backstop for images and is checked AFTER compression, since compressImage
 * fails open and returns the original when canvas cannot re-encode the file —
 * which is how a 6.7 MB PNG screenshot got in.
 */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Why this file cannot be uploaded, or null if it can.
 *
 * Names the file and BOTH numbers: "too large" without the limit leaves someone
 * resizing blind and trying again.
 */
export function attachmentRejection(file: File): string | null {
  // A large photo is fine here — it is about to get much smaller. The caller
  // checks uploadRejection() on the compressed result.
  if (isCompressible(file)) return null;
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `${file.name} is ${mb(file.size)}. Documents need to be under ${mb(
      MAX_DOCUMENT_BYTES
    )} — a PDF cannot be compressed the way photos are. Export it smaller, or link to it in the description.`;
  }
  return null;
}

/** The post-compression backstop. Pass the compressed File. */
export function uploadRejection(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is still ${mb(file.size)} after compression, over the ${mb(
      MAX_UPLOAD_BYTES
    )} limit. Please upload a smaller version.`;
  }
  return null;
}

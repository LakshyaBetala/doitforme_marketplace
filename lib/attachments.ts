// Single source of truth for gig/task attachments.
//
// Files land in the `gig-images` bucket regardless of type, so the *extension*
// is what decides how a path is rendered: images go to the gallery, everything
// else to the download list. Classify by an explicit image allow-list rather
// than by "not a PDF" — otherwise a new doc type (.pptx, .md) silently renders
// as a broken <Image>.

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

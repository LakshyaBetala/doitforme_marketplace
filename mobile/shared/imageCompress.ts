// attachments.ts imports this from the website's lib/imageCompress.ts, which needs a
// browser canvas. On the phone, photos are shrunk by expo-image-manipulator before
// upload, so nothing here needs to be skipped.
export const isCompressible = (_file: { type?: string }) => false;

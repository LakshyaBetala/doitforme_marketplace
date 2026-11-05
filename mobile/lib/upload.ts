import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { attachmentRejection, uploadRejection } from '../shared/attachments';
import { isDemo, supabase } from './supabase';

export type Picked = { uri: string; name: string; size: number; mime: string; isImage: boolean };

const clean = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '') || 'file';

export async function pickPhotos(): Promise<Picked[] | string> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'Photo access is needed to pick images.';
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 });
  if (res.canceled) return [];
  return res.assets.map((a, i) => ({
    uri: a.uri,
    name: a.fileName ?? `photo-${i}.jpg`,
    size: a.fileSize ?? 0,
    mime: a.mimeType ?? 'image/jpeg',
    isImage: true,
  }));
}

export async function pickDocument(): Promise<Picked[] | string> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/markdown'],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  const a = res.assets[0];
  const doc: Picked = { uri: a.uri, name: a.name, size: a.size ?? 0, mime: a.mimeType ?? 'application/octet-stream', isImage: false };
  // Refuse at the picker, with the reason: a PDF cannot be compressed like a photo.
  const bad = attachmentRejection(doc as unknown as File);
  return bad ?? [doc];
}

// supabase-js with a Blob silently writes zero-byte files on Android, so always send an
// ArrayBuffer and check it is not empty.
async function toBuffer(p: Picked): Promise<{ buf: ArrayBuffer; name: string; mime: string } | string> {
  let uri = p.uri;
  let name = clean(p.name);
  let mime = p.mime;
  if (p.isImage) {
    // Same idea as lib/imageCompress.ts: shrink before upload, storage is the quota that hurts.
    const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
    uri = out.uri;
    mime = 'image/jpeg';
    name = name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
  }
  const buf = await (await fetch(uri)).arrayBuffer();
  if (buf.byteLength === 0) return `${p.name} could not be read. Try picking it again.`;
  const bad = uploadRejection({ name: p.name, size: buf.byteLength } as unknown as File);
  return bad ?? { buf, name, mime };
}

const demoGuard = () => (isDemo() ? 'Demo mode: uploads are switched off.' : null);

/** Task attachments go to the public `gig-images` bucket as `<uid>/<ts>_<name>`. Returns paths. */
export async function uploadGigFiles(userId: string, files: Picked[]): Promise<{ paths: string[]; error?: string }> {
  const d = demoGuard();
  if (d) return { paths: [], error: d };
  const paths: string[] = [];
  for (const f of files) {
    const prepared = await toBuffer(f);
    if (typeof prepared === 'string') return { paths, error: prepared };
    const path = `${userId}/${Date.now()}_${prepared.name}`;
    const { error } = await supabase.storage.from('gig-images').upload(path, prepared.buf, { contentType: prepared.mime, cacheControl: '3600', upsert: false });
    if (error) return { paths, error: error.message };
    paths.push(path);
  }
  return { paths };
}

/** Resumes go to the PRIVATE `resumes` bucket; the stored value is a bare object path. */
export async function uploadResume(userId: string, f: Picked): Promise<{ path?: string; error?: string }> {
  const d = demoGuard();
  if (d) return { error: d };
  const buf = await (await fetch(f.uri)).arrayBuffer();
  if (buf.byteLength === 0) return { error: 'That file could not be read.' };
  if (buf.byteLength > 2 * 1024 * 1024) return { error: 'Resume must be less than 2MB.' };
  const ext = f.name.split('.').pop()?.toLowerCase() || 'pdf';
  const path = `${userId}/resume_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('resumes').upload(path, buf, { upsert: true, cacheControl: '3600', contentType: f.mime || undefined });
  return error ? { error: error.message } : { path };
}

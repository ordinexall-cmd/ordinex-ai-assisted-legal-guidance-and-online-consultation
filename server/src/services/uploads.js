// ============================================================
// Ordinex - Generic Uploads (multer + storage routing)
// Used by avatar, credential, payment-QR, and report-screenshot
// uploads. Files land under /uploads/<bucket>/... on local disk.
// Non-avatar buckets are auth-gated by the /uploads middleware.
// ============================================================
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadFile } from './storage.js';
import { sniffFileType } from '../utils/validateUploadBuffer.js';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const VIDEO_MIMES = new Set([
  'video/webm', 'video/mp4', 'audio/webm', 'video/x-matroska',
]);
const AUDIO_MIMES = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'video/webm',
]);

/**
 * Build a multer middleware that buffers the file in memory
 * (so we can route it through services/storage.js).
 */
function memoryUpload({ accept = 'image', maxSize = 5 * 1024 * 1024 } = {}) {
  const allowed =
    accept === 'image' ? IMAGE_MIMES :
    accept === 'doc' ? DOC_MIMES :
    accept === 'video' ? VIDEO_MIMES :
    accept === 'audio' ? AUDIO_MIMES :
    accept === 'any' ? new Set([...IMAGE_MIMES, ...DOC_MIMES]) :
    IMAGE_MIMES;

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      if (allowed.has(file.mimetype)) cb(null, true);
      else cb(new Error(`Unsupported file type: ${file.mimetype}`));
    },
  });
}

/**
 * Save a multer file (in memory) to storage and return its URL.
 * The stored extension is derived from the file's real magic bytes, never
 * from the client-supplied name/MIME. Image uploads must actually be images.
 */
export async function persistUploadedFile(file, bucket) {
  if (!file?.buffer) throw new Error('No file uploaded.');

  const sniff = sniffFileType(file.buffer);
  const claimsImage = String(file.mimetype || '').startsWith('image/');

  if (claimsImage && sniff.kind !== 'image') {
    throw new Error('Uploaded file is not a valid image.');
  }
  // Never let an unrecognized payload masquerade as an image bucket asset.
  if ((bucket === 'avatars' || bucket === 'verification' || bucket === 'reports' || bucket === 'payments')
      && sniff.kind !== 'image') {
    throw new Error('Uploaded file is not a valid image.');
  }

  const ext = sniff.ext || path.extname(file.originalname || '');
  return uploadFile(file.buffer, ext, bucket);
}

// Pre-built middlewares for common upload sites
export const avatarUpload = memoryUpload({ accept: 'image', maxSize: 2 * 1024 * 1024 });
export const credentialUpload = memoryUpload({ accept: 'any', maxSize: 5 * 1024 * 1024 });
export const qrUpload = memoryUpload({ accept: 'image', maxSize: 2 * 1024 * 1024 });
export const reportUpload = memoryUpload({ accept: 'image', maxSize: 3 * 1024 * 1024 });
// Identity-verification (KYC) uploads: government ID + dynamic selfie
export const govIdUpload = memoryUpload({ accept: 'image', maxSize: 6 * 1024 * 1024 });
export const selfieUpload = memoryUpload({ accept: 'image', maxSize: 6 * 1024 * 1024 });
// Consultation recording upload (video/audio, up to 50 MB)
export const recordingUpload = memoryUpload({ accept: 'video', maxSize: 50 * 1024 * 1024 });
// Live transcript audio chunks (short clips streamed during a session, up to 10 MB)
export const audioChunkUpload = memoryUpload({ accept: 'audio', maxSize: 10 * 1024 * 1024 });

// Ensure dev upload subdirectories exist (storage.js does this lazily,
// but pre-creating avoids race conditions on first upload).
['avatars', 'credentials', 'payments', 'reports', 'consultations', 'verification', 'recordings'].forEach((b) => {
  const dir = path.join(SERVER_ROOT, 'uploads', b);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});


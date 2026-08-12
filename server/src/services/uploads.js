// ============================================================
// Ordinex - Generic Uploads (multer + storage routing)
// Used by avatar, credential, payment-QR, and report-screenshot
// uploads. In dev mode files land under /uploads/<bucket>/...,
// in prod they go to Supabase Storage.
// ============================================================
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { uploadFile } from './storage.js';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const VIDEO_MIMES = new Set([
  'video/webm', 'video/mp4', 'audio/webm', 'video/x-matroska',
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
 */
export async function persistUploadedFile(file, bucket) {
  if (!file?.buffer) throw new Error('No file uploaded.');
  return uploadFile(file.buffer, file.originalname, bucket);
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

// Ensure dev upload subdirectories exist (storage.js does this lazily,
// but pre-creating avoids race conditions on first upload).
['avatars', 'credentials', 'payments', 'reports', 'consultations', 'verification', 'recordings'].forEach((b) => {
  const dir = path.join('uploads', b);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});


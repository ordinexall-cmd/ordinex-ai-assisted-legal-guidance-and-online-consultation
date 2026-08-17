// ============================================================
// Ordinex — Storage Service
// Local & persistent file upload storage service.
// ============================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Only these extensions may ever be written to disk.
const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.docx',
  '.webm', '.mp4', '.ogg', '.mp3', '.wav', '.m4a',
]);

function safeExtension(ext) {
  const lower = String(ext || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(lower) ? lower : '.bin';
}

/**
 * Upload a file to storage.
 * Saves to local /uploads directory with a cryptographically unguessable name.
 * @param {Buffer} buffer - File buffer
 * @param {string} ext - Safe, server-derived file extension (e.g. ".png")
 * @param {string} bucket - Storage bucket name
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadFile(buffer, ext, bucket = 'documents') {
  const dir = path.join(SERVER_ROOT, 'uploads', bucket);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safeName = `${crypto.randomBytes(24).toString('hex')}${safeExtension(ext)}`;
  const filePath = path.join(dir, safeName);

  fs.writeFileSync(filePath, buffer);
  return `/uploads/${bucket}/${safeName}`;
}


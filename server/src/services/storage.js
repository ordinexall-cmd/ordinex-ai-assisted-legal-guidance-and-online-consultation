// ============================================================
// Ordinex — Storage Service
// Production (Render): Supabase Storage when env is set.
// Development: local server/uploads/ fallback.
// ============================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.docx',
  '.webm', '.mp4', '.ogg', '.mp3', '.wav', '.m4a',
]);

function safeExtension(ext) {
  const lower = String(ext || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(lower) ? lower : '.bin';
}

function useSupabaseStorage() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function mimeForExt(ext) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
  };
  return map[safeExtension(ext)] || 'application/octet-stream';
}

/**
 * Upload to Supabase Storage via REST API (no SDK required).
 */
async function uploadToSupabase(buffer, ext, bucket) {
  const safeName = `${crypto.randomBytes(24).toString('hex')}${safeExtension(ext)}`;
  const objectPath = `${bucket}/${safeName}`;
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${safeName}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': mimeForExt(ext),
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Supabase Storage upload failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  // Public bucket URL pattern
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${objectPath}`;
}

function uploadToLocal(buffer, ext, bucket) {
  const dir = path.join(SERVER_ROOT, 'uploads', bucket);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safeName = `${crypto.randomBytes(24).toString('hex')}${safeExtension(ext)}`;
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${bucket}/${safeName}`;
}

/**
 * @param {Buffer} buffer
 * @param {string} ext
 * @param {string} [bucket]
 * @returns {Promise<string>} Public or app-relative URL
 */
export async function uploadFile(buffer, ext, bucket = 'documents') {
  if (useSupabaseStorage()) {
    return uploadToSupabase(buffer, ext, bucket);
  }
  return uploadToLocal(buffer, ext, bucket);
}

/** True when uploads persist outside ephemeral Render disk. */
export function isRemoteStorage() {
  return useSupabaseStorage();
}

/** Resolve whether a stored URL is local (needs API stream) or remote. */
export function isLocalUploadUrl(url) {
  const u = String(url || '');
  return u.startsWith('/uploads/') || u.startsWith('uploads/');
}

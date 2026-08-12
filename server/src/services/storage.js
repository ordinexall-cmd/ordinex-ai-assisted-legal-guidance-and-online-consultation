// ============================================================
// Ordinex — Storage Service (Supabase / Local)
// File upload to Supabase Storage or local filesystem.
// ============================================================
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

/**
 * Upload a file to storage.
 * Dev: saves to local /uploads directory.
 * Prod: uploads to Supabase Storage.
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} bucket - Storage bucket name
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadFile(buffer, filename, bucket = 'documents') {
  // Dev mode: save locally
  if (env.isDev || !env.SUPABASE_URL) {
    const dir = path.join('uploads', bucket);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(filename);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(dir, safeName);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/${bucket}/${safeName}`;
  }

  // Production: Supabase Storage
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const ext = path.extname(filename);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(safeName, buffer, { contentType: getMimeType(ext) });

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(safeName);
    return data.publicUrl;
  } catch (error) {
    console.error('Supabase upload error:', error);
    throw new Error('File upload failed.');
  }
}

function getMimeType(ext) {
  const types = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return types[ext] || 'application/octet-stream';
}

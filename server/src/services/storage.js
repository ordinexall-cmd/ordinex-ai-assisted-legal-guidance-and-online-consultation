// ============================================================
// Ordinex — Storage Service
// Local & persistent file upload storage service.
// ============================================================
import fs from 'fs';
import path from 'path';

/**
 * Upload a file to storage.
 * Saves to local /uploads directory.
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} bucket - Storage bucket name
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadFile(buffer, filename, bucket = 'documents') {
  const dir = path.join('uploads', bucket);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(filename);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(dir, safeName);

  fs.writeFileSync(filePath, buffer);
  return `/uploads/${bucket}/${safeName}`;
}


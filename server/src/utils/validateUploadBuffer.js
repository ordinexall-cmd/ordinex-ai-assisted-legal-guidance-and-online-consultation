/**
 * Basic upload validation: non-empty buffer + PDF/DOCX magic bytes.
 */
const PDF_MAGIC = Buffer.from('%PDF');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // DOCX is ZIP

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/**
 * Sniff a file's real type from its leading bytes (never trust client MIME).
 * Returns { kind, ext } or { kind: null } when unrecognized.
 */
export function sniffFileType(buffer) {
  if (!buffer || buffer.length < 4) return { kind: null, ext: '' };

  // Images
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', ext: '.png' };
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { kind: 'image', ext: '.jpg' };
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return { kind: 'image', ext: '.gif' };
  // WEBP: RIFF....WEBP
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: 'image', ext: '.webp' };
  }

  // Documents
  if (buffer.subarray(0, 4).equals(PDF_MAGIC)) return { kind: 'pdf', ext: '.pdf' };
  if (buffer.subarray(0, 4).equals(ZIP_MAGIC)) return { kind: 'zip', ext: '.docx' };

  // Media containers
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'media', ext: '.webm' }; // Matroska/WebM
  if (startsWith(buffer, [0x4f, 0x67, 0x67, 0x53])) return { kind: 'media', ext: '.ogg' }; // Ogg
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) return { kind: 'media', ext: '.mp4' }; // ISO-BMFF ftyp
  if (startsWith(buffer, [0x49, 0x44, 0x33]) || startsWith(buffer, [0xff, 0xfb])) return { kind: 'media', ext: '.mp3' };
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46])) return { kind: 'media', ext: '.wav' };

  return { kind: null, ext: '' };
}

export function validateLegalDocumentBuffer(buffer, mimetype) {
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: 'Uploaded file is empty.' };
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return { ok: false, error: 'File must be 10 MB or smaller.' };
  }

  const head = buffer.subarray(0, 4);
  const isPdf = head.subarray(0, 4).equals(PDF_MAGIC);
  const isZip = head.equals(ZIP_MAGIC);

  if (mimetype === 'application/pdf') {
    if (!isPdf) return { ok: false, error: 'File does not appear to be a valid PDF.' };
    return { ok: true };
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    if (!isZip && mimetype !== 'application/msword') {
      return { ok: false, error: 'File does not appear to be a valid DOCX document.' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Only PDF and DOCX files are allowed.' };
}

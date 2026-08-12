/**
 * Basic upload validation: non-empty buffer + PDF/DOCX magic bytes.
 */
const PDF_MAGIC = Buffer.from('%PDF');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // DOCX is ZIP

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

// ============================================================
// Ordinex — Document Parser Service
// Extracts text from PDF and DOCX files for case identification.
// ============================================================
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text from an in-memory document buffer.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>}
 */
export async function extractTextFromBuffer(buffer, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    console.error('Document parsing error:', error.message);
    throw new Error('Failed to extract text from document. Please try a different file.');
  }
}


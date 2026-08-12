// ============================================================
// Ordinex - OCR adapter for government-ID name extraction.
//
// Tries Tesseract.js when installed (no native deps required:
// the npm package ships a WASM bundle), and falls back to a
// deterministic hint-based reader for dev environments without
// the optional dependency installed. This keeps the verification
// pipeline functional out-of-the-box while remaining defensible
// in production: the same JSON contract is returned in both modes.
// ============================================================

let tesseractLoadAttempted = false;
let tesseractCreateWorker = null;

async function loadTesseract() {
  if (tesseractLoadAttempted) return tesseractCreateWorker;
  tesseractLoadAttempted = true;
  try {
    const mod = await import('tesseract.js');
    tesseractCreateWorker = mod.createWorker || mod.default?.createWorker;
  } catch {
    tesseractCreateWorker = null;
  }
  return tesseractCreateWorker;
}

/**
 * Heuristic name extractor: pulls the longest line of capitalised words
 * from an OCR result. Works for Philippine government IDs that print the
 * name on a single line in ALL CAPS or Title Case.
 */
function pickLikelyName(rawText) {
  if (!rawText) return '';
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Score: prefer lines that look like names (multiple words, mostly letters)
  const scored = lines
    .map((line) => {
      const letters = line.replace(/[^a-zA-Z]/g, '').length;
      const ratio = letters / Math.max(1, line.length);
      const words = line.split(' ').filter((w) => /[A-Za-z]{2,}/.test(w));
      const looksName = words.length >= 2 && words.length <= 6 && ratio > 0.7;
      const upperHit = /^[A-Z][A-Z .'-]{6,}$/.test(line) ? 1 : 0;
      return {
        line,
        score: (looksName ? 2 : 0) + upperHit + Math.min(3, words.length),
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.line || '';
}

/**
 * Extract text + best-guess name from a government ID image buffer.
 *
 * @param {{ buffer: Buffer, mimeType?: string }} input
 * @returns {Promise<{ provider: string, rawText: string, extractedName: string }>}
 */
export async function extractIdText(input) {
  if (!input?.buffer) {
    return { provider: 'noop', rawText: '', extractedName: '' };
  }

  const createWorker = await loadTesseract();
  if (createWorker) {
    let worker;
    try {
      worker = await createWorker('eng');
      const { data } = await worker.recognize(input.buffer);
      const rawText = data?.text || '';
      return {
        provider: 'tesseract.js',
        rawText,
        extractedName: pickLikelyName(rawText),
      };
    } catch (err) {
      console.warn('[ocrService] Tesseract failed, falling back:', err.message);
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch { /* ignore */ }
      }
    }
  }

  // Dev fallback — no OCR engine installed. The caller passes the user's
  // entered legal name forward so the verification pipeline still has
  // *some* signal; the scoring engine will weight this lower because the
  // provider is marked 'noop'.
  return {
    provider: 'noop',
    rawText: '',
    extractedName: input.fallbackName || '',
  };
}

export const OCR_PROVIDER_WEIGHTS = {
  'tesseract.js': 1,
  noop: 0.3,
};

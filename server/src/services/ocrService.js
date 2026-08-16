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

import { analyzeImageWithGemini } from './geminiClient.js';
import { env } from '../config/env.js';

/** Confidence multipliers used by lawyer verification scoring (gemini / tesseract / noop). */
export const OCR_PROVIDER_WEIGHTS = {
  'gemini-vision': 1,
  'tesseract.js': 0.9,
  noop: 0,
};

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
 * from an OCR result.
 */
function pickLikelyName(rawText) {
  if (!rawText) return '';
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

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
 */
export async function extractIdText(input) {
  if (!input?.buffer) {
    return { provider: 'noop', rawText: '', extractedName: '' };
  }

  // 1. Primary: Gemini Vision AI (if key present)
  const hasGemini = env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
  if (hasGemini) {
    try {
      const prompt = 'Extract the full legal name printed on this Philippine government ID card. Return ONLY the full name, nothing else.';
      const extractedName = await analyzeImageWithGemini({
        prompt,
        imageBuffer: input.buffer,
        mimeType: input.mimeType || 'image/jpeg',
      });
      if (extractedName && extractedName.length > 3) {
        return {
          provider: 'gemini-vision',
          rawText: extractedName,
          extractedName: extractedName.replace(/["']/g, '').trim(),
        };
      }
    } catch (e) {
      console.warn('[ocrService] Gemini Vision OCR failed, trying Tesseract fallback:', e.message);
    }
  }

  // 2. Secondary: Tesseract WASM
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

  return {
    provider: 'noop',
    rawText: '',
    extractedName: input.fallbackName || '',
  };
}

/**
 * Extract structured name and ID number from a citizen or student ID image.
 */
export async function extractCitizenIdData(input) {
  if (!input?.buffer) {
    return { fullName: '', idNumber: '', idType: '', rawText: '' };
  }

  const hasGemini = env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
  if (hasGemini) {
    try {
      const prompt = `You are a Philippine document OCR parser. Extract information from this ID (Philippine National ID, Driver's License, Passport, UMID, PRC, Student ID, Postal, Voter's, or Gov ID).
Return ONLY a valid JSON object with these keys:
{
  "fullName": "Full legal name printed on ID",
  "idNumber": "ID/Registration/License/Student number",
  "idType": "Detected type e.g. PHILID, PASSPORT, DRIVERS_LICENSE, UMID, STUDENT_ID, PRC, POSTAL, VOTER, OTHER_GOV",
  "birthDate": "YYYY-MM-DD or null"
}`;
      const jsonStr = await analyzeImageWithGemini({
        prompt,
        imageBuffer: input.buffer,
        mimeType: input.mimeType || 'image/jpeg',
      });
      const cleaned = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        fullName: String(parsed.fullName || '').trim(),
        idNumber: String(parsed.idNumber || '').trim(),
        idType: String(parsed.idType || '').trim(),
        birthDate: parsed.birthDate || null,
        rawText: jsonStr,
      };
    } catch (e) {
      console.warn('[ocrService] Gemini extractCitizenIdData failed, trying Tesseract fallback:', e.message);
    }
  }

  // Fallback to text OCR
  const createWorker = await loadTesseract();
  if (createWorker) {
    let worker;
    try {
      worker = await createWorker('eng');
      const { data } = await worker.recognize(input.buffer);
      const rawText = data?.text || '';
      const likelyName = pickLikelyName(rawText);
      // Heuristic ID number regex
      const idMatch = rawText.match(/\b([A-Z0-9]{4,}[-\s]?[A-Z0-9]{4,}[-\s]?[A-Z0-9]{0,8})\b/i);
      return {
        fullName: likelyName,
        idNumber: idMatch ? idMatch[0].trim() : '',
        idType: 'DETECTED',
        birthDate: null,
        rawText,
      };
    } catch (err) {
      console.warn('[ocrService] Tesseract fallback failed:', err.message);
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch { /* ignore */ }
      }
    }
  }

  return {
    fullName: input.fallbackName || '',
    idNumber: input.fallbackIdNumber || '',
    idType: '',
    birthDate: null,
    rawText: '',
  };
}


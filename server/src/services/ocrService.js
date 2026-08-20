// ============================================================
// Ordinex - OCR adapter for government-ID name extraction.
//
// Groq vision first, then Gemini vision. Falls back to profile
// hints when no vision provider is available.
// ============================================================

import { analyzeImageWithGemini } from './geminiClient.js';
import { analyzeImageWithGroq } from './groqClient.js';
import { env } from '../config/env.js';

/** Confidence multipliers used by lawyer verification scoring. */
export const OCR_PROVIDER_WEIGHTS = {
  'groq-vision': 1,
  'gemini-vision': 1,
  noop: 0,
};

function hasGroqVision() {
  return env.GROQ_API_KEYS.length > 0 || Boolean(env.GROQ_API_KEY);
}

function hasGemini() {
  return env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
}

/**
 * Extract text + best-guess name from a government ID image buffer.
 */
export async function extractIdText(input) {
  if (!input?.buffer) {
    return { provider: 'noop', rawText: '', extractedName: '' };
  }

  const prompt = 'Extract the full legal name printed on this Philippine government ID card. Return ONLY the full name, nothing else.';
  const mimeType = input.mimeType || 'image/jpeg';

  if (hasGroqVision()) {
    try {
      const extractedName = await analyzeImageWithGroq({
        prompt,
        images: [{ buffer: input.buffer, mimeType }],
      });
      if (extractedName && extractedName.length > 3) {
        return {
          provider: 'groq-vision',
          rawText: extractedName,
          extractedName: extractedName.replace(/["']/g, '').trim(),
        };
      }
    } catch (e) {
      console.warn('[ocrService] Groq Vision OCR failed, trying Gemini fallback:', e.message);
    }
  }

  if (hasGemini()) {
    try {
      const extractedName = await analyzeImageWithGemini({
        prompt,
        imageBuffer: input.buffer,
        mimeType,
      });
      if (extractedName && extractedName.length > 3) {
        return {
          provider: 'gemini-vision',
          rawText: extractedName,
          extractedName: extractedName.replace(/["']/g, '').trim(),
        };
      }
    } catch (e) {
      console.warn('[ocrService] Gemini Vision OCR failed:', e.message);
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

  const prompt = `You are a Philippine document OCR parser. Extract information from this ID (Philippine National ID, Driver's License, Passport, UMID, PRC, Student ID, Postal, Voter's, or Gov ID).
Return ONLY a valid JSON object with these keys:
{
  "fullName": "Full legal name printed on ID",
  "idNumber": "ID/Registration/License/Student number",
  "idType": "Detected type e.g. PHILID, PASSPORT, DRIVERS_LICENSE, UMID, STUDENT_ID, PRC, POSTAL, VOTER, OTHER_GOV",
  "birthDate": "YYYY-MM-DD or null"
}`;
  const mimeType = input.mimeType || 'image/jpeg';

  const parseIdJson = (jsonStr) => {
    const cleaned = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      fullName: String(parsed.fullName || '').trim(),
      idNumber: String(parsed.idNumber || '').trim(),
      idType: String(parsed.idType || '').trim(),
      birthDate: parsed.birthDate || null,
      rawText: jsonStr,
    };
  };

  if (hasGroqVision()) {
    try {
      const jsonStr = await analyzeImageWithGroq({
        prompt,
        images: [{ buffer: input.buffer, mimeType }],
        jsonMode: true,
      });
      return parseIdJson(jsonStr);
    } catch (e) {
      console.warn('[ocrService] Groq extractCitizenIdData failed, trying Gemini fallback:', e.message);
    }
  }

  if (hasGemini()) {
    try {
      const jsonStr = await analyzeImageWithGemini({
        prompt,
        imageBuffer: input.buffer,
        mimeType,
        jsonMode: true,
      });
      return parseIdJson(jsonStr);
    } catch (e) {
      console.warn('[ocrService] Gemini extractCitizenIdData failed:', e.message);
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

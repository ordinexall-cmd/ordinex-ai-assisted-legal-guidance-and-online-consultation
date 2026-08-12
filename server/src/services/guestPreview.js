/**
 * Lightweight guest preview for landing — no auth, no RAG, no DB.
 */
import { preprocessConcern } from './textPreprocess.js';
import { llmChatWithMeta } from './llmClient.js';

const DISCLAIMER =
  'This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney.';
const LAW_HINT_LINE =
  'Possible legal basis identified. Sign in to view the exact law references and full reasoning.';

const PREVIEW_SCHEMA = `{
  "previewLine": "one sentence summarizing the likely legal angle for a Philippine citizen",
  "outlookLevel": "Weak|Moderate|Strong|Uncertain",
  "caseHint": "short case-type label e.g. Unjust dismissal"
}`;

const VALID_OUTLOOK = new Set(['Weak', 'Moderate', 'Strong', 'Uncertain']);

function truncatePreviewLine(line) {
  const s = (line || '').trim();
  if (s.length <= 200) return s;
  return s.slice(0, 197).trimEnd() + '...';
}

function normalizeOutlook(level) {
  const v = (level || '').trim();
  if (VALID_OUTLOOK.has(v)) return v;
  return 'Uncertain';
}

function fallbackPreview({ category, pre }) {
  const cat = (category || 'legal').toString().trim();
  const words = (pre?.normalized || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
  const topic = words ? ` based on: ${words}` : '';
  return {
    previewLine: truncatePreviewLine(
      `Possible ${cat.toLowerCase()} issue detected${topic}. Sign in to view the full structured analysis and next steps.`,
    ),
    lawHintLine: LAW_HINT_LINE,
    outlookLevel: 'Uncertain',
    caseHint: `${cat} concern`.trim().slice(0, 80),
    disclaimer: DISCLAIMER,
  };
}

/**
 * @param {{ description: string, category?: string }}
 * @returns {Promise<{ previewLine: string, lawHintLine: string, outlookLevel: string, caseHint: string, disclaimer: string }>}
 */
export async function analyzeGuestPreview({ description, category = 'Family' }) {
  const pre = preprocessConcern(description);

  if (pre.isVague) {
    return {
      previewLine: truncatePreviewLine(
        'Add more specific facts — what happened, when, who was involved, and what outcome you want — for a useful preview.',
      ),
      lawHintLine: LAW_HINT_LINE,
      outlookLevel: 'Uncertain',
      caseHint: '',
      disclaimer: DISCLAIMER,
    };
  }

  try {
    const { text } = await llmChatWithMeta({
      jsonMode: true,
      maxTokens: 256,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content: `You are ORDINEX, an AI-assisted legal guidance system for the Philippines.
Provide a single-sentence preview only — NOT full legal advice. Never claim to be a lawyer.
Output valid JSON only matching:
${PREVIEW_SCHEMA}`,
        },
        {
          role: 'user',
          content: `Category: ${category}\nConcern:\n${pre.normalized}`,
        },
      ],
    });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fallbackPreview({ category, pre });
    }

    const previewLine = truncatePreviewLine(parsed.previewLine || '');
    if (!previewLine) {
      return fallbackPreview({ category, pre });
    }

    return {
      previewLine,
      lawHintLine: LAW_HINT_LINE,
      outlookLevel: normalizeOutlook(parsed.outlookLevel),
      caseHint: (parsed.caseHint || '').trim().slice(0, 80),
      disclaimer: DISCLAIMER,
    };
  } catch {
    // Never fail the landing demo due to provider/network issues.
    return fallbackPreview({ category, pre });
  }
}

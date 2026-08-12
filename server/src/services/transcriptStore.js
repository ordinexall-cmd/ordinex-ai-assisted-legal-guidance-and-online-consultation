// ============================================================
// Ordinex — Booking consultation transcript (JSON in Booking.transcript)
// ============================================================
import crypto from 'crypto';
import { sha256 } from '../utils/hash.js';

const EMPTY = () => ({
  version: 1,
  plainText: '',
  segments: [],
  editedAt: null,
  editedBy: null,
});

export function parseTranscript(raw) {
  if (!raw || !String(raw).trim()) return EMPTY();
  try {
    const v = JSON.parse(raw);
    if (typeof v === 'string') {
      return { ...EMPTY(), plainText: v };
    }
    if (v && typeof v === 'object') {
      return {
        version: v.version ?? 1,
        plainText: typeof v.plainText === 'string' ? v.plainText : '',
        segments: Array.isArray(v.segments) ? v.segments : [],
        editedAt: v.editedAt ?? null,
        editedBy: v.editedBy ?? null,
      };
    }
  } catch {
    return { ...EMPTY(), plainText: String(raw) };
  }
  return EMPTY();
}

export function serializeTranscript(doc) {
  return JSON.stringify(doc);
}

function speakerRole(booking, userId) {
  if (booking.citizenId === userId) return 'citizen';
  if (booking.lawyerId === userId) return 'lawyer';
  return 'unknown';
}

function rebuildPlainText(segments) {
  return segments
    .filter((s) => s.text && s.isFinal !== false)
    .map((s) => {
      const who = s.speaker === 'lawyer' ? 'Lawyer' : 'Citizen';
      return `${who}: ${s.text}`;
    })
    .join('\n');
}

/**
 * @param {object} booking
 * @param {object} body - { speaker?, lang?, text, startMs?, isFinal? }
 * @param {string} userId
 */
export function appendTranscriptSegment(booking, body, userId) {
  const doc = parseTranscript(booking.transcript);
  const segment = {
    id: crypto.randomUUID(),
    speaker: body.speaker || speakerRole(booking, userId),
    lang: (body.lang || 'en').slice(0, 12),
    text: String(body.text || '').trim(),
    startMs: typeof body.startMs === 'number' ? body.startMs : Date.now(),
    isFinal: body.isFinal !== false,
  };
  if (!segment.text) {
    throw new Error('Segment text is required.');
  }
  doc.segments.push(segment);
  doc.plainText = rebuildPlainText(doc.segments);
  return { doc, segment };
}

export function patchTranscriptText(booking, plainText, userId) {
  const doc = parseTranscript(booking.transcript);
  doc.plainText = String(plainText || '');
  doc.editedAt = new Date().toISOString();
  doc.editedBy = userId;
  return doc;
}

export function transcriptSha256(doc) {
  return sha256({ plainText: doc.plainText, segmentCount: doc.segments?.length ?? 0 });
}

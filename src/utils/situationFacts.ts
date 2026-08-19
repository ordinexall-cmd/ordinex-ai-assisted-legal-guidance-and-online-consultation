/**
 * Local fact checklist — no LLM. Keep in sync with server/src/services/textPreprocess.js
 */

export type SituationFactId = 'when' | 'where' | 'what';

export interface SituationFactGap {
  id: SituationFactId;
  label: string;
}

const WHEN_RE =
  /\b(\d{1,2}[:.]\d{2}\s?(am|pm)?|\d{1,2}\s?(am|pm)|yesterday|today|tonight|last\s+(night|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(morning|afternoon|evening)|on\s+\d{1,2}|jan\.?|feb\.?|mar\.?|apr\.?|jun\.?|jul\.?|aug\.?|sept?\.?|oct\.?|nov\.?|dec\.?|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{4}|noong|kagahapon|kahapon|kanina|kagabii|gahapon|niadtong)\b/i;

const WHERE_RE =
  /\b(barangay|brgy\.?|purok|sitio|city|municipality|province|street|st\.|avenue|workplace|office|clinic|hospital|school|mall|market|home|house|davao|cebu|manila|quezon|makati|taguig|pasig|caloocan|zamboanga|iloilo|bacolod|cagayan|bank|account|acc|atm|online|internet|website|app|gcash|maya|paypal|ewallet|e-wallet|wallet|facebook|messenger|email|sms|phone|digital)\b/i;

const WHAT_RE =
  /\b(bit|bitten|nakagat|giokot|kagat|hit|assault|stole|stolen|scam|estafa|terminated|fired|dismissed|refused|demand|threat|rape|harass|injury|injured|killed|died|land|title|deed|reclaim|quitclaim|lost|unauthorized|deducted|withdrew|withdrawal|hacked|hack|fraud|phishing|charged)\b/i;

const LABELS: Record<SituationFactId, string> = {
  when: 'When it happened (a date or day is enough)',
  where: 'Where it happened (city, or bank / app / online if it was not in person)',
  what: 'What happened (the incident in your own words)',
};

export function assessDescriptionFacts(text: string): {
  ready: boolean;
  missing: SituationFactGap[];
} {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const sentences = normalized.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const hasWhen = WHEN_RE.test(normalized);
  const hasWhere = WHERE_RE.test(normalized);
  const hasWhat = WHAT_RE.test(normalized) || sentences.length >= 2 || wordCount >= 45;

  const missing: SituationFactGap[] = [];
  if (!hasWhen) missing.push({ id: 'when', label: LABELS.when });
  if (!hasWhere) missing.push({ id: 'where', label: LABELS.where });
  if (!hasWhat) missing.push({ id: 'what', label: LABELS.what });

  const ready = hasWhen && hasWhere && hasWhat && wordCount >= 20 && normalized.length >= 40;
  return { ready, missing: ready ? [] : missing };
}

/**
 * Ordinex AI pipeline v2: preprocess → LLM keywords → RAG → LLM JSON → validate.
 * Groq primary; OpenAI gpt-4o-mini fallback when Groq fails.
 */
import { preprocessConcern } from './textPreprocess.js';
import { llmChatWithMeta, llmChat } from './llmClient.js';
import {
  retrieveLegalContext,
  formatChunksForPrompt,
  summarizeChunkFreshness,
  getLocalCorpusStats,
} from './legalCorpus.js';
import { validateAndFilterAnalysis } from './legalValidator.js';

const SYSTEM = `You are ORDINEX, an AI-assisted legal guidance system for the Philippines (Davao City and national law).
You provide pre-guidance only — NOT legal advice. Never claim to be a lawyer.

RULES:
- Use ONLY laws/cases grounded in ALLOWED_LEGAL_SOURCES below.
- Each source carries a Status (ACTIVE | AMENDED | SUPERSEDED | REPEALED). PREFER ACTIVE/AMENDED sources. Avoid relying on SUPERSEDED or REPEALED sources — if you must mention one, explicitly note that it has been superseded.
- Each source has Priority (high | medium | low). Prefer high-priority curated sources when both apply.
- possibleLegalCases: ONLY distinct legal case TYPES or causes of action (e.g. VAWC, unjust dismissal, estafa). Do NOT list procedural remedies, protective orders, petitions, or filing steps here (e.g. BPO, TPO, "file a complaint") — those belong in suggestedNextSteps.
- Do not list two possibleLegalCases for the same underlying statute when one is only a remedy or procedure under the other.
- Return at most 3 possibleLegalCases; prefer 1–2 unless a third is a clearly different case type.
- confidenceScore is 0-100 for how well the user's facts match that case type (not guaranteed court win).
- In each possibleLegalCases explanation, briefly state what the law covers and why it connects to this situation in plain language.
- Each possibleLegalCases item should include the strongest matching citation context available from ALLOWED_LEGAL_SOURCES (law title, article/section if provided).
- courtWinOutlook.level: Weak | Moderate | Strong | Uncertain — based on facts and evidence described.
- Do NOT invent Republic Acts, articles, or penalties not supported by sources.
- If facts are vague, set courtWinOutlook.level to Uncertain and list missingFacts.
- penalties: short summary of possible legal exposure only, from grounded sources.
- suggestedNextSteps: practical and actionable. Include at least one document-preparation step when relevant (e.g., IDs, contracts, screenshots, receipts, affidavits, police/barangay records), plus agencies like PAO/DOLE/PNP/DSWD/barangay/prosecutor when relevant.
- Output valid JSON only.
- LANGUAGE LOCK: The pipeline tells you the DETECTED_LANGUAGE of the USER CONCERN (en = English, tl = Tagalog, ceb = Cebuano).
- You MUST write ALL citizen-facing textual fields ("userConcernSummary", "penalties", "courtWinOutlook.summary", "courtWinOutlook.factorsFor", "courtWinOutlook.factorsAgainst", "courtWinOutlook.missingFacts", each "possibleLegalCases.explanation", and "suggestedNextSteps") ONLY in that DETECTED_LANGUAGE.
- If DETECTED_LANGUAGE is en, write in clear English — never Tagalog or Cebuano, even when the topic is Philippine family law.
- If DETECTED_LANGUAGE is tl, write in Tagalog. If ceb, write in Cebuano.
- Keep official legal names/citations (e.g. "Republic Act No. 9262", "Revised Penal Code") in English/original.`;

const OUTPUT_SCHEMA = `{
  "userConcernSummary": "string",
  "extractedKeywords": ["string"],
  "possibleLegalCases": [
    {
      "name": "case type name",
      "confidenceScore": 0,
      "explanation": "plain-language explanation of what this law covers and why it matches the facts",
      "applicableLaw": "specific citation (e.g., law title + article/section when available)",
      "sourceLink": "url or null",
      "sourceId": "id from ALLOWED_LEGAL_SOURCES or null"
    }
  ],
  "penalties": "citizen-friendly penalties summary from allowed sources, or short note when uncertain",
  "courtWinOutlook": {
    "level": "Weak|Moderate|Strong|Uncertain",
    "summary": "string",
    "factorsFor": ["string"],
    "factorsAgainst": ["string"],
    "missingFacts": ["string"]
  },
  "suggestedNextSteps": ["practical step including at least one document-preparation item when relevant"],
  "recommendedAgency": "string",
  "lawyerSpecialty": "short English description of lawyer type, e.g. family law attorney",
  "matchSpecialty": "ONE of: Family|Criminal|Labor|Property|Consumer|Cybercrime|Data Privacy|General",
  "costBallpark": "string",
  "systemDisclaimer": "This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney."
}`;

export async function extractKeywordsGroq({ category, description }) {
  const { text, provider } = await llmChatWithMeta({
    jsonMode: true,
    maxTokens: 512,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Extract 5-10 legal keywords (in English) from a Philippine citizen concern. JSON: {"keywords":["..."]}' },
      { role: 'user', content: `Category: ${category}\nConcern: ${description}` },
    ],
  });
  try {
    const p = JSON.parse(text);
    return { keywords: Array.isArray(p.keywords) ? p.keywords : [], provider };
  } catch {
    return { keywords: [], provider };
  }
}

export async function analyzeLegalCase({
  category,
  description,
  extractedText,
  isPremium,
}) {
  const providersUsed = [];
  const detectedLang = await detectLanguage(description);

  const pre = preprocessConcern(description);
  if (pre.isVague) {
    const rawResult = buildVagueResult(pre.normalized);
    const translatedResult = await translateAnalysisResultJSON(rawResult, detectedLang);
    return {
      result: translatedResult,
      meta: {
        outcomeType: 'needs_detail',
        providersUsed: ['rules'],
        corpusSource: 'none',
        usedMock: false,
      },
    };
  }

  let keywords = [];
  try {
    const kw = await extractKeywordsGroq({ category, description: pre.normalized });
    keywords = kw.keywords;
    providersUsed.push(`${kw.provider}-keywords`);
  } catch (e) {
    console.warn('[ai] keyword extraction failed:', e.message);
  }

  const searchText = [pre.normalized, extractedText?.slice(0, 3000), keywords.join(' ')].filter(Boolean).join(' ');
  const { chunks, source: corpusSource } = await retrieveLegalContext({
    category,
    description: searchText,
    limit: 8,
  });

  if (!chunks.length) {
    const rawResult = buildNoCorpusResult(pre.normalized);
    const translatedResult = await translateAnalysisResultJSON(rawResult, detectedLang);
    return {
      result: translatedResult,
      meta: {
        outcomeType: 'no_corpus',
        providersUsed,
        corpusSource,
        usedMock: false,
      },
    };
  }

  const allowedBlock = formatChunksForPrompt(chunks);
  const langLabel = detectedLang === 'tl' ? 'Tagalog (tl)' : detectedLang === 'ceb' ? 'Cebuano (ceb)' : 'English (en)';
  const userPrompt = `DETECTED_LANGUAGE: ${detectedLang} (${langLabel})
CATEGORY: ${category}
USER CONCERN:
${pre.normalized}
${extractedText ? `\nDOCUMENT EXCERPT:\n${extractedText.slice(0, 4000)}` : ''}
${keywords.length ? `\nKEYWORDS: ${keywords.join(', ')}` : ''}

ALLOWED_LEGAL_SOURCES (cite ONLY these):
${allowedBlock}

Respond with JSON matching:
${OUTPUT_SCHEMA}`;

  let raw;
  try {
    const { text, provider } = await llmChatWithMeta({
      jsonMode: true,
      maxTokens: 4096,
      temperature: isPremium ? 0.3 : 0.25,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    });
    raw = JSON.parse(text);
    providersUsed.push(`${provider}-main`);
  } catch (e) {
    throw new Error(`AI analysis failed: ${e.message}`);
  }

  const result = validateAndFilterAnalysis(raw, chunks, detectedLang, category);
  if (keywords.length && result.extractedKeywords.length < 2) {
    result.extractedKeywords = keywords.slice(0, 10);
  }

  const hasStrongMatch =
    Array.isArray(result.possibleLegalCases) &&
    result.possibleLegalCases.length > 0 &&
    result.possibleLegalCases[0].confidenceScore >= 50;

  const freshness = summarizeChunkFreshness(chunks);
  const corpusStats = getLocalCorpusStats();
  const corpusHealth = {
    meetsMinimum: corpusStats.meetsMinimum,
    totalLocal: corpusStats.total,
    highPriority: corpusStats.highPriority,
  };

  // A "full" billable result requires both a confident match AND grounding on
  // sources that are not entirely superseded/stale.
  const billable = hasStrongMatch && !result._complexCase && !result._supersededWarning;

  const finalResult = await translateAnalysisResultJSON(result, detectedLang);

  return {
    result: finalResult,
    meta: {
      outcomeType: billable ? 'full' : 'needs_detail',
      providersUsed,
      corpusSource,
      corpusFreshness: freshness,
      corpusHealth,
      supersededWarning: !!result._supersededWarning,
      usedMock: false,
    },
  };
}

function buildVagueResult(summary) {
  return {
    userConcernSummary: summary,
    extractedKeywords: ['needs-detail'],
    possibleLegalCases: [],
    penalties: '',
    courtWinOutlook: {
      level: 'Uncertain',
      summary: 'Please provide more specific facts: what happened, when, who was involved, and what outcome you want.',
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: ['Timeline of events', 'Names or roles of parties', 'Location in Davao or elsewhere', 'Any documents or reports filed'],
    },
    suggestedNextSteps: [
      'Rewrite your concern with dates and specific actions taken by each party.',
      'Gather any contracts, messages, receipts, or police/barangay records.',
      'For urgent harm, contact barangay officials, PNP, or DSWD as appropriate.',
    ],
    recommendedAgency: 'Barangay hall or nearest police station for immediate incidents',
    lawyerSpecialty: 'General practice attorney after facts are clear',
    costBallpark: 'Varies; PAO offers free aid if income-qualified',
    systemDisclaimer: 'This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney.',
  };
}

function buildNoCorpusResult(summary) {
  return {
    ...buildVagueResult(summary),
    courtWinOutlook: {
      level: 'Uncertain',
      summary: 'Legal knowledge base is not available yet. Configure Supabase corpus or run database seed.',
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: ['Legal database connection'],
    },
  };
}

// Common marker words for fast local heuristic detection.
// Shared words (sa, ang, mga, lang, ko, ka, siya, kami, sila, nila, niya, wala, pero, kay, etc.)
// appear in BOTH lists so they contribute equally and don't bias toward one dialect.
const CEB_MARKERS = /\b(akong|akoang|among|imong|nako|namo|kini|kana|kadto|nganong|mao|dili|gikan|tungod|unya|ug|nga|og|naa|aduna|kanamo|kanila|kanimo|unsa|asa|kanus-a|pila|palihog|tabang|unsay|gipusil|girekomenda|dali|gikinahanglan|pag-andam|giya|kaayo|daghan|gamay|gusto|nasayod|nabangga|sakyanan|nidagan|nakahibalo|sa|ang|mga|lang|ko|ka|siya|kami|sila|nila|niya|wala|pero|kay|para|barangay|abogado|trabaho|dokumento|lisensyado|kaso)\b/gi;
const TL_MARKERS = /\b(ako|akin|aking|namin|ito|iyon|iyan|bakit|hindi|dahil|kasi|at|ng|nang|kung|kapag|meron|mayroon|din|rin|lamang|yung|iyong|niyo|nyo|ninyo|po|tinanggal|kumonsulta|inirerekumenda|paghahanda|sa|ang|mga|lang|ko|ka|siya|kami|sila|nila|niya|wala|pero|kay|para|barangay|abogado|trabaho|dokumento|lisensyado|kaso)\b/gi;
// Strong English cues — prefer en when these dominate over TL/CEB (avoids PH-topic English → Tagalog).
const EN_MARKERS = /\b(the|and|with|without|from|that|this|have|has|had|was|were|been|being|my|his|her|their|our|your|husband|wife|kids|children|child|divorced|divorce|permission|contact|flew|can't|cannot|don't|didn't|won't|isn't|aren't|because|before|after|about|would|could|should|please|help|lawyer|custody|police)\b/gi;

export function detectLanguageLocal(text) {
  const lower = (text || '').toLowerCase();
  const cebHits = [...lower.matchAll(CEB_MARKERS)].length;
  const tlHits = [...lower.matchAll(TL_MARKERS)].length;
  const enHits = [...lower.matchAll(EN_MARKERS)].length;

  const dialectMax = Math.max(cebHits, tlHits);

  // Clear English: enough EN markers and stronger than dialect signal
  if (enHits >= 3 && enHits > dialectMax) return 'en';
  if (enHits >= 2 && dialectMax < 2) return 'en';

  // Require at least 2 marker hits for dialect confidence
  if (cebHits >= 2 && cebHits > tlHits && cebHits >= enHits) return 'ceb';
  if (tlHits >= 2 && tlHits > cebHits && tlHits >= enHits) return 'tl';
  if (cebHits >= 2 && cebHits > enHits) return 'ceb';
  if (tlHits >= 2 && tlHits > enHits) return 'tl';

  // English still wins on weak dialect + some English
  if (enHits >= 2) return 'en';

  return null; // ambiguous — needs LLM
}

export async function detectLanguage(text) {
  // Fast local heuristic first
  const localResult = detectLanguageLocal(text);
  if (localResult) {
    console.log(`[language-detect] local heuristic → ${localResult}`);
    return localResult;
  }

  // Fall back to LLM for ambiguous text
  try {
    const response = await llmChat({
      maxTokens: 10,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'You are a language classifier for Philippine citizen messages. Reply with ONLY "en", "tl", or "ceb" (en=English, tl=Tagalog, ceb=Cebuano). If the text is predominantly English words — even when the topic is Philippine law, family, or custody — reply "en". Reply "tl" or "ceb" only when Tagalog or Cebuano words dominate. Do not add punctuation or explanation.',
        },
        { role: 'user', content: text },
      ],
    });
    const clean = response.trim().toLowerCase();
    if (clean === 'tl' || clean.startsWith('tl') || clean.includes('tagalog')) return 'tl';
    if (clean === 'ceb' || clean.startsWith('ceb') || clean.includes('cebuano')) return 'ceb';
    return 'en';
  } catch (err) {
    console.warn('[language-detect] LLM failed:', err);
    return 'en';
  }
}

export async function translateAnalysisResultJSON(result, targetLang) {
  if (targetLang === 'en') return result;

  // Preserve enum values that the frontend checks with exact string comparison
  const preservedLevel = result.courtWinOutlook?.level;
  const preservedFreshness = (result.possibleLegalCases || []).map((c) => c.freshness);

  const targetName = targetLang === 'tl' ? 'Tagalog' : 'Cebuano';
  const prompt = `You are a translator. Translate this legal analysis JSON object from English to ${targetName}.
Rules:
1. Translate all textual values: summaries, explanations, penalties, next steps, disclaimers, agency names, lawyer specialty, cost ballpark, missing facts, factors.
2. DO NOT translate these fields — keep them EXACTLY as-is:
   - "courtWinOutlook.level" (must remain one of: "Weak", "Moderate", "Strong", "Uncertain")
   - "confidenceScore" (number)
   - "freshness" (must remain "current", "amended", or "stale")
   - "sourceLink", "sourceId"
   - "extractedKeywords" (keep in English for search)
   - "_complexCase", "_supersededWarning"
3. Keep official legal citations/numbers (e.g., "Republic Act No. 9262", "Article 282") in their original format.
4. Return the exact same JSON structure.

JSON to translate:
${JSON.stringify(result, null, 2)}`;

  try {
    const translatedText = await llmChat({
      jsonMode: true,
      maxTokens: 4096,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Output valid JSON only. Do not add any conversational text.' },
        { role: 'user', content: prompt }
      ]
    });
    const translated = JSON.parse(translatedText);

    // Safety net: forcefully restore enum values the LLM might have translated
    if (translated.courtWinOutlook && preservedLevel) {
      translated.courtWinOutlook.level = preservedLevel;
    }
    if (Array.isArray(translated.possibleLegalCases)) {
      translated.possibleLegalCases.forEach((c, i) => {
        if (preservedFreshness[i] !== undefined) c.freshness = preservedFreshness[i];
      });
    }
    // Preserve internal flags
    if (result._complexCase !== undefined) translated._complexCase = result._complexCase;
    if (result._supersededWarning !== undefined) translated._supersededWarning = result._supersededWarning;

    return translated;
  } catch (err) {
    console.warn('[translate-result] translation failed, returning original:', err);
    return result;
  }
}

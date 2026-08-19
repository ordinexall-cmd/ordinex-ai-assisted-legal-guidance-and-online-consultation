/**
 * Ordinex AI pipeline v2: preprocess → LLM keywords → RAG → LLM JSON → validate.
 * Groq primary (openai/gpt-oss-120b); Gemini 3.6 Flash fallback when Groq fails.
 */
import { preprocessConcern } from './textPreprocess.js';
import { llmChatWithMeta, llmChat } from './llmClient.js';
import { env } from '../config/env.js';
import {
  retrieveLegalContext,
  formatChunksForPrompt,
  summarizeChunkFreshness,
  getLocalCorpusStats,
} from './legalCorpus.js';
import { validateAndFilterAnalysis } from './legalValidator.js';
import { attachLibraryGuidance } from './libraryGuidance.js';
import { toAiUserFacingError } from '../utils/userFacingError.js';

const SYSTEM = `You are ORDINEX, an AI-assisted legal guidance system for the Philippines (Davao City and national law).
You provide pre-guidance only — NOT legal advice. Never claim to be a lawyer.

RULES:
- Use ONLY laws/cases grounded in ALLOWED_LEGAL_SOURCES below.
- Each source carries a Status (ACTIVE | AMENDED | SUPERSEDED | REPEALED). PREFER ACTIVE/AMENDED sources. Avoid relying on SUPERSEDED or REPEALED sources — if you must mention one, explicitly note that it has been superseded.
- Each source has Priority (high | medium | low). Prefer high-priority curated sources when both apply.
- possibleLegalCases: ONLY distinct legal case TYPES. Do NOT list procedural remedies, protective orders, petitions, or filing steps here — those belong in suggestedNextSteps.
- name must be everyday words a non-lawyer understands (e.g. "Recovering land you already bought"). Put Latin or formal titles only in applicableLaw (e.g. Civil Code Art. 434, accion reivindicatoria).
- Do not list two possibleLegalCases for the same underlying statute when one is only a remedy or procedure under the other.
- Return at most 2 possibleLegalCases; prefer 1 unless a second is a clearly different case type.
- userConcernSummary: one short restatement. courtWinOutlook.summary must add new information — do not repeat the summary.
- factorsFor / factorsAgainst: ONLY facts the citizen actually wrote. Never invent documents (deed, title, contract) they did not mention.
- Do not write "court win outlook", "plaintiff", "cause of action", or "accion" in citizen-facing sentences unless you explain the term once in parentheses.
- possibleDeadline: plain-language time limit only if ALLOWED_LEGAL_SOURCES state a period. If unknown, say a lawyer should confirm the deadline — never guess a number of years.
- cautions: 2–4 "what not to do yet" items (do not sign a waiver you do not understand, do not ignore a summons, do not post the dispute publicly, do not confront someone if it is unsafe).
- confidenceScore is 0-100 for how well the user's facts match that case type (not guaranteed court win).
- In each possibleLegalCases explanation, briefly state what the law covers and why it connects to this situation in plain language.
- Each possibleLegalCases item should include the strongest matching citation context available from ALLOWED_LEGAL_SOURCES (law title, article/section if provided).
- courtWinOutlook.level: Weak | Moderate | Strong | Uncertain — based on facts and evidence described.
- Do NOT invent Republic Acts, articles, or penalties not supported by sources.
- If facts are vague, set courtWinOutlook.level to Uncertain and list missingFacts.
- penalties: short summary of possible legal exposure only, from grounded sources.
- suggestedNextSteps: copy LIBRARY_STEPS from ALLOWED_LEGAL_SOURCES when present. You may add extra situation-specific steps; do not invent a statute that is not in the sources.
- documents: copy LIBRARY_DOCUMENTS when present. Extra items for this person's facts are allowed.
- Output valid JSON only.
- LANGUAGE LOCK: The pipeline tells you the DETECTED_LANGUAGE of the USER CONCERN (en = English, tl = Tagalog, ceb = Cebuano).
- You MUST write ALL citizen-facing textual fields ("userConcernSummary", "penalties", "courtWinOutlook.summary", "courtWinOutlook.factorsFor", "courtWinOutlook.factorsAgainst", "courtWinOutlook.missingFacts", each "possibleLegalCases.explanation", "suggestedNextSteps", "possibleDeadline", and "cautions") ONLY in that DETECTED_LANGUAGE.
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
  "matchSpecialty": "ONE of: Family|Criminal|Labor|Property|Consumer|Cybercrime|Data Privacy|Civil|Corporate|Tax|Immigration|Intellectual Property|Administrative|Environmental|Human Rights|General",
  "costBallpark": "string",
  "possibleDeadline": "plain-language time limit from sources, or a short note that a lawyer should confirm",
  "cautions": ["what not to do yet"],
  "systemDisclaimer": "This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney."
}`;

export async function extractKeywordsGroq({ category, description }) {
  const { text, provider } = await llmChatWithMeta({
    model: env.GROQ_MODEL,
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
  liveSearch = false,
  corpusOnly = false,
}) {
  const providersUsed = [];
  const pre = preprocessConcern(description);
  if (pre.isVague) {
    return {
      result: buildVagueResult(pre.normalized, pre.missingFacts),
      meta: {
        outcomeType: 'needs_detail',
        providersUsed: ['rules'],
        corpusSource: 'none',
        usedMock: false,
      },
    };
  }

  const detectedLang = await detectLanguage(description);

  let keywords = [];
  try {
    const kw = await extractKeywordsGroq({ category, description: pre.normalized });
    keywords = kw.keywords;
    providersUsed.push(`${kw.provider}-keywords`);
  } catch (e) {
    console.warn('[ai] keyword extraction failed:', e.message);
  }

  const searchCategory = !category || category === 'unsure' || category === 'General' ? undefined : category;

  const searchText = [pre.normalized, extractedText?.slice(0, 3000), keywords.join(' ')].filter(Boolean).join(' ');
  let { chunks, source: corpusSource } = await retrieveLegalContext({
    category: searchCategory,
    description: searchText,
    limit: 8,
  });

  if (!chunks.length && liveSearch) {
    try {
      const liveChunks = await retrieveLiveLegalContext({
        keywords,
        description: pre.normalized,
      });
      if (liveChunks.length) {
        chunks = liveChunks;
        corpusSource = 'live';
        providersUsed.push('live-gov-search');
      }
    } catch (e) {
      console.warn('[ai] live legal search failed:', e.message);
    }
  }

  if (!chunks.length) {
    if (corpusOnly) {
      return {
        result: buildNoCorpusResult(pre.normalized),
        meta: {
          outcomeType: 'requires_login',
          providersUsed,
          corpusSource,
          usedMock: false,
        },
      };
    }
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
      model: env.GROQ_MODEL,
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
    const friendly = new Error(toAiUserFacingError(e));
    friendly.statusCode = e?.statusCode || 503;
    throw friendly;
  }

  const result = attachLibraryGuidance(
    validateAndFilterAnalysis(raw, chunks, detectedLang, category),
    chunks,
  );
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

  const translated = await translateAnalysisResultJSON(result, detectedLang);
  const finalResult = attachLibraryGuidance(translated, chunks);

  const retrievedSources = (chunks || []).slice(0, 12).map((c) => ({
    name: c.name || c.citation || 'Legal reference',
    citation: c.citation || c.name || '',
    url: c.source_url || c.url || c.link || '',
  })).filter((s) => s.name);

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
      retrievedSources,
      liveChunks: corpusSource === 'live' ? chunks : [],
    },
  };
}

function buildVagueResult(summary, missingFacts = []) {
  const gaps = (missingFacts || []).map((m) => m.label || m).filter(Boolean);
  const listed = gaps.length
    ? gaps
    : ['When it happened (date and time)', 'Where it happened', 'What happened', 'Who was involved'];
  return {
    userConcernSummary: summary,
    extractedKeywords: ['needs-detail'],
    possibleLegalCases: [],
    penalties: '',
    courtWinOutlook: {
      level: 'Uncertain',
      summary: 'Add the missing facts below so we can match the right Philippine guidance. We have not used an AI analysis yet.',
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: listed,
    },
    possibleDeadline: '',
    cautions: [],
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
      model: env.GROQ_MODEL,
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
1. Translate all textual values: summaries, explanations, penalties, next steps, disclaimers, agency names, lawyer specialty, cost ballpark, missing facts, factors, possibleDeadline, cautions.
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

/**
 * Follow-up Q&A on an existing analysis result (Groq Llama primary).
 */
export async function followUpWithGroq({ originalResult, history, question }) {
  const context = JSON.stringify(originalResult, null, 2);
  const prior = (history || [])
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Citizen' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const response = await llmChat({
    maxTokens: 1024,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are Ordinex, a Philippine legal guidance assistant. Answer follow-up questions based on the prior analysis. Be concise, plain-language, and never claim to be a licensed attorney. If unsure, recommend booking a lawyer.',
      },
      {
        role: 'user',
        content: `Prior analysis JSON:\n${context}\n\nConversation so far:\n${prior || '(none)'}\n\nFollow-up question: ${question}`,
      },
    ],
  });

  return (response || '').trim() || 'I could not generate a follow-up answer. Please consult a licensed lawyer.';
}

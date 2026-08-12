/**
 * Zod schema + citation whitelist for AI legal analysis output.
 */
import { z } from 'zod';
import { resolveCanonicalSpecialty } from '../utils/legalSpecialties.js';

export const legalCaseSchema = z.object({
  name: z.string().min(1),
  confidenceScore: z.number().min(0).max(100),
  explanation: z.string().min(1),
  applicableLaw: z.string().min(1),
  sourceLink: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),
  // Set by validateAndFilterAnalysis; the LLM never produces it.
  freshness: z.enum(['current', 'amended', 'stale']).optional(),
});

export const courtOutlookSchema = z.object({
  level: z.enum(['Weak', 'Moderate', 'Strong', 'Uncertain']),
  summary: z.string().min(1),
  factorsFor: z.array(z.string()).default([]),
  factorsAgainst: z.array(z.string()).default([]),
  missingFacts: z.array(z.string()).default([]),
});

export const legalAnalysisSchema = z.object({
  userConcernSummary: z.string().min(1),
  extractedKeywords: z.array(z.string()).max(12).default([]),
  possibleLegalCases: z.array(legalCaseSchema).min(0).max(3),
  penalties: z.string().default(''),
  courtWinOutlook: courtOutlookSchema,
  suggestedNextSteps: z.array(z.string()).min(1).max(8),
  recommendedAgency: z.string().optional().default(''),
  lawyerSpecialty: z.string().optional().default(''),
  matchSpecialty: z.string().optional().default(''),
  costBallpark: z.string().optional().default(''),
  systemDisclaimer: z.string().min(1),
});

const DISCLAIMER = 'This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney.';

const LOCALIZED_FALLBACKS = {
  en: {
    disclaimer: DISCLAIMER,
    penalties: 'Penalties depend on the exact facts and the final charges. Confirm with a licensed lawyer before taking action.',
    possibleIssue: 'Possible legal issue',
    moreFactsNeeded: 'Based on the legal references provided, this area may be relevant. More facts are needed.',
    specializedRules: 'This situation may involve specialized legal rules that are not fully covered in our verified library. To keep you safe and give you the best help, we recommend booking a short consultation with one of our licensed lawyers.',
    missingFacts: ['Specific dates', 'Parties involved', 'Documents or evidence available'],
    noReferences: 'We could not find verified legal references for this situation in our database. For your protection, we recommend speaking with a licensed attorney who can give you proper guidance.',
    nextSteps: [
      'Book a short consultation with one of our licensed lawyers on the platform for proper guidance.',
      'Gather any documents, messages, or receipts related to your situation.',
      'Visit your nearest barangay hall or Public Attorney\'s Office (PAO) for free legal aid.',
    ],
    staleReferences: 'The most relevant legal references in our database have been amended or repealed. We recommend confirming with a licensed lawyer before relying on this analysis.',
    consultLawyer: 'Consult a licensed attorney for next steps.',
    docPrep: 'Prepare supporting documents: valid ID, contracts or receipts, screenshots/messages, and any barangay or police records.'
  },
  tl: {
    disclaimer: 'Ang AI-assisted system na ito ay nagbigay lamang ng legal na gabay at rekomendasyon sa kaso. Hindi nito pinapalitan ang konsultasyon sa isang lisensyadong abogado.',
    penalties: 'Ang mga parusa ay nakadepende sa eksaktong mga katotohanan at sa huling sakdal. Kumpirmahin muna sa isang lisensyadong abogado bago kumilos.',
    possibleIssue: 'Posibleng legal na isyu',
    moreFactsNeeded: 'Batay sa mga ibinigay na legal na sanggunian, maaaring may kaugnayan ang bahaging ito. Kailangan ng mas maraming katotohanan.',
    specializedRules: 'Ang sitwasyong ito ay maaaring may kinalaman sa mga espesyal na legal na alituntunin na hindi ganap na sakop ng aming na-verify na library. Para sa iyong kaligtasan at upang mabigyan ka ng pinakamahusay na tulong, inirerekumenda namin ang pag-book ng maikling konsultasyon sa isa sa aming mga lisensyadong abogado.',
    missingFacts: ['Tiyak na mga petsa', 'Mga kasangkot na panig', 'Mga available na dokumento o ebidensya'],
    noReferences: 'Hindi kami makahanap ng mga na-verify na legal na sanggunian para sa sitwasyong ito sa aming database. Para sa iyong proteksyon, inirerekumenda namin na makipag-usap sa isang lisensyadong abogado na makakapagbigay sa iyo ng tamang gabay.',
    nextSteps: [
      'Mag-book ng maikling konsultasyon sa isa sa aming mga lisensyadong abogado sa platform para sa tamang gabay.',
      'Ipunin ang anumang mga dokumento, mensahe, o resibo na may kaugnayan sa iyong sitwasyon.',
      'Bisitahin ang iyong pinakamalapit na barangay hall o Public Attorney\'s Office (PAO) para sa libreng legal na tulong.',
    ],
    staleReferences: 'Ang pinaka-kaugnay na mga legal na sanggunian sa aming database ay nabago o napawalang-bisa na. Inirerekumenda namin na kumpirmahin ito sa isang lisensyadong abogado bago magtiwala sa pagsusuring ito.',
    consultLawyer: 'Kumonsulta sa isang lisensyadong abogado para sa mga susunod na hakbang.',
    docPrep: 'Maghanda ng mga sumusuportang dokumento: valid ID, mga kontrata o resibo, mga screenshot/mensahe, at anumang tala ng barangay o pulis.'
  },
  ceb: {
    disclaimer: 'Kini nga AI-assisted system naghatag lamang og legal nga giya ug mga rekomendasyon sa kaso. Dili kini kapuli sa konsultasyon sa usa ka lisensyadong abogado.',
    penalties: 'Ang mga parusa nagdepende sa eksaktong mga kamatuoran ug sa katapusang sumbong. Kumpirmaha una sa usa ka lisensyadong abogado sa dili pa molihok.',
    possibleIssue: 'Posibleng legal nga isyu',
    moreFactsNeeded: 'Base sa mga gihatag nga legal nga mga pakisayran, mahimong may kalabutan kini nga bahin. Gikinahanglan ang dugang nga mga detalye.',
    specializedRules: 'Kini nga sitwasyon mahimong naglakip sa mga espesyal nga legal nga lagda nga wala hingpit nga nasakup sa among na-verify nga library. Alang sa imong kaluwasan ug aron mahatagan ka sa labing kaayo nga tabang, among girekomenda nga mag-book og mubo nga konsultasyon sa usa sa among mga lisensyadong abogado.',
    missingFacts: ['Tino nga mga petsa', 'Mga nahilambigit nga partido', 'Mga magamit nga dokumento o ebidensya'],
    noReferences: 'Wala kami nakit-an nga na-verify nga mga legal nga pakisayran alang niini nga sitwasyon sa among database. Alang sa imong proteksyon, among girekomenda nga makigsulti sa usa ka lisensyadong abogado nga makahatag kanimo og saktong giya.',
    nextSteps: [
      'Mag-book og mubo nga konsultasyon sa usa sa among mga lisensyadong abogado sa platform para sa saktong giya.',
      'Tipuna ang bisan unsang mga dokumento, mensahe, o resibo nga adunay kalabutan sa imong sitwasyon.',
      'Bisitaha ang imong labing duol nga barangay hall o Public Attorney\'s Office (PAO) alang sa libre nga legal nga tabang.',
    ],
    staleReferences: 'Ang labing may kalabutan nga mga legal nga pakisayran sa among database nausab o nawad-an na sa gahum. Girekomenda namo nga kumpirmahon kini sa usa ka lisensyadong abogado sa dili pa mosalig niini nga pagtuki.',
    consultLawyer: 'Pakigtagbo sa usa ka lisensyadong abogado alang sa sunod nga mga lakbang.',
    docPrep: 'Pag-andam og mga sumusuportang dokumento: valid ID, mga kontrata o resibo, mga screenshot/mensahe, ug bisan unsang rekord sa barangay o pulis.'
  }
};

function normalizeName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function chunkMatchesCase(chunk, caseRow) {
  const n1 = normalizeName(chunk.name);
  const n2 = normalizeName(caseRow.applicableLaw) || normalizeName(caseRow.name);
  if (caseRow.sourceId && chunk.id === caseRow.sourceId) return true;
  return n1.includes(n2) || n2.includes(n1) || n1.length > 5 && n2.includes(n1.slice(0, 12));
}

/** Remedies, orders, and filing steps — not standalone case types. */
const PROCEDURAL_NAME_RE = /\b(bpo|tpo|protection\s+order|restraining\s+order|writ\s+of|petition\s+for|motion\s+for|application\s+for|permit\s+to|certificate\s+of|affidavit|notariz|summons|subpoena|appeal\s+of|reconsideration|demand\s+letter|barangay\s+complaint|kpaw|mediation\s+at)\b/i;

const PROCEDURAL_EXPLANATION_RE = /^\s*(the\s+user\s+can|you\s+can|they\s+can|citizen\s+can|file\s+for|apply\s+for|seek\s+a|obtain\s+a|request\s+a|go\s+to\s+the|visit\s+the|submit\s+a|pursue\s+a)/i;

const FILING_STEP_RE = /\b(file\s+for|apply\s+for|seek\s+(a|an)|obtain\s+(a|an)|request\s+(a|an)|then\s+(file|seek|apply)|barangay\s+level|family\s+court\s+to)\b/i;
const DOCUMENT_STEP_RE = /\b(document|documents|prepare|gather|collect|receipt|receipts|contract|contracts|screenshot|screenshots|id|ids|affidavit|affidavits|record|records|evidence|dokumento|paghahanda|ipunin|resibo|kontrata|ebidensya|pag-andam|tipuna|resibo|kontrata|ebidensya|affidabit)\b/i;

function normalizeLawKey(applicableLaw) {
  return (applicableLaw || '')
    .toLowerCase()
    .replace(/republic\s+act\s*(no\.?)?/gi, 'ra')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
}

/**
 * True when an entry describes a procedure/remedy rather than a case classification.
 */
export function isProceduralLegalEntry(caseRow) {
  const name = caseRow.name || '';
  const explanation = caseRow.explanation || '';
  const combined = `${name} ${explanation}`;

  if (PROCEDURAL_NAME_RE.test(name)) return true;
  if (PROCEDURAL_EXPLANATION_RE.test(explanation)) return true;
  if (FILING_STEP_RE.test(explanation) && !/\b(case|offense|crime|violation|liable|guilty)\b/i.test(name)) {
    return true;
  }
  if (/\b(order|petition|application|filing|remedy|relief)\s+(case|only)\b/i.test(name)) return true;
  if (/\bhow\s+to\s+(file|apply|seek)\b/i.test(combined)) return true;

  return false;
}

function caseToStepText(caseRow) {
  const label = caseRow.name.replace(/\s*case\s*$/i, '').trim();
  if (caseRow.explanation && FILING_STEP_RE.test(caseRow.explanation)) {
    const text = caseRow.explanation.trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return `Consider: ${label} — ${caseRow.explanation}`;
}

function dedupeSteps(steps) {
  const seen = new Set();
  return steps.filter((s) => {
    const key = normalizeName(s);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasDocumentPreparationStep(steps) {
  return (steps || []).some((s) => DOCUMENT_STEP_RE.test(s || ''));
}

function ensureDocumentPreparationStep(steps, targetLang = 'en') {
  const safeSteps = Array.isArray(steps) ? steps.filter(Boolean) : [];
  if (hasDocumentPreparationStep(safeSteps)) return safeSteps;
  const lang = LOCALIZED_FALLBACKS[targetLang] ? targetLang : 'en';
  return [
    ...safeSteps,
    LOCALIZED_FALLBACKS[lang].docPrep,
  ];
}

function rankCaseEntry(c) {
  return c.confidenceScore + (isProceduralLegalEntry(c) ? -1000 : 0);
}

function dedupeSameStatute(cases) {
  const byLaw = new Map();
  const noLawKey = [];
  const demoted = [];

  for (const c of cases) {
    const key = normalizeLawKey(c.applicableLaw);
    if (!key) {
      noLawKey.push(c);
      continue;
    }
    const prev = byLaw.get(key);
    if (!prev) {
      byLaw.set(key, c);
    } else if (rankCaseEntry(c) > rankCaseEntry(prev)) {
      demoted.push(prev);
      byLaw.set(key, c);
    } else {
      demoted.push(c);
    }
  }

  return { kept: [...byLaw.values(), ...noLawKey], demoted };
}

/**
 * Move remedy/procedure rows out of possibleLegalCases into suggestedNextSteps.
 */
export function separateCasesFromProceduralSteps(result, targetLang = 'en') {
  const demoted = [];
  let cases = [];

  for (const c of result.possibleLegalCases || []) {
    if (isProceduralLegalEntry(c)) demoted.push(c);
    else cases.push(c);
  }

  const { kept, demoted: statuteDupes } = dedupeSameStatute(cases);
  cases = kept;
  demoted.push(...statuteDupes);

  cases.sort((a, b) => b.confidenceScore - a.confidenceScore);

  const mergedSteps = dedupeSteps([
    ...demoted.map(caseToStepText),
    ...(result.suggestedNextSteps || []),
  ]);
  const ensuredSteps = ensureDocumentPreparationStep(mergedSteps, targetLang);
  const lang = LOCALIZED_FALLBACKS[targetLang] ? targetLang : 'en';

  return {
    ...result,
    possibleLegalCases: cases,
    suggestedNextSteps:
      ensuredSteps.length > 0
        ? ensuredSteps.slice(0, 8)
        : (result.suggestedNextSteps?.length ? result.suggestedNextSteps : [LOCALIZED_FALLBACKS[lang].consultLawyer]),
  };
}

/**
 * Filter cases to those grounded in retrieved chunks; cap at 3 (prefer top 2 unless 3rd within 85% confidence).
 *
 * Also flags freshness concerns:
 *   - if all grounding chunks are SUPERSEDED/REPEALED → emit a caution and
 *     downgrade outlook to Uncertain.
 *   - if a specific case is grounded only on a stale chunk → tag the case
 *     with `freshness: 'stale'` so the UI can show a warning chip.
 */
export function validateAndFilterAnalysis(raw, retrievedChunks, targetLang = 'en', category = '') {
  const parsed = legalAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid AI JSON: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  const lang = LOCALIZED_FALLBACKS[targetLang] ? targetLang : 'en';
  const local = LOCALIZED_FALLBACKS[lang];

  let result = parsed.data;
  if (!result.systemDisclaimer) result.systemDisclaimer = local.disclaimer;
  if (!result.penalties || !result.penalties.trim()) {
    result.penalties = local.penalties;
  }

  const allowed = retrievedChunks || [];
  const liveChunks = allowed.filter((ch) => {
    const s = ch.status || 'ACTIVE';
    return s !== 'SUPERSEDED' && s !== 'REPEALED';
  });
  const allStale = allowed.length > 0 && liveChunks.length === 0;

  let cases = result.possibleLegalCases.filter((c) =>
    allowed.some((ch) => chunkMatchesCase(ch, c)),
  );

  // Track whether the AI's output was stripped due to unverified/hallucinated citations
  let complexCase = false;
  let supersededWarning = false;

  if (cases.length === 0 && allowed.length > 0) {
    const ch = liveChunks[0] || allowed[0];
    cases = [{
      name: ch.name?.split(' ').slice(0, 4).join(' ') || local.possibleIssue,
      confidenceScore: 45,
      explanation: local.moreFactsNeeded,
      applicableLaw: ch.citation || ch.name,
      sourceLink: ch.source_url || null,
      sourceId: ch.id,
    }];
    result.courtWinOutlook = {
      level: 'Uncertain',
      summary: local.specializedRules,
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: local.missingFacts,
    };
    complexCase = true;
  } else if (cases.length === 0 && allowed.length === 0) {
    // No database matches at all — flag as complex
    complexCase = true;
    result.courtWinOutlook = {
      level: 'Uncertain',
      summary: local.noReferences,
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: local.missingFacts,
    };
    result.suggestedNextSteps = [...local.nextSteps];
  } else {
    cases = cases.map((c) => {
      // Prefer the freshest matching chunk; fall back to any match.
      const liveMatch = liveChunks.find((x) => chunkMatchesCase(x, c));
      const anyMatch = allowed.find((x) => chunkMatchesCase(x, c));
      const ch = liveMatch || anyMatch;
      const freshness = ch && ['SUPERSEDED', 'REPEALED'].includes(ch.status || 'ACTIVE')
        ? 'stale'
        : (ch?.status === 'AMENDED' ? 'amended' : 'current');
      if (freshness === 'stale') supersededWarning = true;
      return {
        ...c,
        sourceLink: c.sourceLink || ch?.source_url || null,
        sourceId: ch?.id || null,
        freshness,
      };
    });
  }

  // If literally everything we retrieved is superseded, downgrade confidence
  // and surface a hard warning before billing the citizen for a "full" result.
  if (allStale) {
    supersededWarning = true;
    complexCase = true;
    result.courtWinOutlook = {
      level: 'Uncertain',
      summary: local.staleReferences,
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: result.courtWinOutlook?.missingFacts || [],
    };
  }

  cases.sort((a, b) => b.confidenceScore - a.confidenceScore);
  if (cases.length > 2) {
    const third = cases[2];
    const second = cases[1];
    if (third.confidenceScore < second.confidenceScore * 0.85) {
      cases = cases.slice(0, 2);
    } else {
      cases = cases.slice(0, 3);
    }
  }

  result.possibleLegalCases = cases;
  if (!result.suggestedNextSteps || result.suggestedNextSteps.length === 0) {
    result.suggestedNextSteps = [local.consultLawyer];
  }
  result.suggestedNextSteps = ensureDocumentPreparationStep(result.suggestedNextSteps, targetLang).slice(0, 8);
  const match = resolveCanonicalSpecialty({
    category,
    matchSpecialty: result.matchSpecialty,
    lawyerSpecialty: result.lawyerSpecialty,
  });
  result.matchSpecialty = match || '';
  result._complexCase = complexCase;
  result._supersededWarning = supersededWarning;
  return separateCasesFromProceduralSteps(result, targetLang);
}

/** Map legacy v1-shaped results (old riskLevel / applicableLaws) for API consumers. */
export function normalizeLegacyAiResult(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.userConcernSummary && raw.courtWinOutlook) return raw;

  const risk = raw.riskLevel || 'Moderate';
  const levelMap = { Low: 'Weak', Moderate: 'Moderate', High: 'Strong' };
  const penalties =
    raw.penalties && String(raw.penalties).trim()
      ? raw.penalties
      : 'Penalties depend on the exact facts and charges. Confirm details with a licensed lawyer.';
  return {
    userConcernSummary: raw.summary || raw.caseClassification || '',
    extractedKeywords: [],
    possibleLegalCases: (raw.applicableLaws || []).slice(0, 3).map((law, i) => ({
      name: law.name,
      confidenceScore: 70 - i * 10,
      explanation: law.relevance || '',
      applicableLaw: law.citation || law.name,
      sourceLink: null,
    })),
    penalties,
    courtWinOutlook: {
      level: levelMap[risk] || 'Uncertain',
      summary: raw.summary || 'Legacy analysis — run a new analysis for updated format.',
      factorsFor: [],
      factorsAgainst: [],
      missingFacts: [],
    },
    suggestedNextSteps: raw.stepsToTake || [],
    recommendedAgency: '',
    lawyerSpecialty: raw.recommendedLawyerType || '',
    matchSpecialty: resolveCanonicalSpecialty({
      lawyerSpecialty: raw.recommendedLawyerType || '',
    }) || '',
    costBallpark: raw.estimatedCosts || '',
    systemDisclaimer: raw.disclaimer || DISCLAIMER,
    _legacy: true,
  };
}

/**
 * Ensure stored analysis payloads are citizen-readable even when generated by
 * older prompt/schema versions.
 */
export function hydrateCitizenGuidance(raw) {
  const normalized = normalizeLegacyAiResult(raw);
  if (!normalized || typeof normalized !== 'object') return normalized;

  // Detect language from stringified result content
  let lang = 'en';
  const text = JSON.stringify(normalized).toLowerCase();
  if (text.includes('abogado') || text.includes('kaso')) {
    if (text.includes('giya') || text.includes('girekomenda') || text.includes('pag-andam') || text.includes('dali nga')) {
      lang = 'ceb';
    } else {
      lang = 'tl';
    }
  }

  const local = LOCALIZED_FALLBACKS[lang];

  const penalties =
    normalized.penalties && String(normalized.penalties).trim()
      ? normalized.penalties
      : local.penalties;

  const rawSteps = Array.isArray(normalized.suggestedNextSteps)
    ? normalized.suggestedNextSteps.filter(Boolean)
    : [];
  const stepsWithDocs = ensureDocumentPreparationStep(rawSteps, lang);

  const possibleLegalCases = Array.isArray(normalized.possibleLegalCases)
    ? normalized.possibleLegalCases.map((c, idx) => ({
      ...c,
      confidenceScore: Number.isFinite(c?.confidenceScore)
        ? c.confidenceScore
        : Math.max(30, 70 - (idx * 10)),
    }))
    : [];

  return {
    ...normalized,
    penalties,
    possibleLegalCases,
    suggestedNextSteps: stepsWithDocs.slice(0, 8),
    matchSpecialty:
      resolveCanonicalSpecialty({
        matchSpecialty: normalized.matchSpecialty,
        lawyerSpecialty: normalized.lawyerSpecialty,
      }) || normalized.matchSpecialty || '',
  };
}

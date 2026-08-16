/**
 * Guest landing preview — preloaded corpus only (no live gov scrape).
 * Grounded hits return full case identification. Corpus misses return
 * requiresLogin so the citizen can Sign in (create an account) or Log in
 * for live search + history. This module does not write to the database.
 */
import { analyzeLegalCase } from './aiOrchestrator.js';

const DISCLAIMER =
  'This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney.';
const CASE_MATCH_MIN = 50;

function loginGate({ category }) {
  return {
    userConcernSummary: '',
    situationSummary: '',
    possibleLegalCases: [],
    suggestedNextSteps: [],
    penalties: '',
    outlookLevel: 'Uncertain',
    caseHint: '',
    matchSpecialty: category || 'General',
    disclaimer: DISCLAIMER,
    requiresLogin: true,
    requiresDeepSearch: true,
    isComplex: true,
  };
}

function filterCases(result) {
  return (Array.isArray(result.possibleLegalCases) ? result.possibleLegalCases : [])
    .filter((c) => Number(c.confidenceScore) >= CASE_MATCH_MIN)
    .slice(0, 3);
}

function mapFullResult(result, category) {
  const topCases = filterCases(result);
  const first = topCases[0];
  const outlook = result.courtWinOutlook || {};
  const analysis = {
    userConcernSummary: result.userConcernSummary || '',
    extractedKeywords: result.extractedKeywords || [],
    possibleLegalCases: topCases,
    penalties: result.penalties || '',
    courtWinOutlook: {
      level: outlook.level || 'Uncertain',
      summary: outlook.summary || result.userConcernSummary || '',
      factorsFor: outlook.factorsFor || [],
      factorsAgainst: outlook.factorsAgainst || [],
      missingFacts: outlook.missingFacts || [],
    },
    suggestedNextSteps: Array.isArray(result.suggestedNextSteps) ? result.suggestedNextSteps : [],
    recommendedAgency: result.recommendedAgency,
    lawyerSpecialty: result.lawyerSpecialty,
    matchSpecialty: result.matchSpecialty || category,
    costBallpark: result.costBallpark,
    possibleDeadline: result.possibleDeadline || '',
    cautions: Array.isArray(result.cautions) ? result.cautions : [],
    systemDisclaimer: result.systemDisclaimer || DISCLAIMER,
  };
  return {
    userConcernSummary: analysis.userConcernSummary,
    situationSummary: analysis.courtWinOutlook.summary,
    possibleLegalCases: topCases.map((c) => ({
      name: c.name,
      confidenceScore: c.confidenceScore,
      explanation: c.explanation,
      applicableLaw: c.applicableLaw,
    })),
    suggestedNextSteps: analysis.suggestedNextSteps,
    penalties: analysis.penalties,
    outlookLevel: analysis.courtWinOutlook.level,
    caseHint: (first?.name || result.matchSpecialty || category || '').toString().trim().slice(0, 80),
    matchSpecialty: analysis.matchSpecialty,
    lawyerSpecialty: analysis.lawyerSpecialty,
    recommendedAgency: analysis.recommendedAgency,
    costBallpark: analysis.costBallpark,
    possibleDeadline: analysis.possibleDeadline,
    cautions: analysis.cautions,
    factorsFor: analysis.courtWinOutlook.factorsFor,
    factorsAgainst: analysis.courtWinOutlook.factorsAgainst,
    missingFacts: analysis.courtWinOutlook.missingFacts,
    disclaimer: analysis.systemDisclaimer,
    requiresLogin: false,
    requiresDeepSearch: false,
    isComplex: false,
    analysis,
  };
}

/**
 * @param {{ description: string, category?: string }}
 */
export async function analyzeGuestPreview({ description, category } = {}) {
  const cat = !category || category === 'unsure' ? undefined : category;

  const { result, meta } = await analyzeLegalCase({
    category: cat || 'unsure',
    description,
    extractedText: null,
    isPremium: false,
    liveSearch: false,
    corpusOnly: true,
  });

  if (meta?.outcomeType === 'requires_login' || meta?.outcomeType === 'no_corpus') {
    return loginGate({ category: cat });
  }

  if (meta?.outcomeType === 'needs_detail') {
    return {
      needsMoreDetail: true,
      missingFacts: result.courtWinOutlook?.missingFacts || [],
      userConcernSummary: '',
      situationSummary: '',
      possibleLegalCases: [],
      suggestedNextSteps: [],
      penalties: '',
      outlookLevel: 'Uncertain',
      caseHint: '',
      disclaimer: DISCLAIMER,
      requiresLogin: false,
      requiresDeepSearch: false,
      isComplex: false,
    };
  }

  const mapped = mapFullResult(result, cat);
  if (!mapped.possibleLegalCases.length && meta?.outcomeType !== 'needs_detail') {
    return loginGate({ category: cat });
  }
  return mapped;
}

import type { GuestPreviewResult, LegalAnalysisResult } from '../services/api';
import { CASE_MATCH_MIN } from '../components/analysis/PreGuidanceResult';

const FALLBACK_DISCLAIMER =
  'This AI-assisted system provides legal guidance and case recommendations only. It does not replace consultation with a licensed attorney.';

export function guestPreviewToAnalysis(preview: GuestPreviewResult): LegalAnalysisResult {
  if (preview.analysis) {
    return {
      ...preview.analysis,
      possibleLegalCases: (preview.analysis.possibleLegalCases || []).filter(
        (c) => Number(c.confidenceScore) >= CASE_MATCH_MIN,
      ),
    };
  }

  const cases = (preview.possibleLegalCases || [])
    .filter((c) => Number(c.confidenceScore) >= CASE_MATCH_MIN)
    .slice(0, 3)
    .map((c) => ({
      name: c.name,
      confidenceScore: c.confidenceScore,
      explanation: c.explanation,
      applicableLaw: c.applicableLaw ?? '',
    }));

  return {
    userConcernSummary: preview.userConcernSummary || '',
    extractedKeywords: [],
    possibleLegalCases: cases,
    penalties: preview.penalties || '',
    courtWinOutlook: {
      level: preview.outlookLevel || 'Uncertain',
      summary: preview.situationSummary || preview.userConcernSummary || '',
      factorsFor: preview.factorsFor || [],
      factorsAgainst: preview.factorsAgainst || [],
      missingFacts: preview.missingFacts || [],
    },
    suggestedNextSteps: preview.suggestedNextSteps || [],
    recommendedAgency: preview.recommendedAgency,
    lawyerSpecialty: preview.lawyerSpecialty,
    matchSpecialty: preview.matchSpecialty,
    costBallpark: preview.costBallpark,
    possibleDeadline: preview.possibleDeadline,
    cautions: preview.cautions || [],
    systemDisclaimer: preview.disclaimer || FALLBACK_DISCLAIMER,
  };
}

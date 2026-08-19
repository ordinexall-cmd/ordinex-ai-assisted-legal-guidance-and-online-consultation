/**
 * Merge preloaded library guidance (from PH legal sources) with model extras.
 * Library fields are shown as-is. Model-only lines are "possible".
 */
function unique(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function norm(text) {
  return String(text || '').toLowerCase().replace(/^possible\s+/i, '').trim();
}

export function attachLibraryGuidance(result, chunks = []) {
  const libraryNextSteps = [];
  const libraryDocuments = [];
  const libraryCautions = [];
  let agency = result?.recommendedAgency || '';

  for (const chunk of chunks) {
    libraryNextSteps.push(...(chunk.suggestedNextSteps || []));
    libraryDocuments.push(...(chunk.documentsNeeded || []));
    libraryCautions.push(...(chunk.cautions || []));
    if (!agency && chunk.recommendedAgency) agency = chunk.recommendedAgency;
  }

  const libSteps = unique(libraryNextSteps);
  const libDocs = unique(libraryDocuments);
  const libCautions = unique(libraryCautions);
  const libKeys = new Set([...libSteps, ...libDocs, ...libCautions].map(norm));

  const possibleNextSteps = unique(result?.suggestedNextSteps).filter((s) => !libKeys.has(norm(s)));
  const possibleDocuments = unique(result?.courtWinOutlook?.missingFacts).filter((s) => !libKeys.has(norm(s)));
  const modelCautions = unique(result?.cautions).filter((s) => !libKeys.has(norm(s)));

  return {
    ...result,
    recommendedAgency: agency || result?.recommendedAgency,
    libraryNextSteps: libSteps,
    libraryDocuments: libDocs,
    libraryCautions: libCautions,
    possibleNextSteps,
    possibleDocuments,
    suggestedNextSteps: unique([...libSteps, ...possibleNextSteps]),
    cautions: unique([...libCautions, ...modelCautions]),
  };
}

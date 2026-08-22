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

function prefixPossible(items, lang = 'en') {
  const label = lang === 'tl' ? 'Posibleng hakbang: '
    : lang === 'ceb' ? 'Posibleng lakang: '
      : 'Possible next step: ';
  const docLabel = lang === 'tl' ? 'Posibleng dokumento: '
    : lang === 'ceb' ? 'Posibleng dokumento: '
      : 'Possible document: ';
  return (items || []).map((raw) => {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (/^possible\s+/i.test(text) || /^posibleng/i.test(text)) return text;
    if (/document|dokumento|id|certificate|sertipiko/i.test(text)) return `${docLabel}${text}`;
    return `${label}${text}`;
  }).filter(Boolean);
}

export function attachLibraryGuidance(result, chunks = [], lang = 'en') {
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

  const possibleNextSteps = prefixPossible(
    unique(result?.suggestedNextSteps).filter((s) => !libKeys.has(norm(s))),
    lang,
  );
  const possibleDocuments = prefixPossible(
    unique(result?.courtWinOutlook?.missingFacts).filter((s) => !libKeys.has(norm(s))),
    lang,
  );
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

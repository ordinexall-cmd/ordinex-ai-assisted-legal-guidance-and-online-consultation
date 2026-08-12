/**
 * Follow-up Q&A — Groq primary, OpenAI fallback.
 */
import { llmChat } from './llmClient.js';
import { normalizeLegacyAiResult } from './legalValidator.js';
import { detectLanguage } from './aiOrchestrator.js';

const FOLLOWUP_SYSTEM = `You are ORDINEX continuing a Philippine legal pre-guidance session.

RULES:
1. Answer the citizen's question DIRECTLY using the original analysis and conversation.
2. Give concrete steps, document lists, deadlines, or agency names when relevant.
3. Do NOT reply with only "consult a lawyer" — that may appear once at the end in one short sentence if needed.
4. Do not invent laws not mentioned in the original analysis.
5. This is not legal advice.
6. LANGUAGE LOCK: Respond ONLY in the RESPONSE_LANGUAGE given in the user message (English, Tagalog, or Cebuano). Match the NEW QUESTION's language — not a different dialect. Keep legal terms/citations in English/original.`;

export async function followUpWithGroq({ originalResult, history, question }) {
  const analysis = normalizeLegacyAiResult(
    typeof originalResult === 'string' ? JSON.parse(originalResult) : originalResult,
  );

  const detectedLang = await detectLanguage(question);
  const responseLanguage =
    detectedLang === 'tl' ? 'Tagalog' : detectedLang === 'ceb' ? 'Cebuano' : 'English';

  const context = `RESPONSE_LANGUAGE: ${responseLanguage} (code: ${detectedLang})
Respond ONLY in ${responseLanguage}.

ORIGINAL ANALYSIS:
${JSON.stringify(analysis, null, 2)}

PRIOR CHAT:
${history.map((h) => `${h.role}: ${h.content}`).join('\n')}

NEW QUESTION: ${question}`;

  return llmChat({
    jsonMode: false,
    maxTokens: 1500,
    temperature: 0.35,
    messages: [
      { role: 'system', content: FOLLOWUP_SYSTEM },
      { role: 'user', content: context },
    ],
  });
}

// ============================================================
// Ordinex — Consultation Routes
// AI case analysis, follow-up chat, and history.
// ============================================================
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter, guestPreviewLimiter } from '../middleware/rateLimiter.js';
import { analyzeLegalCase, followUpWithGroq } from '../services/aiOrchestrator.js';
import { analyzeGuestPreview } from '../services/guestPreview.js';
import { hydrateCitizenGuidance } from '../services/legalValidator.js';
import { extractTextFromBuffer } from '../services/docParser.js';
import { persistUploadedFile } from '../services/uploads.js';
import { createNotification } from '../services/notify.js';
import { validateLegalDocumentBuffer } from '../utils/validateUploadBuffer.js';
import { daysRemainingInTrash, trashCutoffDate, TRASH_RETENTION_DAYS } from '../services/recycleBin.js';
import { translateText, isTranslateAvailable, getTranslateLanguages } from '../services/groqTranslate.js';
import { checkUserDailyQuota } from '../services/llmClient.js';
import { nourishCorpusFromConsultation } from '../services/legalCorpus.js';
import { assessDescriptionFacts } from '../services/textPreprocess.js';

const router = Router();

function parseAnalysisMeta(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function serializeConsultationRow(c) {
  let aiResult = c.aiResult;
  try {
    aiResult = hydrateCitizenGuidance(JSON.parse(c.aiResult));
  } catch {
    // keep string if unparseable
  }
  let followUpHistory = [];
  if (c.followUpHistory) {
    try { followUpHistory = JSON.parse(c.followUpHistory); } catch {}
  }

  return {
    ...c,
    aiResult,
    analysisMeta: parseAnalysisMeta(c.analysisMeta),
    followUpHistory,
  };
}

// File upload config (10MB max, PDFs and DOCX only) — memory + Supabase/local via persistUploadedFile
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ======================== GUEST PREVIEW ========================
/**
 * POST /api/consultation/preview
 * Anonymous one-sentence teaser for landing (no auth, no DB write).
 */
router.post('/preview', guestPreviewLimiter, async (req, res, next) => {
  try {
    const { category, description } = req.body;
    if (!description || description.trim().length < 40) {
      return res.status(400).json({
        error: 'Please provide a detailed description (at least 40 characters).',
      });
    }
    if (description.trim().length > 2000) {
      return res.status(400).json({
        error: 'Please keep your description within 2000 characters.',
      });
    }

    const facts = assessDescriptionFacts(description);
    if (!facts.ready) {
      return res.json({
        needsMoreDetail: true,
        missingFacts: facts.missing.map((m) => m.label),
        userConcernSummary: '',
        situationSummary: '',
        possibleLegalCases: [],
        suggestedNextSteps: [],
        penalties: '',
        outlookLevel: 'Uncertain',
        caseHint: '',
        disclaimer: '',
        requiresLogin: false,
      });
    }

    const quotaId = `ip:${req.ip || req.socket?.remoteAddress || 'anon'}`;
    const quota = checkUserDailyQuota(quotaId);
    if (!quota.allowed) {
      return res.status(429).json({
        error: quota.message,
        quotaExceeded: true,
        trialsRemaining: 0,
      });
    }

    const preview = await analyzeGuestPreview({
      category: category || 'unsure',
      description,
    });

    res.json({
      ...preview,
      trialsRemaining: quota.remaining,
      quotaWarning: quota.warning ? quota.message : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== ANALYZE ========================
/**
 * POST /api/consultation/analyze
 * Submit a legal case for AI analysis.
 */
router.post('/analyze', requireAuth, aiLimiter, upload.single('document'), async (req, res, next) => {
  try {
    const { category, description } = req.body;
    const user = req.user;

    if (!description || description.trim().length < 40) {
      return res.status(400).json({
        error: 'Please provide a detailed description (at least 40 characters).',
      });
    }
    if (description.trim().length > 2000) {
      return res.status(400).json({
        error: 'Please keep your description within 2000 characters.',
      });
    }

    const facts = assessDescriptionFacts(description);
    if (!facts.ready) {
      return res.json({
        needsMoreDetail: true,
        missingFacts: facts.missing.map((m) => m.label),
        message: 'Add more detail for a full analysis. No trial was used.',
        consultation: null,
        meta: {
          outcomeType: 'needs_detail',
          providersUsed: ['rules'],
          corpusSource: 'none',
          usedMock: false,
          trialsCharged: false,
        },
      });
    }

    const quota = checkUserDailyQuota(user.id);
    if (!quota.allowed) {
      return res.status(429).json({
        error: quota.message,
        quotaExceeded: true,
        trialsRemaining: 0,
      });
    }

    // Persist document (local /uploads or Supabase when configured), then parse from memory.
    let extractedText = null;
    let fileUrl = null;
    if (req.file) {
      const check = validateLegalDocumentBuffer(req.file.buffer, req.file.mimetype);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      fileUrl = await persistUploadedFile(req.file, 'consultations');
      extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
    }

    const { result: aiResult, meta } = await analyzeLegalCase({
      category: category || 'unsure',
      description,
      extractedText,
      isPremium: true,
      liveSearch: true,
      corpusOnly: false,
    });

    const outcomeType = meta.outcomeType || 'full';

    if (outcomeType === 'needs_detail') {
      return res.json({
        needsMoreDetail: true,
        missingFacts: aiResult?.courtWinOutlook?.missingFacts || [],
        message: 'Add more detail for a full analysis. No trial was used.',
        consultation: null,
        meta: { ...meta, trialsCharged: false },
      });
    }

    const consultation = await prisma.consultation.create({
      data: {
        userId: user.id,
        category: category || 'General',
        description,
        fileUrl,
        extractedText,
        aiResult: JSON.stringify(aiResult),
        analysisMeta: meta ? JSON.stringify(meta) : null,
        isFree: true,
        trialsCharged: false,
      },
    });

    if (outcomeType === 'full') {
      createNotification({
        userId: user.id,
        title: 'Case identification ready',
        message: 'Your case identification is ready.',
        type: 'AI_READY',
        linkTo: `/ai-analysis?id=${consultation.id}`,
      }).catch(() => {});
    } else {
      createNotification({
        userId: user.id,
        title: 'More detail needed',
        message: outcomeType === 'no_corpus'
          ? 'Add more facts or try again later — no trial was used.'
          : 'Add more specific facts for a full analysis — no trial was used.',
        type: 'AI_NEEDS_DETAIL',
        linkTo: `/ai-analysis?id=${consultation.id}`,
      }).catch(() => {});
    }
    // Asynchronously nourish legal knowledge base with validated case keywords
    nourishCorpusFromConsultation({
      category: category || 'General',
      liveChunks: meta?.liveChunks || [],
      keywords: aiResult?.extractedKeywords || [],
    }).catch(() => {});

    const responseMessage =
      outcomeType === 'full'
        ? 'Identification complete.'
        : outcomeType === 'no_corpus'
          ? 'Legal database unavailable. No trial was used — try again later.'
          : 'Add more detail for a full analysis. No trial was used.';

    res.status(201).json({
      message: responseMessage,
      consultation: serializeConsultationRow(consultation),
      meta: { ...meta, trialsCharged: false },
      trialsRemaining: quota.remaining,
      quotaWarning: quota.warning ? quota.message : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== FOLLOW-UP ========================
/**
 * POST /api/consultation/:id/followup
 * Logged-in citizens: up to 20 follow-ups per analysis.
 */
router.post('/:id/followup', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question } = req.body;

    if (!question || question.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a question (at least 5 characters).' });
    }

    const consultation = await prisma.consultation.findUnique({ where: { id } });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (consultation.deletedAt) return res.status(404).json({ error: 'Consultation not found.' });

    let history = [];
    if (consultation.followUpHistory) {
      try { history = JSON.parse(consultation.followUpHistory); } catch {}
    }

    const aiResponse = await followUpWithGroq({
      originalResult: JSON.parse(consultation.aiResult),
      history,
      question,
    });

    history.push({ role: 'user', content: question }, { role: 'assistant', content: aiResponse });

    await prisma.consultation.update({
      where: { id },
      data: { followUpHistory: JSON.stringify(history), followUpCount: { increment: 1 } },
    });

    res.json({
      answer: aiResponse,
      followUpCount: consultation.followUpCount + 1,
      followUpsRemaining: null,
      followUpLimit: null,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== TRANSLATE LANGUAGES ========================
/**
 * GET /api/consultation/translate/languages
 */
router.get('/translate/languages', requireAuth, async (_req, res) => {
  res.json({
    languages: getTranslateLanguages(),
    available: isTranslateAvailable(),
  });
});

// ======================== HISTORY ========================
/**
 * GET /api/consultation/history?page=&limit=&q=
 * User's past consultations (paginated).
 * Optional ?q= performs a case-insensitive substring search across
 * title, category, and description.
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const q = (req.query.q || '').trim();

    const where = { userId: req.user.id, deletedAt: null };
    if (q) {
      // SQLite ignores `mode: 'insensitive'`, so we lowercase manually.
      // For Postgres (prod) the same query still works correctly.
      where.OR = [
        { title: { contains: q } },
        { category: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, title: true, category: true, description: true, aiResult: true,
          analysisMeta: true, followUpCount: true, isFree: true, trialsCharged: true, createdAt: true,
        },
      }),
      prisma.consultation.count({ where }),
    ]);

    const parsed = consultations.map((c) => serializeConsultationRow(c));

    res.json({
      consultations: parsed,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ======================== TRASH ========================
/**
 * GET /api/consultation/trash
 * Soft-deleted analyses still within the retention window.
 */
router.get('/trash', requireAuth, async (req, res, next) => {
  try {
    const cutoff = trashCutoffDate();
    const consultations = await prisma.consultation.findMany({
      where: {
        userId: req.user.id,
        deletedAt: { not: null, gte: cutoff },
      },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    res.json({
      items: consultations.map((c) => ({
        ...c,
        daysRemaining: daysRemainingInTrash(c.deletedAt),
      })),
      retentionDays: TRASH_RETENTION_DAYS,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== SINGLE ========================
/**
 * GET /api/consultation/:id
 * Get a single consultation with full details.
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (consultation.deletedAt) return res.status(404).json({ error: 'Consultation not found.' });
    if (consultation.deletedAt) return res.status(404).json({ error: 'Consultation not found.' });

    res.json({ consultation: serializeConsultationRow(consultation) });
  } catch (error) {
    next(error);
  }
});

// ======================== RENAME ========================
/**
 * PATCH /api/consultation/:id
 * Rename a consultation (update title).
 */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || title.trim().length < 1) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (consultation.deletedAt) return res.status(404).json({ error: 'Consultation not found.' });

    const updated = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { title: title.trim() },
    });

    res.json({ message: 'Consultation renamed.', consultation: { id: updated.id, title: updated.title } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/consultation/:id/restore
 */
router.post('/:id/restore', requireAuth, async (req, res, next) => {
  try {
    const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
    if (!consultation) return res.status(404).json({ error: 'Not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (!consultation.deletedAt) {
      return res.json({ message: 'Already active.' });
    }
    if (consultation.deletedAt < trashCutoffDate()) {
      return res.status(410).json({ error: 'This item can no longer be restored.' });
    }

    await prisma.consultation.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
    });
    res.json({ message: 'Analysis restored.' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/consultation/:id/permanent
 */
router.delete('/:id/permanent', requireAuth, async (req, res, next) => {
  try {
    const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
    if (!consultation) return res.status(404).json({ error: 'Not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (!consultation.deletedAt) {
      return res.status(400).json({ error: 'Move to Recycle Bin before permanent deletion.' });
    }

    await prisma.consultation.delete({ where: { id: req.params.id } });
    res.json({ message: 'Analysis permanently deleted.' });
  } catch (error) {
    next(error);
  }
});

// ======================== DELETE (soft) ========================
/**
 * DELETE /api/consultation/:id
 * Move an AI analysis to the Recycle Bin.
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });

    await prisma.consultation.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({
      message: 'Moved to Recycle Bin.',
      retentionDays: TRASH_RETENTION_DAYS,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== ANALYSIS TRANSLATION ========================
/**
 * POST /api/consultation/:id/translate
 * Body: { targetLang, sourceLang? }
 * Translates the key fields of an AI analysis result.
 */
router.post('/:id/translate', requireAuth, async (req, res, next) => {
  try {
    const consultation = await prisma.consultation.findUnique({ where: { id: req.params.id } });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });
    if (consultation.userId !== req.user.id) return res.status(403).json({ error: 'Access denied.' });
    if (consultation.deletedAt) return res.status(404).json({ error: 'Consultation not found.' });

    const { targetLang, sourceLang } = req.body;
    if (!targetLang) return res.status(400).json({ error: 'targetLang is required.' });

    let aiResult;
    try {
      aiResult = hydrateCitizenGuidance(JSON.parse(consultation.aiResult));
    } catch {
      return res.status(500).json({ error: 'Could not parse analysis result.' });
    }

    // Translate key user-facing fields
    const [summary, penalties, outlookSummary, ...caseExplanations] = await Promise.all([
      translateText(aiResult.userConcernSummary || '', targetLang, sourceLang),
      translateText(aiResult.penalties || '', targetLang, sourceLang),
      translateText(aiResult.courtWinOutlook?.summary || '', targetLang, sourceLang),
      ...(aiResult.possibleLegalCases || []).map((lc) =>
        translateText(lc.explanation || '', targetLang, sourceLang),
      ),
    ]);

    const translatedSteps = await Promise.all(
      (aiResult.suggestedNextSteps || []).map((s) => translateText(s, targetLang, sourceLang)),
    );

    res.json({
      targetLang,
      translated: {
        userConcernSummary: summary,
        penalties,
        courtWinOutlookSummary: outlookSummary,
        possibleLegalCases: (aiResult.possibleLegalCases || []).map((lc, i) => ({
          name: lc.name,
          explanation: caseExplanations[i] || lc.explanation,
        })),
        suggestedNextSteps: translatedSteps,
      },
    });
  } catch (error) {
    if (error.code === 'TRANSLATE_NOT_CONFIGURED') {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
});

export default router;

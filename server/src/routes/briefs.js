import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCitizen, requireCitizenVerified, requireLawyer, requireLawyerVerified } from '../middleware/premium.js';
import { createNotification } from '../services/notify.js';
import { normalizeLegacyAiResult } from '../services/legalValidator.js';

const router = Router();
const MAX_SUMMARY = 280;
const OFFER_LIMIT_PER_DAY = 5;

function publicDisplayName(brief) {
  if (brief.anonymous) return 'Anonymous';
  return brief.displayName || brief.user?.firstName || (brief.user?.name || 'Citizen').split(' ')[0];
}

function serializePublicBrief(brief, lawyerId) {
  const mine = lawyerId
    ? brief.inquiries?.find((i) => i.lawyerId === lawyerId)
    : null;
  return {
    id: brief.id,
    category: brief.category,
    summary: brief.summary,
    consultationId: brief.consultationId || null,
    hasLinkedAnalysis: Boolean(brief.consultationId),
    analysisTitle: brief.linkedAnalysisTitle || null,
    budgetMin: brief.budgetMin,
    budgetMax: brief.budgetMax,
    city: brief.city,
    province: brief.province,
    displayName: publicDisplayName(brief),
    createdAt: brief.createdAt,
    myOfferStatus: mine?.status || null,
  };
}

function serializeMine(brief) {
  const viewers = (brief.views || []).map((v) => ({
    lawyerId: v.lawyerId,
    name: v.lawyer?.name || 'Lawyer',
    viewedAt: v.viewedAt,
  }));
  return {
    id: brief.id,
    category: brief.category,
    summary: brief.summary,
    consultationId: brief.consultationId || null,
    analysisTitle: brief.linkedAnalysisTitle || null,
    budgetMin: brief.budgetMin,
    budgetMax: brief.budgetMax,
    city: brief.city,
    province: brief.province,
    displayName: brief.displayName,
    anonymous: brief.anonymous,
    status: brief.status,
    createdAt: brief.createdAt,
    updatedAt: brief.updatedAt,
    viewCount: viewers.length,
    viewers,
  };
}

async function loadMineBrief(userId) {
  const brief = await prisma.caseBrief.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      views: {
        orderBy: { viewedAt: 'desc' },
        include: { lawyer: { select: { id: true, name: true } } },
      },
    },
  });
  if (!brief) return null;
  return attachAnalysisLabel(brief, userId);
}

async function resolveAnalysisTitle(consultationId, userId) {
  if (!consultationId) return null;
  const c = await prisma.consultation.findFirst({
    where: { id: consultationId, userId, deletedAt: null },
    select: { title: true, category: true, description: true, aiResult: true },
  });
  if (!c) return null;
  if (c.title?.trim()) return c.title.trim();
  try {
    const ai = typeof c.aiResult === 'string' ? JSON.parse(c.aiResult) : c.aiResult;
    if (ai?.possibleLegalCases?.[0]?.name) return ai.possibleLegalCases[0].name;
    if (ai?.userConcernSummary) return String(ai.userConcernSummary).slice(0, 48);
  } catch { /* ignore */ }
  return c.category || 'Case identification';
}

async function attachAnalysisLabel(brief, userId) {
  if (!brief?.consultationId) return brief;
  const linkedAnalysisTitle = await resolveAnalysisTitle(brief.consultationId, userId || brief.userId);
  return { ...brief, linkedAnalysisTitle };
}

function serializeLinkedAnalysis(c) {
  let aiResult = c.aiResult;
  try {
    aiResult = normalizeLegacyAiResult(JSON.parse(c.aiResult));
  } catch {
    // keep raw if unparseable
  }
  let analysisMeta = null;
  if (c.analysisMeta) {
    try {
      analysisMeta = JSON.parse(c.analysisMeta);
    } catch {
      analysisMeta = null;
    }
  }
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    description: c.description,
    fileUrl: c.fileUrl || null,
    aiResult,
    analysisMeta,
    createdAt: c.createdAt,
  };
}

router.get('/mine', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const labeled = await loadMineBrief(req.user.id);
    res.json({ brief: labeled ? serializeMine(labeled) : null });
  } catch (e) {
    next(e);
  }
});

router.put('/mine', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const category = String(req.body.category || '').trim();
    const summary = String(req.body.summary || '').trim();
    const anonymous = Boolean(req.body.anonymous);
    const consultationIdRaw = req.body.consultationId != null ? String(req.body.consultationId).trim() : '';
    if (!category || summary.length < 20) {
      return res.status(400).json({ error: 'Add a category and at least 20 characters describing what you need.' });
    }
    if (summary.length > MAX_SUMMARY) {
      return res.status(400).json({ error: `Keep the description under ${MAX_SUMMARY} characters.` });
    }

    let consultationId = null;
    if (consultationIdRaw) {
      const owned = await prisma.consultation.findFirst({
        where: { id: consultationIdRaw, userId: req.user.id, deletedAt: null },
        select: { id: true },
      });
      if (!owned) {
        return res.status(400).json({ error: 'Linked case analysis not found.' });
      }
      consultationId = owned.id;
    }

    const budgetMin = req.body.budgetMin != null && req.body.budgetMin !== '' ? Number(req.body.budgetMin) : null;
    const budgetMax = req.body.budgetMax != null && req.body.budgetMax !== '' ? Number(req.body.budgetMax) : null;
    const displayName = anonymous
      ? 'Anonymous'
      : (req.user.firstName || String(req.user.name || 'Citizen').split(' ')[0]);

    const data = {
      category,
      summary,
      consultationId,
      budgetMin: Number.isFinite(budgetMin) ? budgetMin : null,
      budgetMax: Number.isFinite(budgetMax) ? budgetMax : null,
      city: req.user.city || null,
      province: req.user.province || null,
      displayName,
      anonymous,
      status: 'OPEN',
    };

    const existing = await prisma.caseBrief.findFirst({ where: { userId: req.user.id } });
    await (existing
      ? prisma.caseBrief.update({ where: { id: existing.id }, data })
      : prisma.caseBrief.create({ data: { ...data, userId: req.user.id } }));

    const labeled = await loadMineBrief(req.user.id);
    res.json({ brief: labeled ? serializeMine(labeled) : null });
  } catch (e) {
    next(e);
  }
});

router.post('/mine/close', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const existing = await prisma.caseBrief.findFirst({ where: { userId: req.user.id, status: 'OPEN' } });
    if (!existing) return res.json({ brief: null });
    await prisma.caseBrief.update({
      where: { id: existing.id },
      data: { status: 'CLOSED' },
    });
    const labeled = await loadMineBrief(req.user.id);
    res.json({ brief: labeled ? serializeMine(labeled) : null });
  } catch (e) {
    next(e);
  }
});

router.get('/inquiries', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const brief = await prisma.caseBrief.findFirst({ where: { userId: req.user.id } });
    if (!brief) return res.json({ inquiries: [] });
    const inquiries = await prisma.briefInquiry.findMany({
      where: { briefId: brief.id },
      orderBy: { createdAt: 'desc' },
      include: {
        lawyer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            specializations: true,
            consultationFeeMin: true,
            consultationFee: true,
          },
        },
      },
    });
    res.json({
      inquiries: inquiries.map((i) => ({
        id: i.id,
        message: i.message,
        status: i.status,
        createdAt: i.createdAt,
        lawyer: {
          id: i.lawyer.id,
          name: i.lawyer.name,
          avatarUrl: i.lawyer.avatarUrl,
          specializations: i.lawyer.specializations,
          fee: i.lawyer.consultationFeeMin ?? i.lawyer.consultationFee,
        },
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/inquiries/:id/accept', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const inquiry = await prisma.briefInquiry.findUnique({
      where: { id: req.params.id },
      include: { brief: true, lawyer: { select: { id: true, name: true } } },
    });
    if (!inquiry || inquiry.brief.userId !== req.user.id) {
      return res.status(404).json({ error: 'Offer not found.' });
    }
    if (inquiry.status !== 'PENDING') {
      return res.status(400).json({ error: 'This offer is no longer pending.' });
    }
    await prisma.briefInquiry.update({
      where: { id: inquiry.id },
      data: { status: 'ACCEPTED' },
    });
    createNotification({
      userId: inquiry.lawyerId,
      title: 'Consult offer accepted',
      message: `${publicDisplayName(inquiry.brief)} accepted your offer. They can book a slot with you.`,
      type: 'BRIEF_OFFER_ACCEPTED',
      linkTo: '/lawyer/dashboard#offers',
    }).catch(() => {});
    res.json({ lawyerId: inquiry.lawyerId });
  } catch (e) {
    next(e);
  }
});

router.post('/inquiries/:id/decline', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const inquiry = await prisma.briefInquiry.findUnique({
      where: { id: req.params.id },
      include: { brief: true },
    });
    if (!inquiry || inquiry.brief.userId !== req.user.id) {
      return res.status(404).json({ error: 'Offer not found.' });
    }
    await prisma.briefInquiry.update({
      where: { id: inquiry.id },
      data: { status: 'DECLINED' },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/my-offers', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const inquiries = await prisma.briefInquiry.findMany({
      where: { lawyerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        brief: {
          select: {
            id: true,
            category: true,
            summary: true,
            status: true,
            displayName: true,
            anonymous: true,
            city: true,
            province: true,
            consultationId: true,
            user: { select: { name: true, firstName: true } },
          },
        },
      },
    });
    res.json({
      offers: inquiries.map((i) => ({
        id: i.id,
        status: i.status,
        message: i.message,
        createdAt: i.createdAt,
        brief: {
          id: i.brief.id,
          category: i.brief.category,
          summary: i.brief.summary,
          status: i.brief.status,
          displayName: publicDisplayName(i.brief),
          city: i.brief.city,
          province: i.brief.province,
          consultationId: i.brief.consultationId,
        },
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const where = { status: 'OPEN' };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { summary: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { province: { contains: search, mode: 'insensitive' } },
      ];
    }
    const briefs = await prisma.caseBrief.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, firstName: true } },
        inquiries: { where: { lawyerId: req.user.id }, select: { lawyerId: true, status: true } },
      },
    });
    const labeled = await Promise.all(
      briefs.map(async (b) => attachAnalysisLabel(b, b.userId)),
    );

    // Record unique lawyer views (first-seen timestamp kept).
    if (briefs.length > 0) {
      await Promise.all(
        briefs.map((b) =>
          prisma.briefView.upsert({
            where: { briefId_lawyerId: { briefId: b.id, lawyerId: req.user.id } },
            create: { briefId: b.id, lawyerId: req.user.id },
            update: {},
          }).catch(() => null),
        ),
      );
    }

    res.json({ briefs: labeled.map((b) => serializePublicBrief(b, req.user.id)) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const brief = await prisma.caseBrief.findFirst({
      where: { id: req.params.id, status: 'OPEN' },
      include: {
        user: { select: { id: true, name: true, firstName: true, avatarUrl: true } },
        inquiries: { where: { lawyerId: req.user.id }, select: { lawyerId: true, status: true } },
      },
    });
    if (!brief) {
      return res.status(404).json({ error: 'This request is no longer open.' });
    }

    const labeled = await attachAnalysisLabel(brief, brief.userId);

    await prisma.briefView.upsert({
      where: { briefId_lawyerId: { briefId: brief.id, lawyerId: req.user.id } },
      create: { briefId: brief.id, lawyerId: req.user.id },
      update: {},
    }).catch(() => null);

    let analysis = null;
    if (brief.consultationId) {
      const c = await prisma.consultation.findFirst({
        where: { id: brief.consultationId, userId: brief.userId, deletedAt: null },
      });
      if (c) analysis = serializeLinkedAnalysis(c);
    }

    const displayName = publicDisplayName(labeled);
    res.json({
      brief: serializePublicBrief(labeled, req.user.id),
      citizen: {
        displayName,
        avatarUrl: brief.anonymous ? null : (brief.user?.avatarUrl || null),
      },
      analysis,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/offer', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const brief = await prisma.caseBrief.findUnique({ where: { id: req.params.id } });
    if (!brief || brief.status !== 'OPEN') {
      return res.status(404).json({ error: 'This request is no longer open.' });
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayCount = await prisma.briefInquiry.count({
      where: { lawyerId: req.user.id, createdAt: { gte: start } },
    });
    if (todayCount >= OFFER_LIMIT_PER_DAY) {
      return res.status(429).json({ error: `You can send up to ${OFFER_LIMIT_PER_DAY} offers per day.` });
    }
    const message = String(req.body.message || '').trim().slice(0, 200) || null;
    try {
      const inquiry = await prisma.briefInquiry.create({
        data: {
          briefId: brief.id,
          lawyerId: req.user.id,
          message,
          status: 'PENDING',
        },
      });
      createNotification({
        userId: brief.userId,
        title: 'Consult offer',
        message: `${req.user.name} offered a consultation on your open request.`,
        type: 'BRIEF_OFFER',
        linkTo: '/dashboard#consult-offers',
      }).catch(() => {});
      res.status(201).json({ inquiry: { id: inquiry.id, status: inquiry.status } });
    } catch (err) {
      if (String(err?.code) === 'P2002') {
        return res.status(409).json({ error: 'You already sent an offer on this request.' });
      }
      throw err;
    }
  } catch (e) {
    next(e);
  }
});

export default router;

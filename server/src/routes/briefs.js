import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCitizen, requireCitizenVerified, requireLawyer, requireLawyerVerified } from '../middleware/premium.js';
import { createNotification } from '../services/notify.js';

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
  return {
    id: brief.id,
    category: brief.category,
    summary: brief.summary,
    budgetMin: brief.budgetMin,
    budgetMax: brief.budgetMax,
    city: brief.city,
    province: brief.province,
    displayName: brief.displayName,
    anonymous: brief.anonymous,
    status: brief.status,
    createdAt: brief.createdAt,
  };
}

router.get('/mine', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const brief = await prisma.caseBrief.findFirst({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ brief: brief ? serializeMine(brief) : null });
  } catch (e) {
    next(e);
  }
});

router.put('/mine', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const category = String(req.body.category || '').trim();
    const summary = String(req.body.summary || '').trim();
    const anonymous = Boolean(req.body.anonymous);
    if (!category || summary.length < 20) {
      return res.status(400).json({ error: 'Add a category and at least 20 characters describing what you need.' });
    }
    if (summary.length > MAX_SUMMARY) {
      return res.status(400).json({ error: `Keep the description under ${MAX_SUMMARY} characters.` });
    }
    const budgetMin = req.body.budgetMin != null && req.body.budgetMin !== '' ? Number(req.body.budgetMin) : null;
    const budgetMax = req.body.budgetMax != null && req.body.budgetMax !== '' ? Number(req.body.budgetMax) : null;
    const displayName = anonymous
      ? 'Anonymous'
      : (req.user.firstName || String(req.user.name || 'Citizen').split(' ')[0]);

    const data = {
      category,
      summary,
      budgetMin: Number.isFinite(budgetMin) ? budgetMin : null,
      budgetMax: Number.isFinite(budgetMax) ? budgetMax : null,
      city: req.user.city || null,
      province: req.user.province || null,
      displayName,
      anonymous,
      status: 'OPEN',
    };

    const existing = await prisma.caseBrief.findFirst({ where: { userId: req.user.id } });
    const brief = existing
      ? await prisma.caseBrief.update({ where: { id: existing.id }, data })
      : await prisma.caseBrief.create({ data: { ...data, userId: req.user.id } });

    res.json({ brief: serializeMine(brief) });
  } catch (e) {
    next(e);
  }
});

router.post('/mine/close', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const existing = await prisma.caseBrief.findFirst({ where: { userId: req.user.id, status: 'OPEN' } });
    if (!existing) return res.json({ brief: null });
    const brief = await prisma.caseBrief.update({
      where: { id: existing.id },
      data: { status: 'CLOSED' },
    });
    res.json({ brief: serializeMine(brief) });
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
      linkTo: '/lawyer/dashboard',
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
    res.json({ briefs: briefs.map((b) => serializePublicBrief(b, req.user.id)) });
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
        linkTo: '/dashboard',
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

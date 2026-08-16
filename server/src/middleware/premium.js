// ============================================================
// Ordinex — Role Middleware
// Role checks for lawyer-only and citizen-only endpoints.
// ============================================================

/**
 * Middleware: Requires the authenticated user to be a LAWYER role.
 * Must be used AFTER requireAuth middleware.
 */
export function requireLawyer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'LAWYER') {
    return res.status(403).json({ error: 'This action is restricted to lawyers.' });
  }

  next();
}

/**
 * Middleware: Requires the authenticated user to be a CITIZEN role.
 * Must be used AFTER requireAuth middleware.
 */
export function requireCitizen(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'CITIZEN') {
    return res.status(403).json({ error: 'This action is restricted to citizens.' });
  }

  next();
}

/**
 * Middleware: Requires a verified citizen account (ID + profile complete).
 * Must be used AFTER requireAuth + requireCitizen.
 */
export function requireCitizenVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'CITIZEN') {
    return res.status(403).json({ error: 'This action is restricted to citizens.' });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      error: 'Complete identity verification in Account Settings before using this feature.',
      code: 'CITIZEN_VERIFICATION_REQUIRED',
    });
  }

  next();
}

/**
 * Middleware: Requires a verified lawyer (KYC passed).
 * Must be used AFTER requireAuth. Practice tools only — not session/settings.
 */
export function requireLawyerVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'LAWYER') {
    return res.status(403).json({ error: 'This action is restricted to lawyers.' });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      error: 'Complete identity verification in Account Settings before using this feature.',
      code: 'LAWYER_VERIFICATION_REQUIRED',
    });
  }

  next();
}

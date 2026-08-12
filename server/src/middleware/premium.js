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

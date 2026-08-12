// ============================================================
// Ordinex — Global Error Handler
// Catches all unhandled errors and returns consistent JSON responses.
// ============================================================
import { env } from '../config/env.js';
import { toUserFacingError } from '../utils/userFacingError.js';

/**
 * Express error-handling middleware.
 * Must be registered LAST with app.use(errorHandler).
 */
export function errorHandler(err, req, res, _next) {
  // Log full error in dev
  if (env.isDev) {
    console.error('═══ ERROR ═══');
    console.error(`${req.method} ${req.path}`);
    console.error(err.stack || err);
    console.error('═════════════');
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum size is 10MB.',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field.',
    });
  }

  // Prisma known errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return res.status(409).json({
      error: `A record with this ${field} already exists.`,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found.',
    });
  }

  if (err.code === 'P2003') {
    return res.status(409).json({
      error: 'This slot is still tied to a booking record and cannot be removed yet.',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: toUserFacingError(err, 'Please check your input and try again.'),
    });
  }

  const statusCode = err.statusCode || 500;
  const fallback =
    statusCode === 401
      ? 'Invalid email or password.'
      : statusCode === 403
        ? 'You do not have access to do that.'
        : statusCode === 404
          ? 'We could not find that.'
          : 'Something went wrong. Please try again.';

  res.status(statusCode).json({
    error: toUserFacingError(err, fallback),
  });
}

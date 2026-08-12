// ============================================================
// Ordinex — Transactional email (console in dev, SMTP/Resend in prod)
// ============================================================
import { env } from '../config/env.js';

const APP_URL = env.FRONTEND_URL || 'http://localhost:5173';

function logEmail(to, subject, html) {
  const preview = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  console.log('\n--- Ordinex email ---');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(preview + (preview.length >= 200 ? '…' : ''));
  if (process.env.DEV_EMAIL_LOG === '1') {
    console.log(html);
  }
  console.log('--- end email ---\n');
}

async function sendMail({ to, subject, html }) {
  if (!to) return { ok: false };

  const resendKey = process.env.RESEND_API_KEY || '';
  if (resendKey && env.NODE_ENV === 'production') {
    try {
      const from = process.env.EMAIL_FROM || 'Ordinex <noreply@ordinex.app>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error('[email] Resend failed:', res.status, body);
        logEmail(to, subject, html);
        return { ok: false };
      }
      return { ok: true };
    } catch (err) {
      console.error('[email] Resend error:', err.message);
      logEmail(to, subject, html);
      return { ok: false };
    }
  }

  logEmail(to, subject, html);
  return { ok: true, dev: true };
}

function wrapBody(title, paragraphs, ctaLabel, ctaHref) {
  const ps = paragraphs.map((p) => `<p style="font-family:sans-serif;line-height:1.5;color:#333;">${p}</p>`).join('');
  const cta = ctaLabel && ctaHref
    ? `<p style="margin-top:24px;"><a href="${ctaHref}" style="background:#004D40;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-family:sans-serif;">${ctaLabel}</a></p>`
    : '';
  return `<!DOCTYPE html><html><body style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-family:sans-serif;color:#004D40;font-size:22px;">${title}</h1>
    ${ps}${cta}
    <p style="font-family:sans-serif;font-size:12px;color:#888;margin-top:32px;">Ordinex — legal guidance for Filipinos</p>
  </body></html>`;
}

export async function sendCitizenWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to Ordinex',
    html: wrapBody(
      'Welcome to Ordinex',
      [
        `Hi ${user.name || 'there'},`,
        'Your account is ready. You can sign in anytime to explore AI case guidance and connect with licensed counsel.',
      ],
      'Open Ordinex',
      APP_URL,
    ),
  });
}

export async function sendLawyerApplicationReceivedEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'We received your counsel application',
    html: wrapBody(
      'Application received',
      [
        `Hi ${user.name || 'Counsel'},`,
        'Thanks for registering as counsel on Ordinex. Complete identity verification on the page where you left off.',
        'Your dashboard stays locked until verification is approved. We will email you when you can sign in.',
      ],
      'Continue application',
      `${APP_URL}/lawyer/register?phase=kyc`,
    ),
  });
}

export async function sendLawyerVerifiedEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Your Ordinex counsel account is verified',
    html: wrapBody(
      'You are verified',
      [
        `Hi ${user.name || 'Counsel'},`,
        'Your identity verification passed. Sign in with your email and password to access your counsel dashboard.',
      ],
      'Sign in',
      APP_URL,
    ),
  });
}

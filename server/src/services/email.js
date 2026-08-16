// ============================================================
// Ordinex — Transactional email (Gmail SMTP or console in dev)
// ============================================================
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const APP_URL = env.FRONTEND_URL || 'http://localhost:5173';

let smtpTransporter = null;
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  if (env.SMTP_USER && env.SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: env.SMTP_PORT || 465,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS.replace(/\s+/g, ''), // Clean any whitespace from Google App Password
      },
    });
  }
  return smtpTransporter;
}

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

  // 1. Primary: Direct Gmail / SMTP via Nodemailer
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const from = env.SMTP_USER ? `Ordinex <${env.SMTP_USER}>` : env.EMAIL_FROM;
      await transporter.sendMail({ from, to, subject, html });
      console.log(`[email] Real email sent via Gmail SMTP to ${to}`);
      return { ok: true, smtp: true };
    } catch (err) {
      console.error('[email] Gmail SMTP delivery failed:', err.message);
    }
  }

  // 2. Dev / Fallback console logger
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
        'Your account is ready. You can log in anytime to explore AI case guidance and connect with licensed counsel.',
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
        'Thanks for registering as counsel on Ordinex. Log in and finish identity verification in Account Settings.',
        'Directory listing and bookings stay locked until verification is approved.',
      ],
      'Open Account Settings',
      `${APP_URL}/settings?tab=verification`,
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
        'Your identity verification passed. Log in with your email and password to access your counsel dashboard.',
      ],
      'Log in',
      APP_URL,
    ),
  });
}

export async function sendEmailOTP({ to, code, purpose = 'REGISTER' }) {
  const isReset = purpose === 'RESET_PASSWORD';
  const title = isReset ? 'Reset your Ordinex password' : 'Verify your email address';
  const subject = isReset ? `${code} is your Ordinex password reset code` : `${code} is your Ordinex verification code`;

  const html = `<!DOCTYPE html>
<html>
<body style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C2420;background:#FAF8F4;">
  <div style="background:#ffffff;border:1px solid #E2DED6;border-radius:12px;padding:32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <div style="margin-bottom:20px;">
      <span style="font-size:24px;font-weight:800;color:#1A5C47;letter-spacing:1px;">ORDINEX</span>
    </div>
    <h1 style="font-size:20px;font-weight:700;color:#1C2420;margin:0 0 12px 0;">${title}</h1>
    <p style="font-size:14px;color:#5A645E;line-height:1.5;margin:0 0 24px 0;">
      Use the 6-digit verification code below to complete your ${isReset ? 'password reset' : 'registration'}.
    </p>
    <div style="background:#F2F7F4;border:1px dashed #1A5C47;border-radius:8px;padding:16px;margin-bottom:24px;display:inline-block;width:80%;">
      <span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#1A5C47;">${code}</span>
    </div>
    <p style="font-size:12px;color:#8B948E;margin:0;">
      This code is valid for <strong>5 minutes</strong>. If you did not request this code, you can safely ignore this email.
    </p>
  </div>
  <p style="font-size:11px;color:#A0A8A2;text-align:center;margin-top:20px;">
    &copy; ${new Date().getFullYear()} Ordinex Legal Tech Platform. All rights reserved.
  </p>
</body>
</html>`;

  return sendMail({ to, subject, html });
}


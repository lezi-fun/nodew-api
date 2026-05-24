import { env } from '../config/env.js';

type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sendWithResend = async (message: MailMessage) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM!,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${body}`);
  }
};

const sendWithSmtp = async (message: MailMessage) => {
  const { createTransport } = await import('nodemailer');
  const transport = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
};

export const isMailDeliveryEnabled = () => env.MAIL_PROVIDER !== 'disabled';

export const buildAppUrl = (pathname: string) => {
  const baseUrl = env.APP_BASE_URL ?? 'http://127.0.0.1:3000';
  return new URL(pathname, baseUrl).toString();
};

export const sendMailMessage = async (message: MailMessage) => {
  if (env.MAIL_PROVIDER === 'disabled') {
    return false;
  }

  if (env.MAIL_PROVIDER === 'resend') {
    await sendWithResend(message);
    return true;
  }

  if (env.MAIL_PROVIDER === 'smtp') {
    await sendWithSmtp(message);
    return true;
  }

  return false;
};

export const buildEmailVerificationMessage = (email: string, token: string) => {
  const verificationUrl = buildAppUrl(`/verify-email?token=${encodeURIComponent(token)}`);

  return {
    to: email,
    subject: 'Verify your email address',
    text: [
      'Finish verifying your email address by opening the link below:',
      verificationUrl,
      '',
      `If needed, you can also enter this token manually: ${token}`,
    ].join('\n'),
    html: [
      '<p>Finish verifying your email address by opening the link below:</p>',
      `<p><a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a></p>`,
      `<p>If needed, you can also enter this token manually: <strong>${escapeHtml(token)}</strong></p>`,
    ].join(''),
  } satisfies MailMessage;
};

export const buildPasswordResetMessage = (email: string, token: string) => {
  const resetUrl = buildAppUrl(`/user/reset?token=${encodeURIComponent(token)}`);

  return {
    to: email,
    subject: 'Reset your password',
    text: [
      'Use the link below to reset your password:',
      resetUrl,
      '',
      `If needed, you can also enter this token manually: ${token}`,
    ].join('\n'),
    html: [
      '<p>Use the link below to reset your password:</p>',
      `<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>`,
      `<p>If needed, you can also enter this token manually: <strong>${escapeHtml(token)}</strong></p>`,
    ].join(''),
  } satisfies MailMessage;
};

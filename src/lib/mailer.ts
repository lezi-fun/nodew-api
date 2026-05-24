import { getMailDeliveryConfig } from './mail-config.js';

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
  const config = await getMailDeliveryConfig();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from!,
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
  const config = await getMailDeliveryConfig();
  const { createTransport } = await import('nodemailer');
  const transport = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  } as Parameters<typeof createTransport>[0]);

  await transport.sendMail({
    from: config.from ?? undefined,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
};

export const buildAppUrl = async (pathname: string) => {
  const config = await getMailDeliveryConfig();
  const baseUrl = config.appBaseUrl ?? 'http://127.0.0.1:3000';
  return new URL(pathname, baseUrl).toString();
};

export const sendMailMessage = async (message: MailMessage) => {
  const config = await getMailDeliveryConfig();

  if (config.provider === 'disabled') {
    return false;
  }

  if (config.provider === 'resend') {
    await sendWithResend(message);
    return true;
  }

  if (config.provider === 'smtp') {
    await sendWithSmtp(message);
    return true;
  }

  return false;
};

export const buildEmailVerificationMessage = async (email: string, token: string) => {
  const verificationUrl = await buildAppUrl(`/verify-email?token=${encodeURIComponent(token)}`);

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

export const buildRegistrationVerificationMessage = async (email: string, token: string, code: string) => {
  const verificationUrl = await buildAppUrl(`/verify-email?flow=registration&token=${encodeURIComponent(token)}`);

  return {
    to: email,
    subject: 'Verify your email to complete registration',
    text: [
      'Open the link below to complete registration:',
      verificationUrl,
      '',
      `Verification code: ${code}`,
      '',
      'You can either open the link or enter the verification code on the registration page.',
    ].join('\n'),
    html: [
      '<p>Open the link below to complete registration:</p>',
      `<p><a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a></p>`,
      `<p>Verification code: <strong>${escapeHtml(code)}</strong></p>`,
      '<p>You can either open the link or enter the verification code on the registration page.</p>',
    ].join(''),
  } satisfies MailMessage;
};

export const buildPasswordResetMessage = async (email: string, token: string) => {
  const resetUrl = await buildAppUrl(`/user/reset?token=${encodeURIComponent(token)}`);

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

export const buildTestMailMessage = async (email: string) => {
  const timestamp = new Date().toISOString();
  const appUrl = await buildAppUrl('/');

  return {
    to: email,
    subject: 'Mail delivery test',
    text: [
      'This is a mail delivery test message.',
      `Sent at: ${timestamp}`,
      `Application URL: ${appUrl}`,
    ].join('\n'),
    html: [
      '<p>This is a mail delivery test message.</p>',
      `<p>Sent at: <strong>${escapeHtml(timestamp)}</strong></p>`,
      `<p>Application URL: <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>`,
    ].join(''),
  } satisfies MailMessage;
};

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type Base64URLString,
  type PublicKeyCredentialDescriptorJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { prisma } from './prisma.js';

export const passkeyOptionKeys = {
  enabled: 'passkey_enabled',
  rpDisplayName: 'passkey_rp_display_name',
  rpId: 'passkey_rp_id',
  origins: 'passkey_origins',
  allowInsecureOrigin: 'passkey_allow_insecure_origin',
  userVerification: 'passkey_user_verification',
  attachmentPreference: 'passkey_attachment_preference',
} as const;

export type PasskeyUserVerification = 'required' | 'preferred' | 'discouraged';
export type PasskeyAttachmentPreference = '' | 'platform' | 'cross-platform';

export type PasskeySettings = {
  enabled: boolean;
  rpDisplayName: string;
  rpId: string;
  origins: string;
  allowInsecureOrigin: boolean;
  userVerification: PasskeyUserVerification;
  attachmentPreference: PasskeyAttachmentPreference;
};

export type PasskeyCredentialRecord = {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  attestationType: string;
  aaguid: string;
  signCount: number;
  cloneWarning: boolean;
  userPresent: boolean;
  userVerified: boolean;
  backupEligible: boolean;
  backupState: boolean;
  transports: string;
  attachment: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export const passkeyCredentialSelect = {
  id: true,
  userId: true,
  credentialId: true,
  publicKey: true,
  attestationType: true,
  aaguid: true,
  signCount: true,
  cloneWarning: true,
  userPresent: true,
  userVerified: true,
  backupEligible: true,
  backupState: true,
  transports: true,
  attachment: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export const passkeyChallengeTtlMs = 5 * 60 * 1000;
export const secureVerificationTtlMs = 5 * 60 * 1000;
export const passkeyChallengeCookieNames = {
  registration: 'nodew_passkey_registration',
  login: 'nodew_passkey_login',
  verify: 'nodew_passkey_verify',
} as const;

export const secureVerificationCookieName = 'nodew_secure_verified_at';

const passkeyUserVerificationSchema = z.enum(['required', 'preferred', 'discouraged']);
const passkeyAttachmentPreferenceSchema = z.enum(['', 'platform', 'cross-platform']);

const passkeyChallengeSchema = z.object({
  challenge: z.string().min(1),
  origin: z.string().min(1),
  rpId: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
  userId: z.string().min(1).optional(),
});

const parseBoolean = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return false;
};

const parseString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseOriginList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const url = new URL(entry);
      return url.origin;
    });

const isLocalhostOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin);

    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const normalizeHost = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('://')) {
    return new URL(trimmed).hostname;
  }

  return new URL(`https://${trimmed}`).hostname;
};

const resolveRequestOrigin = (request: FastifyRequest) => {
  const originHeader = request.headers.origin;

  if (typeof originHeader === 'string' && originHeader.trim()) {
    try {
      return new URL(originHeader.trim()).origin;
    } catch {
      // fall through
    }
  }

  const refererHeader = request.headers.referer;

  if (typeof refererHeader === 'string' && refererHeader.trim()) {
    try {
      return new URL(refererHeader.trim()).origin;
    } catch {
      // fall through
    }
  }

  const appBaseUrl = parseString(process.env.APP_BASE_URL);

  if (appBaseUrl) {
    try {
      return new URL(appBaseUrl).origin;
    } catch {
      // fall through
    }
  }

  const host = typeof request.headers.host === 'string' ? request.headers.host.trim() : '';

  if (!host) {
    return null;
  }

  const protocol = typeof request.protocol === 'string' && request.protocol.trim() ? request.protocol.trim() : 'http';

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
};

const parseTransports = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return undefined;
    }

    return parsed.filter((item): item is AuthenticatorTransportFuture => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return undefined;
  }
};

const serializeTransports = (value?: AuthenticatorTransportFuture[]) => {
  if (!value || value.length === 0) {
    return '';
  }

  return JSON.stringify(value);
};

const getSystemOptionMap = async () => {
  const options = await prisma.systemOption.findMany({
    where: {
      key: {
        in: [
          'site_name',
          passkeyOptionKeys.enabled,
          passkeyOptionKeys.rpDisplayName,
          passkeyOptionKeys.rpId,
          passkeyOptionKeys.origins,
          passkeyOptionKeys.allowInsecureOrigin,
          passkeyOptionKeys.userVerification,
          passkeyOptionKeys.attachmentPreference,
        ],
      },
    },
  });

  return new Map(options.map((option) => [option.key, option.value]));
};

export const getPasskeySettings = async (): Promise<PasskeySettings> => {
  const map = await getSystemOptionMap();
  const userVerification = passkeyUserVerificationSchema.safeParse(map.get(passkeyOptionKeys.userVerification));
  const attachmentPreference = passkeyAttachmentPreferenceSchema.safeParse(map.get(passkeyOptionKeys.attachmentPreference));
  const siteName = parseString(map.get('site_name')) || 'NodEW-api';

  return {
    enabled: parseBoolean(map.get(passkeyOptionKeys.enabled)),
    rpDisplayName: parseString(map.get(passkeyOptionKeys.rpDisplayName)) || siteName,
    rpId: parseString(map.get(passkeyOptionKeys.rpId)),
    origins: parseString(map.get(passkeyOptionKeys.origins)),
    allowInsecureOrigin: parseBoolean(map.get(passkeyOptionKeys.allowInsecureOrigin)),
    userVerification: userVerification.success ? userVerification.data : 'preferred',
    attachmentPreference: attachmentPreference.success ? attachmentPreference.data : '',
  };
};

const resolveExpectedOrigins = (request: FastifyRequest, settings: PasskeySettings) => {
  const configuredOrigins = parseString(settings.origins)
    ? parseOriginList(settings.origins)
    : [];
  const requestOrigin = resolveRequestOrigin(request);
  const candidateOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : requestOrigin
      ? [requestOrigin]
      : [];

  if (candidateOrigins.length === 0) {
    throw new Error('Unable to resolve Passkey origin');
  }

  for (const origin of candidateOrigins) {
    const parsedOrigin = new URL(origin);

    if (parsedOrigin.protocol === 'http:' && !settings.allowInsecureOrigin && !isLocalhostOrigin(origin)) {
      throw new Error(`Passkey requires HTTPS origin: ${origin}`);
    }
  }

  const fallbackOrigin = candidateOrigins[0];

  if (!fallbackOrigin) {
    throw new Error('Unable to resolve Passkey origin');
  }

  const rpId = settings.rpId.trim() ? normalizeHost(settings.rpId) : new URL(fallbackOrigin).hostname;

  if (!rpId) {
    throw new Error('Unable to resolve Passkey RP ID');
  }

  const selectedOrigin = requestOrigin && candidateOrigins.includes(requestOrigin)
    ? requestOrigin
    : fallbackOrigin;

  return {
    origins: candidateOrigins,
    rpId,
    requestOrigin: selectedOrigin,
  };
};

export const resolvePasskeyContext = async (request: FastifyRequest) => {
  const settings = await getPasskeySettings();
  const context = resolveExpectedOrigins(request, settings);

  return {
    ...settings,
    ...context,
  };
};

export const buildPasskeyRegistrationOptions = async (params: {
  request: FastifyRequest;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
  };
  existingCredential?: Pick<PasskeyCredentialRecord, 'credentialId' | 'transports'> | null;
}) => {
  const settings = await getPasskeySettings();

  if (!settings.enabled) {
    throw new Error('Passkey login is disabled');
  }

  const context = resolveExpectedOrigins(params.request, settings);
  const excludeCredentials: PublicKeyCredentialDescriptorJSON[] = params.existingCredential
    ? [{
        id: params.existingCredential.credentialId as Base64URLString,
        type: 'public-key',
        transports: parseTransports(params.existingCredential.transports),
      }]
    : [];

  const options = await generateRegistrationOptions({
    rpName: settings.rpDisplayName,
    rpID: context.rpId,
    userName: params.user.username,
    userDisplayName: params.user.displayName ?? params.user.username,
    userID: Buffer.from(params.user.id, 'utf8'),
    challenge: undefined,
    excludeCredentials,
    authenticatorSelection: {
      userVerification: settings.userVerification,
    },
    preferredAuthenticatorType:
      settings.attachmentPreference === 'platform'
        ? 'localDevice'
        : settings.attachmentPreference === 'cross-platform'
          ? 'securityKey'
          : undefined,
  });

  return {
    options,
    context,
  };
};

export const buildPasskeyLoginOptions = async (request: FastifyRequest) => {
  const settings = await getPasskeySettings();

  if (!settings.enabled) {
    throw new Error('Passkey login is disabled');
  }

  const context = resolveExpectedOrigins(request, settings);
  const options = await generateAuthenticationOptions({
    rpID: context.rpId,
    userVerification: settings.userVerification,
  });

  return {
    options,
    context,
  };
};

export const buildPasskeyVerifyOptions = async (params: {
  request: FastifyRequest;
  credential: Pick<PasskeyCredentialRecord, 'credentialId' | 'transports'>;
}) => {
  const settings = await getPasskeySettings();

  if (!settings.enabled) {
    throw new Error('Passkey login is disabled');
  }

  const context = resolveExpectedOrigins(params.request, settings);
  const options = await generateAuthenticationOptions({
    rpID: context.rpId,
    allowCredentials: [{
      id: params.credential.credentialId as Base64URLString,
      transports: parseTransports(params.credential.transports),
    }],
    userVerification: settings.userVerification,
  });

  return {
    options,
    context,
  };
};

export const serializePasskeyCredential = (credential: PasskeyCredentialRecord | null) => {
  if (!credential) {
    return {
      enabled: false,
      lastUsedAt: null,
      createdAt: null,
      updatedAt: null,
      attachment: null,
      signCount: 0,
      userVerified: false,
      backupEligible: false,
      backupState: false,
    };
  }

  return {
    enabled: true,
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
    attachment: credential.attachment || null,
    signCount: credential.signCount,
    userVerified: credential.userVerified,
    backupEligible: credential.backupEligible,
    backupState: credential.backupState,
  };
};

export const passkeyCredentialToWebAuthnCredential = (credential: Pick<PasskeyCredentialRecord, 'credentialId' | 'publicKey' | 'signCount' | 'transports'>): WebAuthnCredential => ({
  id: credential.credentialId as Base64URLString,
  publicKey: Buffer.from(credential.publicKey, 'base64url'),
  counter: credential.signCount,
  transports: parseTransports(credential.transports),
});

export const buildPasskeyCredentialCreateData = (params: {
  userId: string;
  registrationResponse: RegistrationResponseJSON;
  verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
}) => {
  if (!params.verification.verified || !params.verification.registrationInfo) {
    throw new Error('Passkey registration failed');
  }

  const { registrationInfo } = params.verification;
  const transports = registrationInfo.credential.transports;

  return {
    userId: params.userId,
    credentialId: registrationInfo.credential.id,
    publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
    attestationType: registrationInfo.fmt,
    aaguid: Buffer.from(registrationInfo.aaguid).toString('base64url'),
    signCount: registrationInfo.credential.counter,
    cloneWarning: false,
    userPresent: true,
    userVerified: registrationInfo.userVerified,
    backupEligible: registrationInfo.credentialDeviceType === 'multiDevice',
    backupState: registrationInfo.credentialBackedUp,
    transports: serializeTransports(transports),
    attachment: params.registrationResponse.authenticatorAttachment ?? '',
    lastUsedAt: null as Date | null,
    deletedAt: null as Date | null,
  };
};

export const buildPasskeyCredentialUpdateData = (params: {
  authenticationResponse: AuthenticationResponseJSON;
  verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
}) => {
  if (!params.verification.verified) {
    throw new Error('Passkey authentication failed');
  }

  return {
    signCount: params.verification.authenticationInfo.newCounter,
    userVerified: params.verification.authenticationInfo.userVerified,
    backupState: params.verification.authenticationInfo.credentialBackedUp,
    attachment: params.authenticationResponse.authenticatorAttachment ?? undefined,
    lastUsedAt: new Date(),
  };
};

export const passkeyChallengeCookieOptions = (ttlMs: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  signed: true,
  maxAge: Math.max(1, Math.floor(ttlMs / 1000)),
});

export const setPasskeyChallengeCookie = (
  reply: FastifyReply,
  name: string,
  payload: z.infer<typeof passkeyChallengeSchema>,
  ttlMs = passkeyChallengeTtlMs,
) => {
  reply.setCookie(name, JSON.stringify(payload), passkeyChallengeCookieOptions(ttlMs));
};

export const readPasskeyChallengeCookie = (
  request: FastifyRequest,
  name: string,
): z.infer<typeof passkeyChallengeSchema> | null => {
  const cookie = request.cookies[name];

  if (!cookie) {
    return null;
  }

  const signedCookie = request.unsignCookie(cookie);

  if (!signedCookie.valid) {
    return null;
  }

  try {
    const parsed = passkeyChallengeSchema.parse(JSON.parse(signedCookie.value));

    if (Date.now() - parsed.issuedAt > passkeyChallengeTtlMs) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const clearPasskeyChallengeCookie = (reply: FastifyReply, name: string) => {
  reply.clearCookie(name, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
  });
};

export const setSecureVerificationCookie = (reply: FastifyReply, payload: { userId: string; issuedAt?: number } = { userId: '' }) => {
  if (!payload.userId) {
    throw new Error('userId is required');
  }

  reply.setCookie(
    secureVerificationCookieName,
    JSON.stringify({
      userId: payload.userId,
      issuedAt: payload.issuedAt ?? Date.now(),
    }),
    passkeyChallengeCookieOptions(secureVerificationTtlMs),
  );
};

export const clearSecureVerificationCookie = (reply: FastifyReply) => {
  reply.clearCookie(secureVerificationCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
  });
};

export const readSecureVerificationCookie = (
  request: FastifyRequest,
): { userId: string; issuedAt: number } | null => {
  const cookie = request.cookies[secureVerificationCookieName];

  if (!cookie) {
    return null;
  }

  const signedCookie = request.unsignCookie(cookie);

  if (!signedCookie.valid) {
    return null;
  }

  try {
    const parsed = z.object({
      userId: z.string().min(1),
      issuedAt: z.number().int().nonnegative(),
    }).parse(JSON.parse(signedCookie.value));

    if (Date.now() - parsed.issuedAt > secureVerificationTtlMs) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

import { z } from 'zod';

import {
  getOAuthProviderConfig as getEnvironmentOAuthProviderConfig,
  type OAuthProvider,
  type OAuthProviderConfig,
} from './oauth.js';
import { prisma } from './prisma.js';

export const oauthOptionKeys = {
  oidcEnabled: 'oauth_oidc_enabled',
  oidcWellKnownUrl: 'oauth_oidc_well_known_url',
  oidcClientId: 'oauth_oidc_client_id',
  oidcClientSecret: 'oauth_oidc_client_secret',
  oidcAuthorizationUrl: 'oauth_oidc_authorization_url',
  oidcTokenUrl: 'oauth_oidc_token_url',
  oidcUserInfoUrl: 'oauth_oidc_userinfo_url',
  oidcScope: 'oauth_oidc_scope',
} as const;

export type OIDCOAuthConfigDraft = {
  enabled: boolean;
  wellKnownUrl: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
};

export type OAuthConfigDraft = {
  oidc: OIDCOAuthConfigDraft;
};

export type OIDCOAuthRuntimeStatus = OIDCOAuthConfigDraft & {
  enabled: boolean;
};

export type OAuthConfiguration = {
  draft: OAuthConfigDraft;
  status: {
    oidc: OIDCOAuthRuntimeStatus;
    source: 'environment' | 'settings' | 'mixed';
    valid: boolean;
    errors: string[];
  };
};

type StoredOIDCDraft = {
  draft: OIDCOAuthConfigDraft;
  keys: Set<string>;
};

const defaultOIDCScope = 'openid profile email';

const parseString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return undefined;
};

const hasCompleteOIDCConfig = (draft: OIDCOAuthConfigDraft) =>
  Boolean(draft.clientId && draft.clientSecret && draft.authorizationUrl && draft.tokenUrl && draft.userInfoUrl);

const normalizeOIDCDraft = (input: Partial<OIDCOAuthConfigDraft>): OIDCOAuthConfigDraft => ({
  enabled: input.enabled ?? false,
  wellKnownUrl: parseString(input.wellKnownUrl),
  clientId: parseString(input.clientId),
  clientSecret: parseString(input.clientSecret),
  authorizationUrl: parseString(input.authorizationUrl),
  tokenUrl: parseString(input.tokenUrl),
  userInfoUrl: parseString(input.userInfoUrl),
  scope: parseString(input.scope) || defaultOIDCScope,
});

const readEnvironmentOIDCDraft = (): OIDCOAuthConfigDraft => {
  const draft = normalizeOIDCDraft({
    enabled: parseBoolean(process.env.OIDC_OAUTH_ENABLED),
    wellKnownUrl: process.env.OIDC_OAUTH_WELL_KNOWN_URL,
    clientId: process.env.OIDC_OAUTH_CLIENT_ID,
    clientSecret: process.env.OIDC_OAUTH_CLIENT_SECRET,
    authorizationUrl: process.env.OIDC_OAUTH_AUTHORIZATION_URL,
    tokenUrl: process.env.OIDC_OAUTH_TOKEN_URL,
    userInfoUrl: process.env.OIDC_OAUTH_USERINFO_URL,
    scope: process.env.OIDC_OAUTH_SCOPE,
  });

  return {
    ...draft,
    enabled: parseBoolean(process.env.OIDC_OAUTH_ENABLED) ?? hasCompleteOIDCConfig(draft),
  };
};

const readStoredOIDCDraft = async (): Promise<StoredOIDCDraft> => {
  const options = await prisma.systemOption.findMany({
    where: {
      key: {
        in: Object.values(oauthOptionKeys),
      },
    },
  });
  const map = new Map(options.map((option) => [option.key, option.value]));

  return {
    draft: normalizeOIDCDraft({
      enabled: parseBoolean(map.get(oauthOptionKeys.oidcEnabled)) ?? false,
      wellKnownUrl: map.get(oauthOptionKeys.oidcWellKnownUrl),
      clientId: map.get(oauthOptionKeys.oidcClientId),
      clientSecret: map.get(oauthOptionKeys.oidcClientSecret),
      authorizationUrl: map.get(oauthOptionKeys.oidcAuthorizationUrl),
      tokenUrl: map.get(oauthOptionKeys.oidcTokenUrl),
      userInfoUrl: map.get(oauthOptionKeys.oidcUserInfoUrl),
      scope: map.get(oauthOptionKeys.oidcScope),
    }),
    keys: new Set(options.map((option) => option.key)),
  };
};

const mergeOIDCDraft = (
  base: OIDCOAuthConfigDraft,
  override: OIDCOAuthConfigDraft,
  keys: Set<string>,
): OIDCOAuthConfigDraft => ({
  enabled: keys.has(oauthOptionKeys.oidcEnabled) ? override.enabled : base.enabled,
  wellKnownUrl: override.wellKnownUrl || base.wellKnownUrl,
  clientId: override.clientId || base.clientId,
  clientSecret: override.clientSecret || base.clientSecret,
  authorizationUrl: override.authorizationUrl || base.authorizationUrl,
  tokenUrl: override.tokenUrl || base.tokenUrl,
  userInfoUrl: override.userInfoUrl || base.userInfoUrl,
  scope: override.scope || base.scope || defaultOIDCScope,
});

const oidcRuntimeSchema = z.object({
  enabled: z.boolean(),
  wellKnownUrl: z.string().url().or(z.literal('')),
  clientId: z.string(),
  clientSecret: z.string(),
  authorizationUrl: z.string().url().or(z.literal('')),
  tokenUrl: z.string().url().or(z.literal('')),
  userInfoUrl: z.string().url().or(z.literal('')),
  scope: z.string(),
}).superRefine((value, ctx) => {
  if (!value.enabled) {
    return;
  }

  for (const [key, fieldValue, message] of [
    ['clientId', value.clientId, 'OIDC client ID is required when OIDC login is enabled'],
    ['clientSecret', value.clientSecret, 'OIDC client secret is required when OIDC login is enabled'],
    ['authorizationUrl', value.authorizationUrl, 'OIDC authorization endpoint is required when OIDC login is enabled'],
    ['tokenUrl', value.tokenUrl, 'OIDC token endpoint is required when OIDC login is enabled'],
    ['userInfoUrl', value.userInfoUrl, 'OIDC userinfo endpoint is required when OIDC login is enabled'],
  ] as const) {
    if (!fieldValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message,
      });
    }
  }
});

const evaluateOIDCDraft = (draft: OIDCOAuthConfigDraft) => {
  const parsed = oidcRuntimeSchema.safeParse(draft);

  if (!parsed.success) {
    return {
      config: {
        ...draft,
        enabled: false,
      },
      valid: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  return {
    config: {
      ...parsed.data,
      enabled: parsed.data.enabled && hasCompleteOIDCConfig(parsed.data),
    },
    valid: true,
    errors: [],
  };
};

export const oidcOAuthConfigBodySchema = z.object({
  enabled: z.boolean().default(false),
  wellKnownUrl: z.string().trim().max(2048).default(''),
  clientId: z.string().trim().max(255).default(''),
  clientSecret: z.string().trim().max(1024).default(''),
  authorizationUrl: z.string().trim().max(2048).default(''),
  tokenUrl: z.string().trim().max(2048).default(''),
  userInfoUrl: z.string().trim().max(2048).default(''),
  scope: z.string().trim().max(255).default(defaultOIDCScope),
});

export const oauthConfigBodySchema = z.object({
  oidc: oidcOAuthConfigBodySchema,
});

export const getOAuthConfiguration = async (): Promise<OAuthConfiguration> => {
  const environment = readEnvironmentOIDCDraft();
  const stored = await readStoredOIDCDraft();
  const oidc = mergeOIDCDraft(environment, stored.draft, stored.keys);
  const evaluation = evaluateOIDCDraft(oidc);
  const hasSettingOverride = stored.keys.size > 0;
  const source = hasSettingOverride
    ? Object.entries(environment).some(([key, value]) => value !== oidc[key as keyof OIDCOAuthConfigDraft])
      ? 'mixed'
      : 'settings'
    : 'environment';

  return {
    draft: {
      oidc,
    },
    status: {
      oidc: evaluation.config,
      source,
      valid: evaluation.valid,
      errors: evaluation.errors,
    },
  };
};

export const saveOAuthConfig = async (input: OAuthConfigDraft) => {
  const oidc = normalizeOIDCDraft(input.oidc);

  await prisma.$transaction(Object.entries({
    [oauthOptionKeys.oidcEnabled]: String(oidc.enabled),
    [oauthOptionKeys.oidcWellKnownUrl]: oidc.wellKnownUrl,
    [oauthOptionKeys.oidcClientId]: oidc.clientId,
    [oauthOptionKeys.oidcClientSecret]: oidc.clientSecret,
    [oauthOptionKeys.oidcAuthorizationUrl]: oidc.authorizationUrl,
    [oauthOptionKeys.oidcTokenUrl]: oidc.tokenUrl,
    [oauthOptionKeys.oidcUserInfoUrl]: oidc.userInfoUrl,
    [oauthOptionKeys.oidcScope]: oidc.scope,
  }).map(([key, value]) => prisma.systemOption.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })));

  return getOAuthConfiguration();
};

export const evaluateOAuthConfigInput = (input: OAuthConfigDraft) => {
  const environment = readEnvironmentOIDCDraft();
  const oidc = mergeOIDCDraft(environment, normalizeOIDCDraft(input.oidc), new Set(Object.values(oauthOptionKeys)));
  const evaluation = evaluateOIDCDraft(oidc);

  return {
    draft: {
      oidc,
    },
    status: {
      oidc: evaluation.config,
      source: 'settings' as const,
      valid: evaluation.valid,
      errors: evaluation.errors,
    },
  };
};

export const getEffectiveOAuthProviderConfig = async (provider: OAuthProvider): Promise<OAuthProviderConfig | null> => {
  if (provider !== 'oidc') {
    return getEnvironmentOAuthProviderConfig(provider);
  }

  const configuration = await getOAuthConfiguration();
  const oidc = configuration.status.oidc;

  if (!configuration.status.valid || !oidc.enabled) {
    return {
      clientId: '',
      clientSecret: '',
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      scope: oidc.scope || defaultOIDCScope,
    };
  }

  return {
    clientId: oidc.clientId,
    clientSecret: oidc.clientSecret,
    authorizeUrl: oidc.authorizationUrl,
    tokenUrl: oidc.tokenUrl,
    userInfoUrl: oidc.userInfoUrl,
    scope: oidc.scope || defaultOIDCScope,
  };
};

const oidcDiscoverySchema = z.object({
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  userinfo_endpoint: z.string().url(),
});

export const discoverOIDCConfiguration = async (wellKnownUrl: string) => {
  const normalizedUrl = z.string().trim().url().parse(wellKnownUrl);
  const response = await fetch(normalizedUrl, {
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await response.json().catch(() => null);

  if (!response.ok || !json) {
    throw new Error('Failed to fetch OIDC discovery document');
  }

  const parsed = oidcDiscoverySchema.safeParse(json);

  if (!parsed.success) {
    throw new Error('OIDC discovery document is missing required endpoints');
  }

  return {
    authorizationUrl: parsed.data.authorization_endpoint,
    tokenUrl: parsed.data.token_endpoint,
    userInfoUrl: parsed.data.userinfo_endpoint,
  };
};

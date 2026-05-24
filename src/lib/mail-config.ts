import { z } from 'zod';

import { prisma } from './prisma.js';

export const mailProviderSchema = z.enum(['disabled', 'smtp', 'resend']);

export type MailProvider = z.infer<typeof mailProviderSchema>;

export const mailOptionKeys = {
  appBaseUrl: 'mail_app_base_url',
  provider: 'mail_provider',
  from: 'mail_from',
  smtpHost: 'smtp_host',
  smtpPort: 'smtp_port',
  smtpSecure: 'smtp_secure',
  smtpUser: 'smtp_user',
  smtpPass: 'smtp_pass',
  resendApiKey: 'resend_api_key',
} as const;

export type MailConfigDraft = {
  appBaseUrl: string;
  provider: MailProvider;
  from: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  resendApiKey: string;
};

export type MailRuntimeConfig = {
  appBaseUrl: string | null;
  provider: MailProvider;
  from: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  resendApiKey: string | null;
  enabled: boolean;
};

export type MailConfiguration = {
  draft: MailConfigDraft;
  config: MailRuntimeConfig;
  valid: boolean;
  errors: string[];
  source: 'environment' | 'settings' | 'mixed';
};

const emptyMailConfigDraft: MailConfigDraft = {
  appBaseUrl: '',
  provider: 'disabled',
  from: '',
  smtpHost: '',
  smtpPort: '',
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  resendApiKey: '',
};

type StoredMailDraft = {
  draft: MailConfigDraft;
  keys: Set<string>;
};

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

const parsePort = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();

    if (!normalized) {
      return '';
    }

    const parsed = Number(normalized);

    if (Number.isInteger(parsed) && parsed > 0) {
      return String(parsed);
    }
  }

  return '';
};

const normalizeDraft = (input: Partial<MailConfigDraft>): MailConfigDraft => ({
  appBaseUrl: parseString(input.appBaseUrl),
  provider: (() => {
    const parsed = mailProviderSchema.safeParse(input.provider);
    return parsed.success ? parsed.data : 'disabled';
  })(),
  from: parseString(input.from),
  smtpHost: parseString(input.smtpHost),
  smtpPort: parsePort(input.smtpPort),
  smtpSecure: input.smtpSecure ?? false,
  smtpUser: parseString(input.smtpUser),
  smtpPass: parseString(input.smtpPass),
  resendApiKey: parseString(input.resendApiKey),
});

const readEnvironmentMailDraft = (): MailConfigDraft => normalizeDraft({
  appBaseUrl: process.env.APP_BASE_URL,
  provider: process.env.MAIL_PROVIDER as MailProvider | undefined,
  from: process.env.MAIL_FROM,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpSecure: parseBoolean(process.env.SMTP_SECURE) ?? false,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  resendApiKey: process.env.RESEND_API_KEY,
});

const readStoredMailDraft = async (): Promise<StoredMailDraft> => {
  const options = await prisma.systemOption.findMany({
    where: {
      key: {
        in: Object.values(mailOptionKeys),
      },
    },
  });

  const map = new Map(options.map((option) => [option.key, option.value]));

  return {
    draft: normalizeDraft({
      appBaseUrl: map.get(mailOptionKeys.appBaseUrl),
      provider: map.get(mailOptionKeys.provider) as MailProvider | undefined,
      from: map.get(mailOptionKeys.from),
      smtpHost: map.get(mailOptionKeys.smtpHost),
      smtpPort: map.get(mailOptionKeys.smtpPort),
      smtpSecure: parseBoolean(map.get(mailOptionKeys.smtpSecure)) ?? false,
      smtpUser: map.get(mailOptionKeys.smtpUser),
      smtpPass: map.get(mailOptionKeys.smtpPass),
      resendApiKey: map.get(mailOptionKeys.resendApiKey),
    }),
    keys: new Set(options.map((option) => option.key)),
  };
};

const mergeDraft = (
  base: MailConfigDraft,
  override: MailConfigDraft,
  options: {
    overrideProvider: boolean;
  },
): MailConfigDraft => ({
  appBaseUrl: override.appBaseUrl || base.appBaseUrl,
  provider: options.overrideProvider ? override.provider : (override.provider !== 'disabled' || base.provider === 'disabled' ? override.provider : base.provider),
  from: override.from || base.from,
  smtpHost: override.smtpHost || base.smtpHost,
  smtpPort: override.smtpPort || base.smtpPort,
  smtpSecure: override.smtpSecure,
  smtpUser: override.smtpUser || base.smtpUser,
  smtpPass: override.smtpPass || base.smtpPass,
  resendApiKey: override.resendApiKey || base.resendApiKey,
});

const mailRuntimeSchema = z.object({
  appBaseUrl: z.string().url().nullable(),
  provider: mailProviderSchema,
  from: z.string().email().nullable(),
  smtpHost: z.string().min(1).nullable(),
  smtpPort: z.number().int().positive().nullable(),
  smtpSecure: z.boolean(),
  smtpUser: z.string().min(1).nullable(),
  smtpPass: z.string().min(1).nullable(),
  resendApiKey: z.string().min(1).nullable(),
}).superRefine((value, ctx) => {
  if (value.provider === 'disabled') {
    return;
  }

  if (!value.appBaseUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appBaseUrl'],
      message: 'APP_BASE_URL is required when mail is enabled',
    });
  }

  if (!value.from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['from'],
      message: 'MAIL_FROM is required when mail is enabled',
    });
  }

  if (value.provider === 'smtp') {
    for (const [key, fieldValue, message] of [
      ['smtpHost', value.smtpHost, 'SMTP_HOST is required when MAIL_PROVIDER=smtp'],
      ['smtpPort', value.smtpPort, 'SMTP_PORT is required when MAIL_PROVIDER=smtp'],
      ['smtpUser', value.smtpUser, 'SMTP_USER is required when MAIL_PROVIDER=smtp'],
      ['smtpPass', value.smtpPass, 'SMTP_PASS is required when MAIL_PROVIDER=smtp'],
    ] as const) {
      if (!fieldValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message,
        });
      }
    }
  }

  if (value.provider === 'resend' && !value.resendApiKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['resendApiKey'],
      message: 'RESEND_API_KEY is required when MAIL_PROVIDER=resend',
    });
  }
});

const evaluateDraft = (draft: MailConfigDraft): Pick<MailConfiguration, 'config' | 'valid' | 'errors'> => {
  const candidate = {
    appBaseUrl: draft.appBaseUrl || null,
    provider: draft.provider,
    from: draft.from || null,
    smtpHost: draft.smtpHost || null,
    smtpPort: draft.smtpPort ? Number(draft.smtpPort) : null,
    smtpSecure: draft.smtpSecure,
    smtpUser: draft.smtpUser || null,
    smtpPass: draft.smtpPass || null,
    resendApiKey: draft.resendApiKey || null,
  };

  const parsed = mailRuntimeSchema.safeParse(candidate);

  if (!parsed.success) {
    return {
      config: {
        ...candidate,
        enabled: false,
      },
      valid: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  return {
    config: {
      ...parsed.data,
      enabled: parsed.data.provider !== 'disabled',
    },
    valid: true,
    errors: [],
  };
};

export const mailConfigBodySchema = z.object({
  appBaseUrl: z.string().trim().max(2048).default(''),
  provider: mailProviderSchema.default('disabled'),
  from: z.string().trim().max(320).default(''),
  smtpHost: z.string().trim().max(255).default(''),
  smtpPort: z.union([z.string(), z.number().int().positive(), z.null(), z.undefined()]).transform((value) => parsePort(value)).default(''),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().max(255).default(''),
  smtpPass: z.string().trim().max(1024).default(''),
  resendApiKey: z.string().trim().max(1024).default(''),
});

export const getMailConfiguration = async (): Promise<MailConfiguration> => {
  const environment = readEnvironmentMailDraft();
  const stored = await readStoredMailDraft();
  const draft = mergeDraft(environment, stored.draft, {
    overrideProvider: stored.keys.has(mailOptionKeys.provider),
  });
  const evaluation = evaluateDraft(draft);
  const hasSettingOverride = stored.keys.size > 0;
  const source = hasSettingOverride
    ? Object.entries(environment).some(([key, value]) => value !== draft[key as keyof MailConfigDraft])
      ? 'mixed'
      : 'settings'
    : 'environment';

  return {
    draft,
    ...evaluation,
    source,
  };
};

export const getMailDeliveryConfig = async () => {
  const configuration = await getMailConfiguration();

  if (!configuration.valid) {
    throw new Error(configuration.errors[0] ?? 'Mail configuration is invalid');
  }

  return configuration.config;
};

export const isMailDeliveryEnabled = async () => {
  const configuration = await getMailConfiguration();
  return configuration.valid && configuration.config.enabled;
};

export const saveMailConfig = async (input: MailConfigDraft) => {
  const draft = normalizeDraft(input);

  await prisma.$transaction(Object.entries({
    [mailOptionKeys.appBaseUrl]: draft.appBaseUrl,
    [mailOptionKeys.provider]: draft.provider,
    [mailOptionKeys.from]: draft.from,
    [mailOptionKeys.smtpHost]: draft.smtpHost,
    [mailOptionKeys.smtpPort]: draft.smtpPort,
    [mailOptionKeys.smtpSecure]: String(draft.smtpSecure),
    [mailOptionKeys.smtpUser]: draft.smtpUser,
    [mailOptionKeys.smtpPass]: draft.smtpPass,
    [mailOptionKeys.resendApiKey]: draft.resendApiKey,
  }).map(([key, value]) => prisma.systemOption.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })));

  return getMailConfiguration();
};

export const evaluateMailConfigInput = (input: MailConfigDraft) => {
  const draft = mergeDraft(readEnvironmentMailDraft(), normalizeDraft(input), {
    overrideProvider: true,
  });
  return {
    draft,
    ...evaluateDraft(draft),
  };
};

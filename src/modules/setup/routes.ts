import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, hashPassword } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { setSessionCookie } from '../../plugins/auth.js';

const setupBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
  selfUseModeEnabled: z.boolean().optional(),
  demoSiteEnabled: z.boolean().optional(),
  siteName: z.string().min(1).max(128).optional(),
  siteDescription: z.string().min(1).max(512).optional(),
  defaultModel: z.string().min(1).max(128).optional(),
});

const parseBooleanOption = (value: string | null | undefined, fallback = false) => value === undefined || value === null ? fallback : value === 'true';

const getSetupConfig = async () => {
  const options = await prisma.systemOption.findMany({
    where: {
      key: {
        in: ['registration_enabled', 'self_use_mode_enabled', 'demo_site_enabled', 'site_name', 'site_description', 'default_model'],
      },
    },
  });

  const map = new Map(options.map((option) => [option.key, option.value]));

  return {
    registrationEnabled: parseBooleanOption(map.get('registration_enabled'), false),
    selfUseModeEnabled: parseBooleanOption(map.get('self_use_mode_enabled'), false),
    demoSiteEnabled: parseBooleanOption(map.get('demo_site_enabled'), false),
    siteName: map.get('site_name') ?? null,
    siteDescription: map.get('site_description') ?? null,
    defaultModel: map.get('default_model') ?? null,
  };
};

const upsertSystemOption = (tx: Prisma.TransactionClient, key: string, value: string) => tx.systemOption.upsert({
  where: { key },
  update: { value },
  create: { key, value },
});

const upsertOptionalSystemOption = async (tx: Prisma.TransactionClient, key: string, value: string | undefined) => {
  if (value === undefined) {
    return;
  }

  await upsertSystemOption(tx, key, value);
};

const upsertBooleanSystemOption = (tx: Prisma.TransactionClient, key: string, value: boolean | undefined, fallback: boolean) => {
  if (value === undefined) {
    return upsertSystemOption(tx, key, String(fallback));
  }

  return upsertSystemOption(tx, key, String(value));
};

const serializeSetupResponse = async (setupState: { isInitialized: boolean; initializedAt: Date | null } | null, hasAdmin: boolean) => ({
  isInitialized: setupState?.isInitialized ?? false,
  initializedAt: setupState?.initializedAt?.toISOString() ?? null,
  hasAdmin,
  config: await getSetupConfig(),
});

const publicConfigKeys = ['site_name', 'site_description', 'default_model'];

const readPublicConfig = async () => {
  const options = await prisma.systemOption.findMany({
    where: {
      key: {
        in: publicConfigKeys,
      },
    },
  });

  const map = new Map(options.map((option) => [option.key, option.value]));

  return {
    siteName: map.get('site_name') ?? null,
    siteDescription: map.get('site_description') ?? null,
    defaultModel: map.get('default_model') ?? null,
  };
};

const setupPublicConfigRouteSchema = z.object({});

void setupPublicConfigRouteSchema;

const setupConfigKeys = {
  registrationEnabled: 'registration_enabled',
  selfUseModeEnabled: 'self_use_mode_enabled',
  demoSiteEnabled: 'demo_site_enabled',
  siteName: 'site_name',
  siteDescription: 'site_description',
  defaultModel: 'default_model',
} as const;

const setupConfigDefaults = {
  registrationEnabled: false,
  selfUseModeEnabled: false,
  demoSiteEnabled: false,
} as const;

const persistSetupOptions = async (tx: Prisma.TransactionClient, body: z.infer<typeof setupBodySchema>) => {
  await upsertSystemOption(tx, setupConfigKeys.registrationEnabled, 'false');
  await upsertBooleanSystemOption(tx, setupConfigKeys.selfUseModeEnabled, body.selfUseModeEnabled, setupConfigDefaults.selfUseModeEnabled);
  await upsertBooleanSystemOption(tx, setupConfigKeys.demoSiteEnabled, body.demoSiteEnabled, setupConfigDefaults.demoSiteEnabled);
  await upsertOptionalSystemOption(tx, setupConfigKeys.siteName, body.siteName);
  await upsertOptionalSystemOption(tx, setupConfigKeys.siteDescription, body.siteDescription);
  await upsertOptionalSystemOption(tx, setupConfigKeys.defaultModel, body.defaultModel);
};

const updateSetupState = async (tx: Prisma.TransactionClient, setupState: { id: string } | null) => {
  if (setupState) {
    await tx.setupState.update({
      where: { id: setupState.id },
      data: {
        isInitialized: true,
        initializedAt: new Date(),
      },
    });

    return;
  }

  await tx.setupState.create({
    data: {
      isInitialized: true,
      initializedAt: new Date(),
    },
  });
};

const selectCreatedAdmin = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

const createInitialAdmin = (tx: Prisma.TransactionClient, body: z.infer<typeof setupBodySchema>, sessionToken: string) => tx.user.create({
  data: {
    email: body.email,
    username: body.username,
    passwordHash: hashPassword(body.password),
    displayName: body.displayName,
    role: 'ADMIN',
    accessToken: sessionToken,
  },
  select: selectCreatedAdmin,
});

const ensureSetupUserDoesNotExist = async (body: z.infer<typeof setupBodySchema>) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: body.email }, { username: body.username }],
    },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error('User already exists');
  }
};

const getSetupStateSummary = async () => {
  const [setupState, adminCount] = await Promise.all([
    prisma.setupState.findFirst({
      select: {
        isInitialized: true,
        initializedAt: true,
      },
    }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
  ]);

  return serializeSetupResponse(setupState, adminCount > 0);
};

const createSetupTransaction = async (body: z.infer<typeof setupBodySchema>, setupState: { id: string } | null, sessionToken: string) => prisma.$transaction(async (tx) => {
  const user = await createInitialAdmin(tx, body, sessionToken);
  await updateSetupState(tx, setupState);
  await persistSetupOptions(tx, body);
  return user;
});

const setupConflictMessage = 'System already initialized';
const setupExistingUserMessage = 'User already exists';

const setupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/setup', async () => getSetupStateSummary());

  app.get('/setup/config', async () => ({
    config: await readPublicConfig(),
  }));

  app.post('/setup', async (request, reply) => {
    const body = setupBodySchema.parse(request.body);
    const setupState = await prisma.setupState.findFirst({
      select: { id: true, isInitialized: true },
    });

    if (setupState?.isInitialized) {
      return reply.conflict(setupConflictMessage);
    }

    try {
      await ensureSetupUserDoesNotExist(body);
    } catch (error) {
      if (error instanceof Error && error.message === setupExistingUserMessage) {
        return reply.conflict(setupExistingUserMessage);
      }

      throw error;
    }

    const sessionToken = generateAccessToken();
    const adminUser = await createSetupTransaction(body, setupState, sessionToken);

    setSessionCookie(reply, sessionToken);

    return reply.code(201).send({
      user: adminUser,
      ...(await getSetupStateSummary()),
    });
  });
};

export default setupRoutes;

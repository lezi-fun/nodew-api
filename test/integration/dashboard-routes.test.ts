import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createChannel, createSessionForUser, createUser } from '../helpers/factories.js';

describe('dashboard compatibility routes', () => {
  it('returns authenticated model catalog from active channels', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    await createChannel({
      name: 'Catalog Channel',
      provider: 'openai',
      model: 'gpt-4o-mini',
      metadata: {
        models: ['gpt-4o', 'gpt-4o-mini'],
        pricing: {
          promptTokenCost: 1,
          completionTokenCost: 4,
          currency: 'quota',
        },
      },
    });
    await createChannel({
      name: 'Disabled Catalog Channel',
      status: 'DISABLED',
      model: 'disabled-model',
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/models',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().items.map((item: { id: string }) => item.id)).toEqual(['gpt-4o', 'gpt-4o-mini']);
      expect(response.json().items[0]).toMatchObject({
        object: 'model',
        owned_by: 'openai',
      });
      expect(response.json().items.find((item: { id: string }) => item.id === 'disabled-model')).toBeUndefined();
    } finally {
      await closeTestApp(app);
    }
  });

  it('returns public pricing data derived from channel metadata', async () => {
    await createChannel({
      provider: 'openrouter',
      model: 'router-model',
      metadata: {
        pricing: {
          promptTokenCost: 2,
          completionTokenCost: 8,
          currency: 'quota',
        },
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/pricing',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          id: 'router-model',
          providers: ['openrouter'],
          promptTokenCost: 2,
          completionTokenCost: 8,
        }),
      ]);
      expect(response.json().vendors).toEqual(['openrouter']);
    } finally {
      await closeTestApp(app);
    }
  });

  it('serves public content from system options with defaults', async () => {
    await prisma.systemOption.create({
      data: {
        key: 'notice',
        value: 'Maintenance window tonight.',
      },
    });
    const app = await createTestApp();

    try {
      const noticeResponse = await app.inject({
        method: 'GET',
        url: '/api/notice',
      });
      const aboutResponse = await app.inject({
        method: 'GET',
        url: '/api/about',
      });
      const siteResponse = await app.inject({
        method: 'GET',
        url: '/api/site',
      });

      expect(noticeResponse.statusCode).toBe(200);
      expect(noticeResponse.json()).toMatchObject({
        success: true,
        data: 'Maintenance window tonight.',
        content: 'Maintenance window tonight.',
      });
      expect(aboutResponse.statusCode).toBe(200);
      expect(aboutResponse.json().content).toContain('NodEW-api');
      expect(siteResponse.statusCode).toBe(200);
      expect(siteResponse.json().data).toMatchObject({
        siteName: 'NodEW-api',
        notice: 'Maintenance window tonight.',
      });
      expect(siteResponse.json().data.links.github).toBe('https://github.com/lezi-fun/nodew-api');
    } finally {
      await closeTestApp(app);
    }
  });
});

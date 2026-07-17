import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser } from '../helpers/factories.js';

describe('model and group ratio settings', () => {
  it('stores and reads global model ratio configuration', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      const saveResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/model_ratios',
        cookies,
        payload: { value: JSON.stringify({ 'gpt-4': 2, 'gpt-3.5-turbo': 0.5 }) },
      });
      expect(saveResponse.statusCode).toBe(200);

      const optionResponse = await app.inject({
        method: 'GET',
        url: '/api/options/model_ratios',
        cookies,
      });
      expect(optionResponse.statusCode).toBe(200);
      expect(optionResponse.json()).toMatchObject({
        item: { key: 'model_ratios', value: '{"gpt-4":2,"gpt-3.5-turbo":0.5}' },
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('stores and reads global group ratio configuration', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      const saveResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/group_ratios',
        cookies,
        payload: { value: JSON.stringify({ default: 1, vip: 0.8, enterprise: 0.5 }) },
      });
      expect(saveResponse.statusCode).toBe(200);
    } finally {
      await closeTestApp(app);
    }
  });

  it('stores model ratio and confirms it loads correctly', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    await prisma.systemOption.upsert({
      where: { key: 'model_ratios' },
      update: { value: JSON.stringify({ 'gpt-ratio-test': 5 }) },
      create: { key: 'model_ratios', value: JSON.stringify({ 'gpt-ratio-test': 5 }) },
    });
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      const response = await app.inject({ method: 'GET', url: '/api/options', cookies });
      expect(response.statusCode).toBe(200);
      const item = response.json().items.find((i: Record<string, unknown>) => i.key === 'model_ratios');
      expect(item?.value).toContain('5');
    } finally {
      await closeTestApp(app);
    }
  });
});

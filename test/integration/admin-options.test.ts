import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser } from '../helpers/factories.js';

describe('admin options integration', () => {
  it('updates an option and reflects it in setup responses', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/site_name',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          value: 'NodeW Test Site',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item.value).toBe('NodeW Test Site');

      const setupResponse = await app.inject({
        method: 'GET',
        url: '/api/setup/config',
      });

      expect(setupResponse.statusCode).toBe(200);
      expect(setupResponse.json().config.siteName).toBe('NodeW Test Site');
    } finally {
      await closeTestApp(app);
    }
  });

  it('updates public content options and exposes them through site metadata', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const noticeResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/notice',
        cookies,
        payload: {
          value: 'Preview maintenance notice.',
        },
      });
      const homeContentResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/home_page_content',
        cookies,
        payload: {
          value: 'Custom home page content.',
        },
      });
      const siteResponse = await app.inject({
        method: 'GET',
        url: '/api/site',
      });

      expect(noticeResponse.statusCode).toBe(200);
      expect(homeContentResponse.statusCode).toBe(200);
      expect(siteResponse.statusCode).toBe(200);
      expect(siteResponse.json().data).toMatchObject({
        notice: 'Preview maintenance notice.',
        homePageContent: 'Custom home page content.',
      });
    } finally {
      await closeTestApp(app);
    }
  });
});

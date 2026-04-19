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
});

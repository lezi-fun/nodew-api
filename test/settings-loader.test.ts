import { loadSettingsResources } from '../web/src/lib/settings-loader.js';

const fulfilled = <T>(value: T) => async () => value;
const rejected = (message: string) => async () => {
  throw new Error(message);
};

describe('settings resource loader', () => {
  it('keeps successful resources when an unrelated request fails', async () => {
    const result = await loadSettingsResources({
      options: fulfilled({ items: [{ key: 'site_name', value: 'NodEW' }] }),
      mailStatus: fulfilled({ item: { enabled: true } }),
      mailConfig: fulfilled({ item: { provider: 'smtp' } }),
      oauthStatus: rejected('oauth unavailable'),
      oauthConfig: fulfilled({ item: { oidc: { enabled: false } } }),
      customOAuthProviders: fulfilled({ items: [{ id: 'gitlab' }] }),
      subscriptionPlans: fulfilled({ items: [{ id: 'monthly-basic' }] }),
    });

    expect(result.resources.options).toEqual({ items: [{ key: 'site_name', value: 'NodEW' }] });
    expect(result.resources.mailConfig).toEqual({ item: { provider: 'smtp' } });
    expect(result.resources.subscriptionPlans).toEqual({ items: [{ id: 'monthly-basic' }] });
    expect(result.resources.oauthStatus).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({
        key: 'oauthStatus',
        message: 'oauth unavailable',
      }),
    ]);
  });

  it('reports every failed resource without rejecting the whole load', async () => {
    const result = await loadSettingsResources({
      options: rejected('options unavailable'),
      mailStatus: fulfilled({ item: { enabled: false } }),
      mailConfig: rejected('mail unavailable'),
      oauthStatus: fulfilled({ item: { valid: true } }),
      oauthConfig: fulfilled({ item: { oidc: { enabled: true } } }),
      customOAuthProviders: fulfilled({ items: [] }),
      subscriptionPlans: fulfilled({ items: [] }),
    });

    expect(result.resources.mailStatus).toEqual({ item: { enabled: false } });
    expect(result.resources.oauthStatus).toEqual({ item: { valid: true } });
    expect(result.errors.map((error) => error.key)).toEqual(['options', 'mailConfig']);
  });
});

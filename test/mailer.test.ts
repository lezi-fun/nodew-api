describe('mailer configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('validates resend configuration when enabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api';
    process.env.SESSION_SECRET = 'nodew-test-session-secret';
    process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
    process.env.MAIL_PROVIDER = 'resend';
    process.env.MAIL_FROM = 'noreply@test.local';
    process.env.RESEND_API_KEY = 're_test_key';

    const { parseEnv } = await import('../src/config/env.js');
    const env = parseEnv(process.env);

    expect(env.MAIL_PROVIDER).toBe('resend');
    expect(env.RESEND_API_KEY).toBe('re_test_key');
  });

  it('builds verification and reset links from APP_BASE_URL', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api';
    process.env.SESSION_SECRET = 'nodew-test-session-secret';
    process.env.APP_BASE_URL = 'https://console.example.com';
    process.env.MAIL_PROVIDER = 'disabled';

    const {
      buildEmailVerificationMessage,
      buildPasswordResetMessage,
      buildRegistrationVerificationMessage,
    } = await import('../src/lib/mailer.js');

    const verification = await buildEmailVerificationMessage('user@example.com', 'verify-token');
    const reset = await buildPasswordResetMessage('user@example.com', 'reset-token');
    const registration = await buildRegistrationVerificationMessage('user@example.com', 'register-token', '123456');

    expect(verification.text).toContain('https://console.example.com/verify-email?token=verify-token');
    expect(reset.text).toContain('https://console.example.com/user/reset?token=reset-token');
    expect(registration.text).toContain('https://console.example.com/verify-email?flow=registration&token=register-token');
    expect(registration.text).toContain('Verification code: 123456');
  });
});

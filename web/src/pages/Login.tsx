import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { useTranslation } from 'react-i18next';

import { StatusContext } from '../context/Status';
import { UserContext } from '../context/User';
import { api, type OAuthProvider } from '../lib/api';
import { getEnabledOAuthProviders, getOAuthProviderMeta } from '../lib/oauth';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useContext(UserContext);
  const { status } = useContext(StatusContext);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [oauthLoadingProvider, setOAuthLoadingProvider] = useState<OAuthProvider | null>(null);
  const [browserSupportsPasskey, setBrowserSupportsPasskey] = useState(false);
  const [challengeEmail, setChallengeEmail] = useState<string | null>(null);
  const [postLoginRedirectTo, setPostLoginRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    setBrowserSupportsPasskey(browserSupportsWebAuthn());
  }, []);

  const passkeyEnabled = status?.passkey?.enabled === true;
  const enabledOAuthProviders = getEnabledOAuthProviders(status);
  const redirectFromRouteState = (() => {
    const state = location.state;

    if (!state || typeof state !== 'object') {
      return null;
    }

    const record = state as Record<string, unknown>;
    return typeof record.redirectTo === 'string' ? record.redirectTo : null;
  })();
  const redirectTo = postLoginRedirectTo ?? redirectFromRouteState ?? '/console';

  useEffect(() => {
    const state = location.state;

    if (!state || typeof state !== 'object') {
      return;
    }

    const record = state as Record<string, unknown>;
    const twoFAEmail = typeof record.twoFAEmail === 'string' ? record.twoFAEmail : null;
    const redirectTo = typeof record.redirectTo === 'string' ? record.redirectTo : null;

    if (twoFAEmail) {
      setChallengeEmail(twoFAEmail);
      setPostLoginRedirectTo(redirectTo);
      navigate('/login', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  const loginWithOAuthProvider = async (provider: OAuthProvider) => {
    const providerName = getOAuthProviderMeta(provider, status).label;
    setOAuthLoadingProvider(provider);
    try {
      const response = await api.getOAuthState({ provider, redirectTo });
      window.location.assign(response.data.authorizeUrl);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('{{provider}} 登录失败', { provider: providerName }));
    } finally {
      setOAuthLoadingProvider(null);
    }
  };

  const loginWithPasskey = async () => {
    setPasskeyLoading(true);
    try {
      const beginResponse = await api.passkeyLoginBegin();
      const response = await startAuthentication({
        optionsJSON: beginResponse.item,
      });
      await api.passkeyLoginFinish({ response });
      await refresh();
      setChallengeEmail(null);
      Toast.success(t('Passkey 登录成功'));
      navigate(redirectTo);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('Passkey 登录失败'));
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>{t('登录')}</Typography.Title>
        <Typography.Paragraph type="tertiary">
          {enabledOAuthProviders.length > 0
            ? t('使用本地账号或第三方账号进入 NodEW-api 控制台。')
            : t('使用本地账号进入 NodEW-api 控制台。')}
        </Typography.Paragraph>
        {!challengeEmail && passkeyEnabled && browserSupportsPasskey ? (
          <div style={{ marginBottom: 16 }}>
            <Button theme="solid" type="primary" loading={passkeyLoading} onClick={() => void loginWithPasskey()} block>
              {t('使用 Passkey 登录')}
            </Button>
          </div>
        ) : null}
        {challengeEmail ? (
          <>
            <Typography.Paragraph type="tertiary">
              {t('账号')} <strong>{challengeEmail}</strong> {t('需要输入验证码或备用码完成登录。')}
            </Typography.Paragraph>
            <Form<{ code: string }>
              onSubmit={async (values) => {
                setLoading(true);
                try {
                  await api.verifyTwoFactorLogin({ code: values.code });
                  await refresh();
                  setChallengeEmail(null);
                  Toast.success(t('登录成功'));
                  navigate(redirectTo);
                } catch (error) {
                  Toast.error(error instanceof Error ? error.message : t('登录失败'));
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Form.Input field="code" label={t('验证码 / 备用码')} placeholder="123456" rules={[{ required: true }]} />
              <div className="auth-actions">
                <Button theme="borderless" onClick={() => setChallengeEmail(null)} disabled={loading}>{t('返回')}</Button>
                <Button htmlType="submit" theme="solid" loading={loading} block>{t('验证并登录')}</Button>
              </div>
            </Form>
          </>
        ) : (
          <Form<{ email: string; password: string }>
            onSubmit={async (values) => {
              setLoading(true);
              try {
                const response = await api.login({ email: values.email, password: values.password });

                if ('requiresTwoFA' in response && response.requiresTwoFA) {
                  setChallengeEmail(values.email);
                  setPostLoginRedirectTo(redirectTo);
                  Toast.info(t('请输入二次验证码完成登录'));
                  return;
                }

                await refresh();
                Toast.success(t('登录成功'));
                navigate(redirectTo);
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : t('登录失败'));
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Input field="email" label={t('邮箱')} placeholder="test@test.com" rules={[{ required: true }]} />
            <Form.Input field="password" label={t('密码')} mode="password" rules={[{ required: true }]} />
            {enabledOAuthProviders.map((provider) => {
              const providerName = getOAuthProviderMeta(provider, status).label;

              return (
                <div key={provider} style={{ marginBottom: 12 }}>
                  <Button
                    theme="light"
                    type="primary"
                    htmlType="button"
                    loading={oauthLoadingProvider === provider}
                    onClick={() => void loginWithOAuthProvider(provider)}
                    block
                  >
                    {t('使用 {{provider}} 登录', { provider: providerName })}
                  </Button>
                </div>
              );
            })}
            <div className="auth-actions">
              <Button htmlType="submit" theme="solid" loading={loading} block>{t('登录')}</Button>
            </div>
          </Form>
        )}
        <div className="auth-links">
          <Link to="/register">{t('注册')}</Link>
          <Link to="/reset">{t('忘记密码')}</Link>
        </div>
      </Card>
    </main>
  );
}

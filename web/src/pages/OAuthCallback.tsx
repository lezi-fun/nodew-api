import { Card, Spin, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { UserContext } from '../context/User';
import { api, type OAuthProvider } from '../lib/api';
import { isOAuthProviderSlug } from '../lib/oauth';

let oauthCallbackStarted = false;

export default function OAuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useContext(UserContext);
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const provider = useMemo(() => (typeof params.provider === 'string' ? params.provider : undefined), [params.provider]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (oauthCallbackStarted) {
        return;
      }

      oauthCallbackStarted = true;
      setLoading(true);
      try {
        const code = searchParams.get('code') ?? undefined;
        const state = searchParams.get('state') ?? undefined;
        const error = searchParams.get('error') ?? undefined;
        const errorDescription = searchParams.get('error_description') ?? undefined;

        if (!isOAuthProviderSlug(provider)) {
          throw new Error(t('不支持的第三方登录类型'));
        }

        const result = await api.oauthCallback(provider as OAuthProvider, {
          code,
          state,
          error,
          error_description: errorDescription,
        });

        if (cancelled) {
          return;
        }

        if ('requiresTwoFA' in result && result.requiresTwoFA) {
          Toast.info(t('请输入二次验证码完成登录'));
          navigate('/login', {
            replace: true,
            state: {
              twoFAEmail: result.email,
              redirectTo: result.redirectTo,
            },
          });
          return;
        }

        if ('action' in result && result.action === 'bind') {
          await refresh();

          if (cancelled) {
            return;
          }

          Toast.success(t('绑定成功'));
          navigate(result.redirectTo ?? '/console/personal', { replace: true });
          return;
        }

        await refresh();

        if (cancelled) {
          return;
        }

        Toast.success(t('登录成功'));
        navigate(('redirectTo' in result ? result.redirectTo : null) ?? '/console', { replace: true });
      } catch (error) {
        if (!cancelled) {
          Toast.error(error instanceof Error ? error.message : t('第三方登录失败'));
          navigate('/login', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [navigate, provider, refresh, searchParams, t]);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>{t('第三方登录')}</Typography.Title>
        <Typography.Paragraph type="tertiary">{t('正在处理回调，请稍候。')}</Typography.Paragraph>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <Spin spinning={loading} />
        </div>
      </Card>
    </main>
  );
}

import { Card, Spin, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { UserContext } from '../context/User';
import { api, type OAuthProvider } from '../lib/api';

const isOAuthProvider = (value: string | undefined): value is OAuthProvider => value === 'github' || value === 'discord' || value === 'linuxdo';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { refresh } = useContext(UserContext);
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const provider = useMemo(() => (typeof params.provider === 'string' ? params.provider : undefined), [params.provider]);

  useEffect(() => {
    const run = async () => {
      if (!isOAuthProvider(provider)) {
        Toast.error('不支持的第三方登录类型');
        navigate('/login', { replace: true });
        return;
      }

      setLoading(true);
      try {
        const code = searchParams.get('code') ?? undefined;
        const state = searchParams.get('state') ?? undefined;
        const error = searchParams.get('error') ?? undefined;
        const errorDescription = searchParams.get('error_description') ?? undefined;

        const result = await api.oauthCallback(provider, {
          code,
          state,
          error,
          error_description: errorDescription,
        });

        if ('requiresTwoFA' in result && result.requiresTwoFA) {
          Toast.info('请输入二次验证码完成登录');
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
          Toast.success('绑定成功');
          await refresh();
          navigate(result.redirectTo ?? '/console/personal', { replace: true });
          return;
        }

        await refresh();
        Toast.success('登录成功');
        navigate(('redirectTo' in result ? result.redirectTo : null) ?? '/console', { replace: true });
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : '第三方登录失败');
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [navigate, provider, refresh, searchParams]);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>第三方登录</Typography.Title>
        <Typography.Paragraph type="tertiary">正在处理回调，请稍候。</Typography.Paragraph>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <Spin spinning={loading} />
        </div>
      </Card>
    </main>
  );
}


import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { UserContext } from '../context/User';
import { api } from '../lib/api';

export default function VerifyEmailPage() {
  const { refresh } = useContext(UserContext);
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const flow = useMemo(() => params.get('flow') ?? 'account', [params]);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [registrationVerified, setRegistrationVerified] = useState(false);

  useEffect(() => {
    if (!token || verified || registrationVerified || loading) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        if (flow === 'registration') {
          await api.verifyRegistration({ token });

          if (!cancelled) {
            setRegistrationVerified(true);
            Toast.success('注册邮箱已验证，请返回注册页完成注册');
          }
        } else {
          await api.verifyEmail({ token });
          await refresh();

          if (!cancelled) {
            setVerified(true);
            Toast.success('邮箱已验证');
          }
        }
      } catch (error) {
        if (!cancelled) {
          Toast.error(error instanceof Error ? error.message : '验证失败');
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
  }, [flow, loading, refresh, registrationVerified, token, verified]);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>验证邮箱</Typography.Title>
        <Typography.Paragraph type="tertiary">
          {flow === 'registration' ? '打开邮件链接或输入验证码，完成注册前邮箱验证。' : '输入邮件中的 token 完成邮箱验证。'}
        </Typography.Paragraph>
        {verified || registrationVerified ? (
          <>
            <Typography.Paragraph>
              {flow === 'registration' ? '邮箱已验证，可以返回注册页完成注册。' : '邮箱已验证，可以继续登录使用。'}
            </Typography.Paragraph>
            <div className="auth-links">
              <Link to="/login">去登录</Link>
              {flow === 'registration' ? <Link to={`/register${token ? `?flow=registration&token=${encodeURIComponent(token)}` : ''}`}>返回注册</Link> : null}
              <Link to="/console/personal">个人设置</Link>
            </div>
          </>
        ) : (
          <Form<{ token: string }>
            initValues={{ token }}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                if (flow === 'registration') {
                  await api.verifyRegistration({ token: values.token });
                  setRegistrationVerified(true);
                  Toast.success('注册邮箱已验证，请返回注册页完成注册');
                } else {
                  await api.verifyEmail({ token: values.token });
                  await refresh();
                  setVerified(true);
                  Toast.success('邮箱已验证');
                }
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : '验证失败');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Input field="token" label="Token" rules={[{ required: true }]} />
            <Button htmlType="submit" theme="solid" loading={loading} block>验证邮箱</Button>
          </Form>
        )}
      </Card>
    </main>
  );
}

import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { UserContext } from '../context/User';
import { api } from '../lib/api';
import { createSharedRequestCache } from '../lib/shared-request';

type VerifyEmailResult = 'registration' | 'bind' | 'account';

const automaticVerificationRequests = createSharedRequestCache<VerifyEmailResult>();

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { refresh } = useContext(UserContext);
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const flow = useMemo(() => params.get('flow') ?? 'account', [params]);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [registrationVerified, setRegistrationVerified] = useState(false);
  const [bindingVerified, setBindingVerified] = useState(false);

  useEffect(() => {
    if (!token || verified || registrationVerified || bindingVerified) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<VerifyEmailResult> => {
      setLoading(true);
      if (flow === 'registration') {
        await api.verifyRegistration({ token });
        return 'registration';
      }

      if (flow === 'bind') {
        await api.verifyEmailBinding({ token });
        await refresh();
        return 'bind';
      }

      await api.verifyEmail({ token });
      await refresh();
      return 'account';
    };

    automaticVerificationRequests.run(JSON.stringify([flow, token]), run)
      .then((result) => {
        if (!cancelled) {
          if (result === 'registration') {
            setRegistrationVerified(true);
            Toast.success(t('注册邮箱已验证，请返回注册页完成注册'));
          } else if (result === 'bind') {
            setBindingVerified(true);
            Toast.success(t('新邮箱已绑定'));
          } else {
            setVerified(true);
            Toast.success(t('邮箱已验证'));
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          Toast.error(error instanceof Error ? error.message : t('验证失败'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bindingVerified, flow, refresh, registrationVerified, t, token, verified]);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>{t('验证邮箱')}</Typography.Title>
        <Typography.Paragraph type="tertiary">
          {flow === 'registration'
            ? t('打开邮件链接或输入验证码，完成注册前邮箱验证。')
            : flow === 'bind'
              ? t('请在已登录状态下打开邮件链接，或在个人设置里输入验证码完成邮箱绑定。')
              : t('输入邮件中的 token 完成邮箱验证。')}
        </Typography.Paragraph>
        {verified || registrationVerified || bindingVerified ? (
          <>
            <Typography.Paragraph>
              {flow === 'registration'
                ? t('邮箱已验证，可以返回注册页完成注册。')
                : flow === 'bind'
                  ? t('新邮箱已绑定，可以返回个人设置查看。')
                  : t('邮箱已验证，可以继续登录使用。')}
            </Typography.Paragraph>
            <div className="auth-links">
              <Link to="/login">{t('去登录')}</Link>
              {flow === 'registration' ? <Link to={`/register${token ? `?flow=registration&token=${encodeURIComponent(token)}` : ''}`}>{t('返回注册')}</Link> : null}
              <Link to="/console/personal">{t('个人设置')}</Link>
            </div>
          </>
        ) : (
          <Form<{ token: string }>
            initValues={{ token }}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                const result = await automaticVerificationRequests.run(
                  JSON.stringify([flow, values.token]),
                  async () => {
                    if (flow === 'registration') {
                      await api.verifyRegistration({ token: values.token });
                      return 'registration' as const;
                    }

                    if (flow === 'bind') {
                      await api.verifyEmailBinding({ token: values.token });
                      await refresh();
                      return 'bind' as const;
                    }

                    await api.verifyEmail({ token: values.token });
                    await refresh();
                    return 'account' as const;
                  },
                );

                if (result === 'registration') {
                  setRegistrationVerified(true);
                  Toast.success(t('注册邮箱已验证，请返回注册页完成注册'));
                } else if (result === 'bind') {
                  setBindingVerified(true);
                  Toast.success(t('新邮箱已绑定'));
                } else {
                  setVerified(true);
                  Toast.success(t('邮箱已验证'));
                }
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : t('验证失败'));
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Input field="token" label="Token" rules={[{ required: true }]} />
            <Button htmlType="submit" theme="solid" loading={loading} block>{t('验证邮箱')}</Button>
          </Form>
        )}
      </Card>
    </main>
  );
}

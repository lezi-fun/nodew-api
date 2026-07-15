import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { api, type SiteInfo } from '../lib/api';

type RegisterFormValues = {
  email: string;
  username: string;
  displayName?: string;
  password: string;
  verificationCode?: string;
};

const fallbackSite: SiteInfo = {
  siteName: 'NodEW-api',
  siteDescription: '',
  defaultModel: 'gpt-4o-mini',
  registrationEnabled: false,
  registrationEmailVerificationRequired: false,
  notice: '',
  userAgreement: '',
  privacyPolicy: '',
  about: '',
  homePageContent: '',
  links: {
    github: 'https://github.com/lezi-fun/nodew-api',
    preview: 'https://nodew.lezi.chat',
    upstream: 'https://github.com/songquanpeng/one-api',
  },
  stats: {
    users: 0,
    activeApiKeys: 0,
    channels: 0,
    activeChannels: 0,
  },
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [site, setSite] = useState<SiteInfo>(fallbackSite);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [prefillToken, setPrefillToken] = useState('');
  const [prefillCode, setPrefillCode] = useState('');

  const loadSiteInfo = useCallback(async () => {
    try {
      const response = await api.getSiteInfo();
      setSite(response.data);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('加载注册配置失败'));
    }
  }, [t]);

  useEffect(() => {
    void loadSiteInfo();
  }, [loadSiteInfo]);

  useEffect(() => {
    const flow = params.get('flow');
    const token = params.get('token') ?? '';

    if (flow === 'registration' && token) {
      setPrefillToken(token);
      setVerificationRequested(true);
    }
  }, [params]);

  const registrationRequiresVerification = site.registrationEnabled && site.registrationEmailVerificationRequired;

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>{t('注册')}</Typography.Title>
        <Typography.Paragraph type="tertiary">
          {registrationRequiresVerification ? t('先完成邮箱验证，再创建一个新的本地账号。') : t('创建一个新的本地账号。')}
        </Typography.Paragraph>
        <Form<RegisterFormValues>
          initValues={{
            email: '',
            username: '',
            password: '',
            verificationCode: prefillCode,
          }}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              if (registrationRequiresVerification) {
                await api.register({
                  email: values.email,
                  username: values.username,
                  password: values.password,
                  displayName: values.displayName,
                  verificationToken: prefillToken || undefined,
                  verificationCode: values.verificationCode?.trim() || undefined,
                });
                Toast.success(t('注册成功，邮箱已验证，可以直接登录'));
                navigate('/login');
                return;
              }

              await api.register({
                email: values.email,
                username: values.username,
                password: values.password,
                displayName: values.displayName,
              });
              Toast.success(t('注册成功，请登录后完成邮箱验证'));
              navigate('/login');
            } catch (error) {
              Toast.error(error instanceof Error ? error.message : t('注册失败'));
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ formApi, values }) => (
            <>
              <Form.Input field="email" label={t('邮箱')} rules={[{ required: true }]} />
              <Form.Input field="username" label={t('用户名')} rules={[{ required: true }]} />
              <Form.Input field="displayName" label={t('显示名称')} />
              <Form.Input field="password" label={t('密码')} mode="password" rules={[{ required: true }]} />
              {registrationRequiresVerification ? (
                <>
                  <Button
                    theme="light"
                    loading={requestingVerification}
                    onClick={async () => {
                      const email = values.email?.trim();
                      const username = values.username?.trim();
                      const password = values.password?.trim();

                      if (!email || !username || !password) {
                        Toast.error(t('请先填写邮箱、用户名和密码'));
                        return;
                      }

                      setRequestingVerification(true);
                      try {
                        const response = await api.requestRegistrationVerification({
                          email,
                          username,
                          password,
                          displayName: values.displayName?.trim() || undefined,
                        });
                        setVerificationRequested(true);
                        if (response.verificationToken) {
                          setPrefillToken(response.verificationToken);
                        }
                        if (response.verificationCode) {
                          setPrefillCode(response.verificationCode);
                          formApi.setValue('verificationCode', response.verificationCode);
                        }
                        Toast.success(t('验证邮件已发送，请点击邮件链接或输入验证码后完成注册'));
                      } catch (error) {
                        Toast.error(error instanceof Error ? error.message : t('发送验证邮件失败'));
                      } finally {
                        setRequestingVerification(false);
                      }
                    }}
                    block
                  >
                    {verificationRequested ? t('重新发送验证邮件') : t('发送验证邮件')}
                  </Button>
                  <Form.Input
                    field="verificationCode"
                    label={t('验证码')}
                    placeholder={t('输入邮件中的验证码，或点击邮件链接后直接提交')}
                    rules={[{ required: true }]}
                  />
                </>
              ) : null}
              <Button htmlType="submit" theme="solid" loading={loading} block>
                {registrationRequiresVerification ? t('完成注册') : t('注册')}
              </Button>
            </>
          )}
        </Form>
        <div className="auth-links">
          <Link to="/login">{t('返回登录')}</Link>
        </div>
      </Card>
    </main>
  );
}

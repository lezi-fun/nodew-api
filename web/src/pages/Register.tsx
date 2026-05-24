import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
      Toast.error(error instanceof Error ? error.message : '加载注册配置失败');
    }
  }, []);

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
        <Typography.Title heading={3}>注册</Typography.Title>
        <Typography.Paragraph type="tertiary">
          {registrationRequiresVerification ? '先完成邮箱验证，再创建一个新的本地账号。' : '创建一个新的本地账号。'}
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
                Toast.success('注册成功，邮箱已验证，可以直接登录');
                navigate('/login');
                return;
              }

              await api.register({
                email: values.email,
                username: values.username,
                password: values.password,
                displayName: values.displayName,
              });
              Toast.success('注册成功，请登录后完成邮箱验证');
              navigate('/login');
            } catch (error) {
              Toast.error(error instanceof Error ? error.message : '注册失败');
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ formApi, values }) => (
            <>
              <Form.Input field="email" label="邮箱" rules={[{ required: true }]} />
              <Form.Input field="username" label="用户名" rules={[{ required: true }]} />
              <Form.Input field="displayName" label="显示名称" />
              <Form.Input field="password" label="密码" mode="password" rules={[{ required: true }]} />
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
                        Toast.error('请先填写邮箱、用户名和密码');
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
                        Toast.success('验证邮件已发送，请点击邮件链接或输入验证码后完成注册');
                      } catch (error) {
                        Toast.error(error instanceof Error ? error.message : '发送验证邮件失败');
                      } finally {
                        setRequestingVerification(false);
                      }
                    }}
                    block
                  >
                    {verificationRequested ? '重新发送验证邮件' : '发送验证邮件'}
                  </Button>
                  <Form.Input
                    field="verificationCode"
                    label="验证码"
                    placeholder="输入邮件中的验证码，或点击邮件链接后直接提交"
                    rules={[{ required: true }]}
                  />
                </>
              ) : null}
              <Button htmlType="submit" theme="solid" loading={loading} block>
                {registrationRequiresVerification ? '完成注册' : '注册'}
              </Button>
            </>
          )}
        </Form>
        <div className="auth-links">
          <Link to="/login">返回登录</Link>
        </div>
      </Card>
    </main>
  );
}

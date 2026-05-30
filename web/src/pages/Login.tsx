import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { UserContext } from '../context/User';
import { api } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [challengeEmail, setChallengeEmail] = useState<string | null>(null);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>登录</Typography.Title>
        <Typography.Paragraph type="tertiary">使用本地账号进入 NodEW-api 控制台。</Typography.Paragraph>
        {challengeEmail ? (
          <>
            <Typography.Paragraph type="tertiary">
              账号 <strong>{challengeEmail}</strong> 需要输入验证码或备用码完成登录。
            </Typography.Paragraph>
            <Form<{ code: string }>
              onSubmit={async (values) => {
                setLoading(true);
                try {
                  await api.verifyTwoFactorLogin({ code: values.code });
                  await refresh();
                  setChallengeEmail(null);
                  Toast.success('登录成功');
                  navigate('/console');
                } catch (error) {
                  Toast.error(error instanceof Error ? error.message : '登录失败');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Form.Input field="code" label="验证码 / 备用码" placeholder="123456" rules={[{ required: true }]} />
              <div className="auth-actions">
                <Button theme="borderless" onClick={() => setChallengeEmail(null)} disabled={loading}>返回</Button>
                <Button htmlType="submit" theme="solid" loading={loading} block>验证并登录</Button>
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
                  Toast.info('请输入二次验证码完成登录');
                  return;
                }

                await refresh();
                Toast.success('登录成功');
                navigate('/console');
              } catch (error) {
                Toast.error(error instanceof Error ? error.message : '登录失败');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Input field="email" label="邮箱" placeholder="test@test.com" rules={[{ required: true }]} />
            <Form.Input field="password" label="密码" mode="password" rules={[{ required: true }]} />
            <div className="auth-actions">
              <Button htmlType="submit" theme="solid" loading={loading} block>登录</Button>
            </div>
          </Form>
        )}
        <div className="auth-links">
          <Link to="/register">注册</Link>
          <Link to="/reset">忘记密码</Link>
        </div>
      </Card>
    </main>
  );
}

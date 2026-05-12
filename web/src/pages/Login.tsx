import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { UserContext } from '../context/User';
import { api } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useContext(UserContext);
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>登录</Typography.Title>
        <Typography.Paragraph type="tertiary">使用本地账号进入 NodEW-api 控制台。</Typography.Paragraph>
        <Form<{ email: string; password: string }>
          onSubmit={async (values) => {
            setLoading(true);
            try {
              await api.login({ email: values.email, password: values.password });
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
        <div className="auth-links">
          <Link to="/register">注册</Link>
          <Link to="/reset">忘记密码</Link>
        </div>
      </Card>
    </main>
  );
}

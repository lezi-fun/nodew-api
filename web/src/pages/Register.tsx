import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../lib/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>注册</Typography.Title>
        <Typography.Paragraph type="tertiary">创建一个新的本地账号。</Typography.Paragraph>
        <Form<{ email: string; username: string; displayName?: string; password: string }>
          onSubmit={async (values) => {
            setLoading(true);
            try {
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
          <Form.Input field="email" label="邮箱" rules={[{ required: true }]} />
          <Form.Input field="username" label="用户名" rules={[{ required: true }]} />
          <Form.Input field="displayName" label="显示名称" />
          <Form.Input field="password" label="密码" mode="password" rules={[{ required: true }]} />
          <Button htmlType="submit" theme="solid" loading={loading} block>注册</Button>
        </Form>
        <div className="auth-links">
          <Link to="/login">返回登录</Link>
        </div>
      </Card>
    </main>
  );
}

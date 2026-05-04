import { Button, Card, Form, Typography } from '@douyinfe/semi-ui';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import { StatusContext } from '../context/Status';
import { UserContext } from '../context/User';
import { api } from '../lib/api';

export default function SetupPage() {
  const navigate = useNavigate();
  const { refresh: refreshStatus } = useContext(StatusContext);
  const { refresh: refreshUser } = useContext(UserContext);
  const [loading, setLoading] = useState(false);

  return (
    <main className="setup-page">
      <Card className="setup-card" bordered={false}>
        <Typography.Title heading={2}>初始化</Typography.Title>
        <Typography.Paragraph type="tertiary">
          创建首个管理员账号并完成系统初始化。
        </Typography.Paragraph>
        <Form<{ email: string; username: string; displayName?: string; password: string }>
          onSubmit={async (values) => {
            setLoading(true);
            try {
              await api.initialize({
                email: values.email,
                username: values.username,
                password: values.password,
                displayName: values.displayName,
              });
              await refreshStatus();
              await refreshUser();
              toast.success('初始化成功');
              navigate('/console');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : '初始化失败');
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Input field="email" label="邮箱" rules={[{ required: true }]} />
          <Form.Input field="username" label="用户名" rules={[{ required: true }]} />
          <Form.Input field="displayName" label="显示名称" />
          <Form.Input field="password" label="密码" mode="password" rules={[{ required: true }]} />
          <Button htmlType="submit" theme="solid" loading={loading} block>完成初始化</Button>
        </Form>
      </Card>
    </main>
  );
}

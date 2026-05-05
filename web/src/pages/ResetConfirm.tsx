import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../lib/api';

export default function ResetConfirmPage() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const token = useMemo(() => params.get('token') ?? '', [params]);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>设置新密码</Typography.Title>
        <Typography.Paragraph type="tertiary">使用邮件中的 token 完成密码更新。</Typography.Paragraph>
        <Form<{ token: string; password: string }>
          initValues={{ token, password: '' }}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              await api.resetPassword({ token: values.token, password: values.password });
              Toast.success('密码已更新');
            } catch (error) {
              Toast.error(error instanceof Error ? error.message : '更新失败');
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Input field="token" label="Token" rules={[{ required: true }]} />
          <Form.Input field="password" label="新密码" mode="password" rules={[{ required: true }]} />
          <Button htmlType="submit" theme="solid" loading={loading} block>更新密码</Button>
        </Form>
      </Card>
    </main>
  );
}

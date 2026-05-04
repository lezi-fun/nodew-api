import { Button, Card, Form, Typography } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { api } from '../lib/api';

export default function ResetPage() {
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>重置密码</Typography.Title>
        <Typography.Paragraph type="tertiary">输入邮箱后，系统会发送密码重置说明。</Typography.Paragraph>
        <Form<{ email: string }>
          onSubmit={async (values) => {
            setLoading(true);
            try {
              await api.forgotPassword({ email: values.email });
              toast.success('如果邮箱存在，重置说明已发送');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : '提交失败');
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Input field="email" label="邮箱" rules={[{ required: true }]} />
          <Button htmlType="submit" theme="solid" loading={loading} block>发送重置说明</Button>
        </Form>
      </Card>
    </main>
  );
}

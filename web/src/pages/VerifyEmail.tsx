import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { UserContext } from '../context/User';
import { api } from '../lib/api';

export default function VerifyEmailPage() {
  const { refresh } = useContext(UserContext);
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>验证邮箱</Typography.Title>
        <Typography.Paragraph type="tertiary">输入邮件中的 token 完成邮箱验证。</Typography.Paragraph>
        {verified ? (
          <>
            <Typography.Paragraph>邮箱已验证，可以继续登录使用。</Typography.Paragraph>
            <div className="auth-links">
              <Link to="/login">去登录</Link>
              <Link to="/console/personal">个人设置</Link>
            </div>
          </>
        ) : (
          <Form<{ token: string }>
            initValues={{ token }}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await api.verifyEmail({ token: values.token });
                await refresh();
                setVerified(true);
                Toast.success('邮箱已验证');
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

import { Button, Card, Form, Toast, Typography } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';

export default function ResetPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-page">
      <Card className="auth-card" bordered={false}>
        <Typography.Title heading={3}>{t('重置密码')}</Typography.Title>
        <Typography.Paragraph type="tertiary">{t('输入邮箱后，系统会发送密码重置说明。')}</Typography.Paragraph>
        <Form<{ email: string }>
          onSubmit={async (values) => {
            setLoading(true);
            try {
              await api.forgotPassword({ email: values.email });
              Toast.success(t('如果邮箱存在，重置说明已发送'));
            } catch (error) {
              Toast.error(error instanceof Error ? error.message : t('提交失败'));
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Input field="email" label={t('邮箱')} rules={[{ required: true }]} />
          <Button htmlType="submit" theme="solid" loading={loading} block>{t('发送重置说明')}</Button>
        </Form>
      </Card>
    </main>
  );
}

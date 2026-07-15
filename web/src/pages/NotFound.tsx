import { Button, Card, Typography } from '@douyinfe/semi-ui';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="page-shell simple-page">
      <Card>
        <Typography.Title heading={3}>404</Typography.Title>
        <Typography.Paragraph>{t('页面不存在。')}</Typography.Paragraph>
        <Button theme="solid" as={Link} to="/">{t('返回首页')}</Button>
      </Card>
    </main>
  );
}

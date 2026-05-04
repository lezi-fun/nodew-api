import { Button, Card, Typography } from '@douyinfe/semi-ui';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="page-shell simple-page">
      <Card>
        <Typography.Title heading={3}>404</Typography.Title>
        <Typography.Paragraph>页面不存在。</Typography.Paragraph>
        <Button theme="solid" as={Link} to="/">返回首页</Button>
      </Card>
    </main>
  );
}

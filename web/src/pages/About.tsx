import { Card, Typography } from '@douyinfe/semi-ui';

export default function AboutPage() {
  return (
    <main className="page-shell simple-page">
      <Card>
        <Typography.Title heading={3}>关于</Typography.Title>
        <Typography.Paragraph>查看项目与系统信息。</Typography.Paragraph>
      </Card>
    </main>
  );
}

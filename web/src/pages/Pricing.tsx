import { Card, Typography } from '@douyinfe/semi-ui';

export default function PricingPage() {
  return (
    <main className="page-shell simple-page">
      <Card>
        <Typography.Title heading={3}>Pricing</Typography.Title>
        <Typography.Paragraph>查看价格与套餐信息。</Typography.Paragraph>
      </Card>
    </main>
  );
}

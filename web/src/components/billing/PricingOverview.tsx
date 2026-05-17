import { Button, Card, Empty, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IllustrationNoResult } from '@douyinfe/semi-illustrations';
import { IconCreditCard, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';

import type { PricingInfo } from '../../lib/api';

type PricingOverviewProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionText: string;
  pricing: PricingInfo;
  loading: boolean;
  onRefresh: () => void;
};

export default function PricingOverview({
  eyebrow,
  title,
  description,
  actionText,
  pricing,
  loading,
  onRefresh,
}: PricingOverviewProps) {
  const navigate = useNavigate();

  return (
    <main className="console-page subscription-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">{eyebrow}</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>{title}</Typography.Title>
          <Typography.Paragraph className="console-description">
            {description}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => onRefresh()}>刷新</Button>
          <Button theme="solid" type="primary" icon={<IconCreditCard />} onClick={() => navigate('/console/topup')}>
            {actionText}
          </Button>
        </Space>
      </section>

      <section className="metric-grid">
        <Card className="metric-card tone-blue" bordered={false}><span>模型</span><strong>{pricing.stats.models}</strong></Card>
        <Card className="metric-card tone-green" bordered={false}><span>活跃渠道</span><strong>{pricing.stats.activeChannels}</strong></Card>
        <Card className="metric-card tone-grey" bordered={false}><span>总渠道</span><strong>{pricing.stats.channels}</strong></Card>
        <Card className="metric-card tone-orange" bordered={false}><span>计费单位</span><strong>{pricing.currency}</strong></Card>
      </section>

      <section className="plan-grid">
        {pricing.plans.length > 0 ? pricing.plans.map((plan) => (
          <Card key={plan.id} bordered={false} className="dashboard-card plan-card">
            <Space vertical align="start">
              <Tag color={plan.current ? 'green' : 'blue'}>{plan.current ? 'current' : 'available'}</Tag>
              <Typography.Title heading={3}>{plan.name}</Typography.Title>
              <strong>{plan.quota}</strong>
              <Typography.Paragraph type="tertiary">{pricing.note}</Typography.Paragraph>
              <div className="plan-feature-list">
                {plan.features.map((feature) => (
                  <span key={feature}><IconTickCircle /> {feature}</span>
                ))}
              </div>
            </Space>
          </Card>
        )) : (
          <Card bordered={false} className="dashboard-card">
            <Empty
              description="当前没有可展示的订阅计划"
              image={<IllustrationNoResult style={{ width: 120, height: 120 }} />}
            />
          </Card>
        )}
      </section>
    </main>
  );
}

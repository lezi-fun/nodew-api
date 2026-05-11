import { Button, Card, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconCreditCard, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, type PricingInfo } from '../lib/api';

const fallbackPricing: PricingInfo = {
  currency: 'quota',
  plans: [],
  stats: {
    channels: 0,
    activeChannels: 0,
    models: 0,
  },
  note: '订阅计划暂不可用。',
};

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState<PricingInfo>(fallbackPricing);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getPricing();
      setPricing(response.data);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载订阅信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="console-page subscription-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Subscription</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>订阅管理</Typography.Title>
          <Typography.Paragraph className="console-description">
            从后端价格接口读取当前实例的计划、额度单位和渠道覆盖，避免订阅入口停留在静态占位。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void load()}>刷新</Button>
          <Button theme="solid" type="primary" icon={<IconCreditCard />} onClick={() => navigate('/console/topup')}>
            前往充值
          </Button>
        </Space>
      </section>

      <section className="metric-grid">
        <Card className="metric-card tone-blue" bordered={false}><span>模型</span><strong>{pricing.stats.models}</strong></Card>
        <Card className="metric-card tone-green" bordered={false}><span>活跃渠道</span><strong>{pricing.stats.activeChannels}</strong></Card>
        <Card className="metric-card tone-grey" bordered={false}><span>总渠道</span><strong>{pricing.stats.channels}</strong></Card>
        <Card className="metric-card tone-orange" bordered={false}><span>额度单位</span><strong>{pricing.currency}</strong></Card>
      </section>

      <section className="plan-grid">
        {pricing.plans.map((plan) => (
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
        ))}
      </section>
    </main>
  );
}

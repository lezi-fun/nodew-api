import { Button, Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconCreditCard, IconTickCircle } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    quota: '按兑换码充值',
    desc: '适合个人测试和小规模接入。',
    features: ['OpenAI 兼容接口', 'SSE 流式转发', '基础日志'],
    current: true,
  },
  {
    name: 'Team',
    quota: '团队额度池',
    desc: '适合团队共享渠道和统一审计。',
    features: ['多用户管理', '共享额度策略', '渠道权重路由'],
  },
  {
    name: 'Business',
    quota: '商业部署',
    desc: '适合生产网关和私有化运营。',
    features: ['高级计费', '模型倍率', '审计与告警'],
  },
];

export default function SubscriptionPage() {
  const navigate = useNavigate();

  return (
    <main className="console-page subscription-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Subscription</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>订阅管理</Typography.Title>
          <Typography.Paragraph className="console-description">
            对齐原版订阅入口。当前后端未提供订阅计划 API，因此先提供可落地的计划展示和后续接入位。
          </Typography.Paragraph>
        </div>
        <Button theme="solid" type="primary" icon={<IconCreditCard />} onClick={() => navigate('/console/topup')}>
          前往充值
        </Button>
      </section>

      <section className="plan-grid">
        {plans.map((plan) => (
          <Card key={plan.name} bordered={false} className="dashboard-card plan-card">
            <Space vertical align="start">
              <Tag color={plan.current ? 'green' : 'blue'}>{plan.current ? 'current' : 'available'}</Tag>
              <Typography.Title heading={3}>{plan.name}</Typography.Title>
              <strong>{plan.quota}</strong>
              <Typography.Paragraph type="tertiary">{plan.desc}</Typography.Paragraph>
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

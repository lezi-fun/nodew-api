import { Button, Card, Empty, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IllustrationNoResult } from '@douyinfe/semi-illustrations';
import { IconCreditCard, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api, type SubscriptionPlanItem, type UserSubscriptionItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResponse, subscriptionsResponse] = await Promise.all([
        api.listSubscriptionPlans(),
        api.getSelfSubscriptions(),
      ]);
      setPlans(plansResponse.items ?? []);
      setSubscriptions(subscriptionsResponse.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载订阅信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const stripeResult = searchParams.get('stripe');

    if (stripeResult === 'success') {
      Toast.info('支付完成后会通过回调激活订阅，请稍后刷新');
      setSearchParams((current) => {
        current.delete('stripe');
        current.delete('order');
        return current;
      }, { replace: true });
    }

    if (stripeResult === 'cancel') {
      Toast.warning('订阅支付已取消');
      setSearchParams((current) => {
        current.delete('stripe');
        current.delete('order');
        return current;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const empty = plans.length === 0;

  const purchaseWithStripe = async (planId: string) => {
    setPurchasingPlanId(planId);
    try {
      const response = await api.createSubscriptionStripeCheckout({ planId });
      window.location.assign(response.checkoutUrl);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '创建订阅支付失败');
    } finally {
      setPurchasingPlanId(null);
    }
  };

  return (
    <main className="console-page subscription-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Subscription</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>订阅管理</Typography.Title>
          <Typography.Paragraph className="console-description">
            这里展示后台已发布的订阅套餐，支持发起 Stripe 支付并在回调完成后激活订阅。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void load()}>刷新</Button>
          <Button theme="solid" type="primary" icon={<IconCreditCard />} onClick={() => navigate('/console/topup')}>
            前往钱包
          </Button>
        </Space>
      </section>

      {subscriptions.length > 0 ? (
        <section className="plan-grid" style={{ marginBottom: 16 }}>
          {subscriptions.map((subscription) => (
            <Card key={subscription.id} bordered={false} className="dashboard-card plan-card">
              <Space vertical align="start" style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="green">生效中</Tag>
                  <Tag>{subscription.provider}</Tag>
                </Space>
                <Typography.Title heading={4} style={{ marginBottom: 0 }}>{subscription.title}</Typography.Title>
                {subscription.quota ? <Typography.Text>{subscription.quota}</Typography.Text> : null}
                <Typography.Text type="tertiary">
                  开通时间 {formatDateTime(subscription.startAt)}{subscription.endAt ? ` · 到期 ${formatDateTime(subscription.endAt)}` : ''}
                </Typography.Text>
                {subscription.quotaAmount !== '0' ? (
                  <Typography.Text type="tertiary">附带额度 {formatQuota(subscription.quotaAmount)}</Typography.Text>
                ) : null}
              </Space>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="plan-grid">
        {empty ? (
          <Card bordered={false} className="dashboard-card">
            <Empty
              description="当前还没有可用的订阅套餐，请先到系统设置中配置。"
              image={<IllustrationNoResult style={{ width: 120, height: 120 }} />}
            />
          </Card>
        ) : plans.map((plan) => (
          <Card key={plan.id} bordered={false} className="dashboard-card plan-card">
            <Space vertical align="start" style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">{plan.badge || '套餐'}</Tag>
                <Tag>{plan.duration || '周期待定'}</Tag>
              </Space>
              <Typography.Title heading={3} style={{ marginBottom: 0 }}>{plan.title}</Typography.Title>
              {plan.subtitle ? (
                <Typography.Text type="secondary">{plan.subtitle}</Typography.Text>
              ) : null}
              <Typography.Title heading={2} style={{ margin: '4px 0 0' }}>
                {plan.priceAmount > 0 ? `${plan.priceAmount} ${plan.currency}` : '免费'}
              </Typography.Title>
              {plan.quota ? (
                <Typography.Paragraph className="wallet-plan-quota">{plan.quota}</Typography.Paragraph>
              ) : null}
              {plan.description ? (
                <Typography.Paragraph type="tertiary">{plan.description}</Typography.Paragraph>
              ) : null}
              <div className="plan-feature-list">
                {plan.features.map((feature) => (
                  <span key={feature}><IconTickCircle /> {feature}</span>
                ))}
              </div>
              <Button
                theme="solid"
                type="primary"
                loading={purchasingPlanId === plan.id}
                disabled={plan.priceAmount <= 0}
                onClick={() => void purchaseWithStripe(plan.id)}
              >
                {plan.priceAmount > 0 ? '立即订阅' : '暂不可购买'}
              </Button>
            </Space>
          </Card>
        ))}
      </section>
    </main>
  );
}

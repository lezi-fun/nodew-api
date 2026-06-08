import { Button, Card, Input, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconCreditCard, IconGift, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { UserContext } from '../context/User';
import { api, type CreemTopUpConfig, type PricingInfo, type StripeTopUpConfig } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

const fallbackPricing: PricingInfo = {
  currency: 'quota',
  plans: [],
  stats: {
    channels: 0,
    activeChannels: 0,
    models: 0,
  },
  note: '充值信息暂不可用。',
};

const paymentMethods = [
  {
    key: 'stripe',
    name: 'Stripe',
    description: '国际卡与 Stripe Checkout，下一项会接入支付会话。',
  },
  {
    key: 'creem',
    name: 'Creem',
    description: '适合订阅与一次性付款，后续会接入产品 ID 与回调。',
  },
  {
    key: 'waffo',
    name: 'Waffo',
    description: '适合本地化支付方式，后续会接入支付方法列表。',
  },
];

const fallbackStripeConfig: StripeTopUpConfig = {
  enabled: false,
  configured: false,
  currency: 'usd',
  quotaPerUnit: 100000,
  unitAmountCents: 100,
  minUnits: 1,
};

const fallbackCreemConfig: CreemTopUpConfig = {
  enabled: false,
  configured: false,
  webhookConfigured: false,
  testMode: false,
  products: [],
};

export default function TopUpPage() {
  const { user, refresh } = useContext(UserContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [pricing, setPricing] = useState<PricingInfo>(fallbackPricing);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [stripeConfig, setStripeConfig] = useState<StripeTopUpConfig>(fallbackStripeConfig);
  const [stripeUnits, setStripeUnits] = useState('1');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [creemConfig, setCreemConfig] = useState<CreemTopUpConfig>(fallbackCreemConfig);

  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const [pricingResponse, stripeResponse, creemResponse] = await Promise.all([
        api.getPricing(),
        api.getStripeTopUpConfig(),
        api.getCreemTopUpConfig(),
      ]);
      const minUnits = Math.max(1, stripeResponse.item.minUnits);
      setPricing(pricingResponse.data);
      setStripeConfig(stripeResponse.item);
      setCreemConfig(creemResponse.item);
      setStripeUnits((current) => {
        const parsed = Number(current);
        return Number.isInteger(parsed) && parsed >= minUnits ? current : String(minUnits);
      });
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载充值信息失败');
    } finally {
      setPricingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  useEffect(() => {
    const result = searchParams.get('stripe');

    if (result === 'success') {
      Toast.info('Stripe 支付完成后会通过 webhook 入账，请稍后刷新余额');
      setSearchParams((current) => {
        current.delete('stripe');
        current.delete('order');
        return current;
      }, { replace: true });
    }

    if (result === 'cancel') {
      Toast.warning('Stripe 支付已取消');
      setSearchParams((current) => {
        current.delete('stripe');
        current.delete('order');
        return current;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const redeem = async () => {
    if (!code.trim()) {
      Toast.error('请输入兑换码');
      return;
    }

    setRedeeming(true);
    try {
      await api.redeemCode({ code: code.trim() });
      setCode('');
      await refresh();
      Toast.success('兑换成功');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '兑换失败');
    } finally {
      setRedeeming(false);
    }
  };

  const refreshWallet = async () => {
    await Promise.all([
      refresh(),
      loadPricing(),
    ]);
  };

  const showPaymentPending = (method: string) => {
    Toast.info(`${method} 支付会在下一步接入`);
  };

  const createStripeCheckout = async () => {
    const units = Number(stripeUnits);

    if (!Number.isInteger(units) || units < stripeConfig.minUnits) {
      Toast.error(`Stripe 充值至少需要 ${stripeConfig.minUnits} 份`);
      return;
    }

    setStripeLoading(true);
    try {
      const response = await api.createStripeCheckout({ units });
      window.location.assign(response.checkoutUrl);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '创建 Stripe 支付失败');
    } finally {
      setStripeLoading(false);
    }
  };

  const stripeUnitsNumber = Number(stripeUnits);
  const stripePreviewUnits = Number.isFinite(stripeUnitsNumber) ? Math.max(stripeConfig.minUnits, stripeUnitsNumber) : stripeConfig.minUnits;
  const stripePreviewQuota = BigInt(Math.trunc(stripePreviewUnits)) * BigInt(stripeConfig.quotaPerUnit);
  const stripePreviewAmount = (Math.trunc(stripePreviewUnits) * stripeConfig.unitAmountCents / 100).toFixed(2);

  return (
    <main className="console-page topup-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Wallet</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>钱包管理</Typography.Title>
          <Typography.Paragraph className="console-description">
            查看余额、充值套餐、支付方式和兑换码入口。在线支付接入前，兑换码仍是当前可用的充值方式。
          </Typography.Paragraph>
        </div>
        <Button icon={<IconRefresh />} loading={pricingLoading} onClick={() => void refreshWallet()}>刷新充值信息</Button>
      </section>

      <section className="dashboard-grid">
        <Card bordered={false} className="metric-card tone-green">
          <span>剩余额度</span>
          <strong>{formatQuota(user?.quotaRemaining)}</strong>
        </Card>
        <Card bordered={false} className="metric-card tone-orange">
          <span>已用额度</span>
          <strong>{formatQuota(user?.quotaUsed)}</strong>
        </Card>
        <Card bordered={false} className="metric-card tone-grey">
          <span>最近登录</span>
          <strong>{formatDateTime(user?.lastLoginAt)}</strong>
        </Card>
      </section>

      <section className="wallet-page-grid">
        <div className="wallet-main-column">
          <Card
            title={<span className="wallet-card-title"><IconCreditCard /> 充值套餐</span>}
            bordered={false}
            className="dashboard-card wallet-card"
          >
            <Typography.Paragraph type="tertiary">
              当前从后端价格接口读取套餐和额度单位，后续支付会直接复用这些计划。
            </Typography.Paragraph>
            <div className="wallet-plan-grid">
              {pricing.plans.length > 0 ? pricing.plans.map((plan) => (
                <div key={plan.id} className="wallet-plan-card">
                  <div className="wallet-plan-heading">
                    <Tag color={plan.current ? 'green' : 'blue'}>{plan.current ? '当前方案' : '可选方案'}</Tag>
                    <strong>{plan.price > 0 ? `${plan.price} ${pricing.currency}` : '当前实例'}</strong>
                  </div>
                  <Typography.Title heading={4}>{plan.name}</Typography.Title>
                  <Typography.Paragraph className="wallet-plan-quota">{plan.quota}</Typography.Paragraph>
                  <div className="wallet-feature-list">
                    {plan.features.map((feature) => (
                      <span key={feature}><IconTickCircle /> {feature}</span>
                    ))}
                  </div>
                  <Button disabled onClick={() => showPaymentPending(plan.name)}>
                    支付接入中
                  </Button>
                </div>
              )) : (
                <div className="wallet-plan-card wallet-plan-empty">
                  <Typography.Title heading={4}>暂无充值套餐</Typography.Title>
                  <Typography.Paragraph type="tertiary">
                    后台价格接口还没有返回可展示的计划。兑换码充值仍可使用。
                  </Typography.Paragraph>
                </div>
              )}
            </div>
          </Card>

          <Card
            title={<span className="wallet-card-title"><IconCreditCard /> 支付方式</span>}
            bordered={false}
            className="dashboard-card wallet-card"
          >
            <Typography.Paragraph type="tertiary">
              阶段四会逐步接入 Stripe、Creem 和 Waffo。当前页面先展示入口状态，避免用户误以为已经拉起真实支付。
            </Typography.Paragraph>
            <div className="wallet-payment-grid">
              {paymentMethods.map((method) => (
                <div key={method.key} className="wallet-payment-card">
                  <div>
                    <strong>{method.name}</strong>
                    <Tag color={(
                      (method.key === 'stripe' && stripeConfig.enabled) ||
                      (method.key === 'creem' && creemConfig.enabled)
                    ) ? 'green' : 'grey'}>
                      {(
                        (method.key === 'stripe' && stripeConfig.enabled) ||
                        (method.key === 'creem' && creemConfig.enabled)
                      ) ? '已配置' : '待接入'}
                    </Tag>
                  </div>
                  <Typography.Text type="tertiary">{method.description}</Typography.Text>
                  {method.key === 'stripe' ? (
                    <div className="wallet-stripe-form">
                      <Input
                        value={stripeUnits}
                        placeholder={String(stripeConfig.minUnits)}
                        disabled={!stripeConfig.enabled}
                        onChange={setStripeUnits}
                        suffix="份"
                      />
                      <Typography.Text type="tertiary">
                        预计获得 {formatQuota(stripePreviewQuota)} quota，支付 {stripePreviewAmount} {stripeConfig.currency.toUpperCase()}
                      </Typography.Text>
                      <Button
                        theme="solid"
                        type="primary"
                        loading={stripeLoading}
                        disabled={!stripeConfig.enabled}
                        onClick={() => void createStripeCheckout()}
                      >
                        前往 Stripe Checkout
                      </Button>
                    </div>
                  ) : (
                    <>
                      {method.key === 'creem' && creemConfig.configured && (
                        <Typography.Text type="tertiary">
                          已配置 {creemConfig.products.length} 个固定金额产品，支付会话下一步接入
                        </Typography.Text>
                      )}
                      <Button theme="light" onClick={() => showPaymentPending(method.name)}>查看状态</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="wallet-side-column">
          <Card
            title={<span className="wallet-card-title"><IconGift /> 兑换码充值</span>}
            bordered={false}
            className="dashboard-card wallet-card"
          >
            <Typography.Paragraph type="tertiary">
              输入管理员生成的兑换码，成功后额度会立即写入当前账户。
            </Typography.Paragraph>
            <Space className="wallet-redeem-row" align="center">
              <Input value={code} placeholder="nodew-xxxx-xxxx" onChange={setCode} />
              <Button theme="solid" type="primary" loading={redeeming} onClick={() => void redeem()}>
                立即兑换
              </Button>
            </Space>
          </Card>

          <Card bordered={false} className="dashboard-card wallet-card">
            <Typography.Title heading={5}>充值说明</Typography.Title>
            <div className="wallet-help-list">
              <span>计费单位：{pricing.currency}</span>
              <span>可用模型：{pricing.stats.models}</span>
              <span>活跃渠道：{pricing.stats.activeChannels} / {pricing.stats.channels}</span>
              <span>{pricing.note}</span>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

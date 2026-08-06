import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';

import type { CreemTopUpConfig, StripeTopUpConfig, WaffoTopUpConfig } from '../../../lib/api';

type PaymentChannelStatusGridProps = {
  stripe: StripeTopUpConfig;
  creem: CreemTopUpConfig;
  waffo: WaffoTopUpConfig;
};

const formatPaymentAmount = (amountCents: number, currency: string) =>
  `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;

export default function PaymentChannelStatusGrid({
  stripe,
  creem,
  waffo,
}: PaymentChannelStatusGridProps) {
  return (
    <div className="settings-grid" style={{ width: '100%' }}>
      <Card bordered>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space wrap>
            <Typography.Text strong>Stripe</Typography.Text>
            <Tag color={stripe.enabled ? 'green' : 'grey'}>{stripe.enabled ? '已启用' : '未启用'}</Tag>
            <Tag color={stripe.configured ? 'blue' : 'orange'}>{stripe.configured ? '配置完整' : '待配置'}</Tag>
          </Space>
          <Typography.Text type="tertiary">国际卡与 Stripe Checkout 单次充值。</Typography.Text>
          <Typography.Text>单价：{formatPaymentAmount(stripe.unitAmountCents, stripe.currency)}</Typography.Text>
          <Typography.Text>最少购买份数：{stripe.minUnits}</Typography.Text>
          <Typography.Text>每份入账额度：{stripe.quotaPerUnit.toLocaleString('zh-CN')}</Typography.Text>
        </Space>
      </Card>

      <Card bordered>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space wrap>
            <Typography.Text strong>Creem</Typography.Text>
            <Tag color={creem.enabled ? 'green' : 'grey'}>{creem.enabled ? '已启用' : '未启用'}</Tag>
            <Tag color={creem.configured ? 'blue' : 'orange'}>{creem.configured ? '配置完整' : '待配置'}</Tag>
            <Tag color={creem.webhookConfigured ? 'cyan' : 'red'}>{creem.webhookConfigured ? 'Webhook 就绪' : 'Webhook 缺失'}</Tag>
            {creem.testMode ? <Tag color="purple">测试模式</Tag> : null}
          </Space>
          <Typography.Text type="tertiary">托管支付产品目录，适合预设档位充值。</Typography.Text>
          <Typography.Text>可售产品数：{creem.products.length}</Typography.Text>
          {creem.products.length > 0 ? (
            <Space vertical align="start" spacing="tight" style={{ width: '100%' }}>
              {creem.products.slice(0, 3).map((product) => (
                <Typography.Text key={product.productId}>
                  {product.name} · {formatPaymentAmount(product.amountCents, product.currency)} · {product.quotaAmount.toLocaleString('zh-CN')} 额度
                </Typography.Text>
              ))}
            </Space>
          ) : (
            <Typography.Text type="tertiary">当前还没有可售产品。</Typography.Text>
          )}
        </Space>
      </Card>

      <Card bordered>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space wrap>
            <Typography.Text strong>Waffo</Typography.Text>
            <Tag color={waffo.enabled ? 'green' : 'grey'}>{waffo.enabled ? '已启用' : '未启用'}</Tag>
            <Tag color={waffo.configured ? 'blue' : 'orange'}>{waffo.configured ? '配置完整' : '待配置'}</Tag>
            <Tag color={waffo.webhookConfigured ? 'cyan' : 'red'}>{waffo.webhookConfigured ? 'Webhook 就绪' : 'Webhook 缺失'}</Tag>
            {waffo.testMode ? <Tag color="purple">测试模式</Tag> : null}
          </Space>
          <Typography.Text type="tertiary">本地化支付方式目录，按后台产品配置跳转支付。</Typography.Text>
          <Typography.Text>可售产品数：{waffo.products.length}</Typography.Text>
          {waffo.products.length > 0 ? (
            <Space vertical align="start" spacing="tight" style={{ width: '100%' }}>
              {waffo.products.slice(0, 3).map((product) => (
                <Typography.Text key={product.productId}>
                  {product.name} · {formatPaymentAmount(product.amountCents, product.currency)} · {product.quotaAmount.toLocaleString('zh-CN')} 额度
                </Typography.Text>
              ))}
            </Space>
          ) : (
            <Typography.Text type="tertiary">当前还没有可售产品。</Typography.Text>
          )}
        </Space>
      </Card>
    </div>
  );
}

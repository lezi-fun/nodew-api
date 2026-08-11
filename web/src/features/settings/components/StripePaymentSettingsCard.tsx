import { Card, Input, InputNumber, Space, Switch, Typography } from '@douyinfe/semi-ui';

import type { PaymentConfig } from '../../../lib/api';

type StripePaymentSettingsCardProps = {
  appBaseUrl: string;
  stripe: PaymentConfig['stripe'];
  onAppBaseUrlChange: (value: string) => void;
  onStripeChange: (patch: Partial<PaymentConfig['stripe']>) => void;
};

export default function StripePaymentSettingsCard({
  appBaseUrl,
  stripe,
  onAppBaseUrlChange,
  onStripeChange,
}: StripePaymentSettingsCardProps) {
  const update = <K extends keyof PaymentConfig['stripe']>(key: K, value: PaymentConfig['stripe'][K]) => {
    onStripeChange({ [key]: value } as Partial<PaymentConfig['stripe']>);
  };

  return (
    <Card bordered style={{ width: '100%' }}>
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Title heading={5} style={{ marginBottom: 4 }}>支付基础与 Stripe</Typography.Title>
        <label className="setting-field">
          <span><strong>应用回调地址</strong><em>支付成功、取消和 webhook 回调使用的公开站点地址。</em></span>
          <Input value={appBaseUrl} placeholder="https://example.com" onChange={onAppBaseUrlChange} />
        </label>
        <div className="settings-grid" style={{ width: '100%' }}>
          <label className="setting-field">
            <span><strong>启用 Stripe</strong><em>密钥和回调地址完整时才会对用户开放。</em></span>
            <Switch checked={stripe.enabled} onChange={(enabled) => update('enabled', enabled)} />
          </label>
          <label className="setting-field">
            <span><strong>Stripe Secret Key</strong><em>{stripe.hasSecretKey ? '已配置，留空保持不变。' : '尚未配置。'}</em></span>
            <Input value={stripe.secretKey} placeholder="留空保持原密钥" onChange={(secretKey) => update('secretKey', secretKey)} />
          </label>
          <label className="setting-field">
            <span><strong>Stripe Webhook Secret</strong><em>{stripe.hasWebhookSecret ? '已配置，留空保持不变。' : '尚未配置。'}</em></span>
            <Input value={stripe.webhookSecret} placeholder="留空保持原密钥" onChange={(webhookSecret) => update('webhookSecret', webhookSecret)} />
          </label>
          <label className="setting-field">
            <span><strong>币种</strong><em>三位币种代码。</em></span>
            <Input value={stripe.currency} onChange={(currency) => update('currency', currency)} />
          </label>
          <label className="setting-field">
            <span><strong>每份额度</strong><em>每购买一份增加的额度。</em></span>
            <InputNumber min={1} value={stripe.quotaPerUnit} onChange={(value) => update('quotaPerUnit', Number(value ?? 1))} />
          </label>
          <label className="setting-field">
            <span><strong>每份价格（分）</strong><em>Stripe Checkout 的最小计价单位。</em></span>
            <InputNumber min={1} value={stripe.unitAmountCents} onChange={(value) => update('unitAmountCents', Number(value ?? 1))} />
          </label>
          <label className="setting-field">
            <span><strong>最少份数</strong><em>单次充值允许购买的最小份数。</em></span>
            <InputNumber min={1} value={stripe.minUnits} onChange={(value) => update('minUnits', Number(value ?? 1))} />
          </label>
        </div>
      </Space>
    </Card>
  );
}

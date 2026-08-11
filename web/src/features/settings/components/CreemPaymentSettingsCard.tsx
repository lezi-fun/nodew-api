import { Card, Input, Space, Switch, TextArea, Typography } from '@douyinfe/semi-ui';

import type { PaymentConfig } from '../../../lib/api';

type CreemPaymentSettingsCardProps = {
  config: PaymentConfig['creem'];
  productsText: string;
  onConfigChange: (patch: Partial<PaymentConfig['creem']>) => void;
  onProductsTextChange: (value: string) => void;
};

export default function CreemPaymentSettingsCard({
  config,
  productsText,
  onConfigChange,
  onProductsTextChange,
}: CreemPaymentSettingsCardProps) {
  const update = <K extends keyof PaymentConfig['creem']>(key: K, value: PaymentConfig['creem'][K]) => {
    onConfigChange({ [key]: value } as Partial<PaymentConfig['creem']>);
  };

  return (
    <Card bordered>
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Title heading={5} style={{ marginBottom: 4 }}>Creem 设置</Typography.Title>
        <Space wrap>
          <Switch checked={config.enabled} onChange={(enabled) => update('enabled', enabled)} />
          <span>启用 Creem</span>
          <Switch checked={config.testMode} onChange={(testMode) => update('testMode', testMode)} />
          <span>测试模式</span>
        </Space>
        <Input
          value={config.apiKey}
          placeholder={config.hasApiKey ? 'API Key 已配置，留空保持不变' : 'Creem API Key'}
          onChange={(apiKey) => update('apiKey', apiKey)}
        />
        <Input
          value={config.webhookSecret}
          placeholder={config.hasWebhookSecret ? 'Webhook Secret 已配置，留空保持不变' : 'Creem Webhook Secret'}
          onChange={(webhookSecret) => update('webhookSecret', webhookSecret)}
        />
        <TextArea
          rows={10}
          value={productsText}
          onChange={onProductsTextChange}
          placeholder="Creem 产品 JSON 数组"
        />
      </Space>
    </Card>
  );
}

import { Toast } from '@douyinfe/semi-ui';
import { useCallback, useEffect, useState } from 'react';

import PricingOverview from '../components/billing/PricingOverview';
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
    <PricingOverview
      eyebrow="Subscription"
      title="订阅管理"
      description="从后端价格接口读取当前实例的计划、额度单位和渠道覆盖，避免订阅入口停留在静态占位。"
      actionText="前往充值"
      pricing={pricing}
      loading={loading}
      onRefresh={() => void load()}
    />
  );
}

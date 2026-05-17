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
  note: '价格信息暂不可用。',
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingInfo>(fallbackPricing);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getPricing();
      setPricing(response.data);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载价格信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PricingOverview
      eyebrow="Pricing"
      title="价格与额度"
      description="当前实例使用 quota 额度计费模型，价格页从后端公开配置读取，避免前端静态漂移。"
      actionText="前往充值"
      pricing={pricing}
      loading={loading}
      onRefresh={() => void load()}
    />
  );
}

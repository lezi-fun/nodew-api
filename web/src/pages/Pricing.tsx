import { Toast } from '@douyinfe/semi-ui';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import PricingOverview from '../components/billing/PricingOverview';
import { api, type PricingInfo } from '../lib/api';

const createFallbackPricing = (note: string): PricingInfo => ({
  currency: 'quota',
  plans: [],
  stats: {
    channels: 0,
    activeChannels: 0,
    models: 0,
  },
  note,
});

export default function PricingPage() {
  const { t } = useTranslation();
  const [pricing, setPricing] = useState<PricingInfo>(() => createFallbackPricing(t('价格信息暂不可用。')));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getPricing();
      setPricing(response.data);
    } catch (error) {
      setPricing(createFallbackPricing(t('价格信息暂不可用。')));
      Toast.error(error instanceof Error ? error.message : t('加载价格信息失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PricingOverview
      eyebrow="Pricing"
      title={t('价格与额度')}
      description={t('当前实例使用 quota 额度计费模型，价格页从后端公开配置读取，避免前端静态漂移。')}
      actionText={t('前往充值')}
      pricing={pricing}
      loading={loading}
      onRefresh={() => void load()}
    />
  );
}

import { Button, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type ChannelItem } from '../lib/api';

type ModelRow = {
  id: string;
  provider: string;
  channels: number;
  activeChannels: number;
  routeMode: string;
  weight: number;
};

const readModels = (channel: ChannelItem) => {
  const metadataModels = channel.metadata?.models;
  const models = Array.isArray(metadataModels)
    ? metadataModels.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  if (models.length > 0) {
    return models;
  }

  return channel.model ? [channel.model] : ['*'];
};

export default function ModelsPage() {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listChannels();
      setChannels(response.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载模型失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const map = new Map<string, ModelRow>();

    for (const channel of channels) {
      for (const model of readModels(channel)) {
        const current = map.get(model) ?? {
          id: model,
          provider: channel.provider,
          channels: 0,
          activeChannels: 0,
          routeMode: model === '*' ? 'wildcard' : 'explicit',
          weight: 0,
        };
        current.channels += 1;
        current.activeChannels += channel.status === 'ACTIVE' ? 1 : 0;
        current.weight += channel.weight;
        current.provider = current.provider.includes(channel.provider)
          ? current.provider
          : `${current.provider}, ${channel.provider}`;
        map.set(model, current);
      }
    }

    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [channels]);

  return (
    <ConsoleTablePage
      title="模型管理"
      description="从渠道配置与同步 metadata 中汇总模型，用于检查路由覆盖、可用渠道和权重分布。"
      note="当前模型列表由渠道数据推导。后续接入独立模型倍率/别名 API 时，可保持本页路由不变。"
      eyebrow="Models"
      rows={rows}
      loading={loading}
      onRefresh={load}
      stats={[
        { label: '模型数', value: rows.length, tone: 'blue' },
        { label: '活跃覆盖', value: rows.filter((row) => row.activeChannels > 0).length, tone: 'green' },
        { label: 'Wildcard', value: rows.filter((row) => row.id === '*').length, tone: 'orange' },
        { label: '渠道数', value: channels.length, tone: 'grey' },
      ]}
      toolbarExtra={<Button icon={<IconRefresh />} onClick={() => void load()}>重新汇总</Button>}
      searchKeys={['id', 'provider', 'routeMode']}
      columns={[
        {
          title: '模型',
          dataIndex: 'id',
          render: (value, record) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>{record.routeMode}</span>
            </div>
          ),
        },
        { title: '供应商', dataIndex: 'provider' },
        { title: '渠道数', dataIndex: 'channels' },
        { title: '活跃渠道', dataIndex: 'activeChannels', render: (value) => <Tag color={Number(value) > 0 ? 'green' : 'red'}>{String(value)}</Tag> },
        { title: '总权重', dataIndex: 'weight' },
        {
          title: '状态',
          dataIndex: 'activeChannels',
          render: (value) => (
            <Space>
              <Tag color={Number(value) > 0 ? 'green' : 'red'}>{Number(value) > 0 ? '可路由' : '不可用'}</Tag>
            </Space>
          ),
        },
      ]}
    />
  );
}

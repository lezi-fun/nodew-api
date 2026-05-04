import { Button, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { IconActivity, IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type ChannelItem } from '../lib/api';
import { formatDateTime } from '../lib/format';

const modelCount = (channel: ChannelItem) => {
  const models = channel.metadata?.models;
  return Array.isArray(models) ? models.length : channel.model ? 1 : 0;
};

export default function DeploymentPage() {
  const [rows, setRows] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listChannels();
      setRows(response.items ?? []);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载部署失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const syncModels = async (channel: ChannelItem) => {
    setSyncingId(channel.id);
    try {
      const response = await api.syncChannelModels(channel.id);
      Toast.success(response.item.success ? `已同步 ${response.item.total} 个模型` : response.item.errorMessage ?? '同步失败');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '同步模型失败');
    } finally {
      setSyncingId(null);
    }
  };

  const testChannel = async (channel: ChannelItem) => {
    setTestingId(channel.id);
    try {
      const response = await api.testChannel(channel.id, channel.model ? { model: channel.model } : undefined);
      Toast[response.item.success ? 'success' : 'error'](
        response.item.success ? `测试成功 HTTP ${response.item.statusCode}` : response.item.errorMessage ?? '测试失败',
      );
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '测试渠道失败');
    } finally {
      setTestingId(null);
    }
  };

  const active = rows.filter((row) => row.status === 'ACTIVE').length;

  return (
    <ConsoleTablePage
      title="模型部署"
      description="以渠道为部署单元查看模型同步状态、权重、优先级和连通性。"
      note="这里对应原版模型部署入口，当前直接复用渠道测试与模型同步能力。"
      eyebrow="Deployment"
      rows={rows}
      loading={loading}
      onRefresh={load}
      stats={[
        { label: '部署项', value: rows.length, tone: 'blue' },
        { label: '可用', value: active, tone: 'green' },
        { label: '停用', value: rows.length - active, tone: 'red' },
        { label: '模型条目', value: rows.reduce((sum, row) => sum + modelCount(row), 0), tone: 'orange' },
      ]}
      searchKeys={['name', 'provider', 'model', 'status']}
      columns={[
        {
          title: '部署',
          dataIndex: 'name',
          render: (value, record) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>{record.baseUrl ?? 'default endpoint'}</span>
            </div>
          ),
        },
        { title: '供应商', dataIndex: 'provider', render: (value) => <Tag color="cyan">{String(value)}</Tag> },
        { title: '模型数', dataIndex: 'metadata', render: (_value, record) => modelCount(record) || <Tag color="grey">wildcard</Tag> },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'red'}>{String(value)}</Tag> },
        { title: '优先级', dataIndex: 'priority' },
        { title: '权重', dataIndex: 'weight' },
        { title: '更新', dataIndex: 'updatedAt', render: (value) => formatDateTime(String(value)) },
        {
          title: '操作',
          dataIndex: 'id',
          render: (_value, record) => (
            <Space wrap>
              <Button size="small" icon={<IconActivity />} loading={testingId === record.id} onClick={() => void testChannel(record)}>测试</Button>
              <Button size="small" icon={<IconRefresh />} loading={syncingId === record.id} onClick={() => void syncModels(record)}>同步模型</Button>
            </Space>
          ),
        },
      ]}
    />
  );
}

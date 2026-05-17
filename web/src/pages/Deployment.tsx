import { Button, Card, Space, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconActivity, IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type ChannelItem, type ModelItem } from '../lib/api';
import { formatDateTime } from '../lib/format';

const modelCount = (channel: ChannelItem) => {
  const models = channel.metadata?.models;
  return Array.isArray(models) ? models.length : channel.model ? 1 : 0;
};

const readChannelModels = (channel: ChannelItem) => {
  const supported = new Set<string>();
  const metadataModels = channel.metadata?.models;

  if (Array.isArray(metadataModels)) {
    for (const model of metadataModels) {
      if (typeof model === 'string' && model.trim()) {
        supported.add(model);
      }
    }
  }

  if (channel.model?.trim()) {
    supported.add(channel.model);
  }

  return [...supported];
};

export default function DeploymentPage() {
  const [rows, setRows] = useState<ChannelItem[]>([]);
  const [modelRows, setModelRows] = useState<ModelItem[]>([]);
  const [missingRows, setMissingRows] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [channelResponse, modelResponse, missingResponse] = await Promise.all([
        api.listChannels(),
        api.listModels({ limit: 100 }),
        api.listMissingModels({ limit: 100 }),
      ]);
      setRows(channelResponse.items ?? []);
      setModelRows(modelResponse.items ?? []);
      setMissingRows(missingResponse.items ?? []);
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
  const wildcard = rows.filter((row) => row.status === 'ACTIVE' && modelCount(row) === 0).length;

  return (
    <ConsoleTablePage
      title="模型部署"
      description="以渠道为部署单元查看连通性、模型覆盖、缺口和部署权重。"
      note="上半部分负责渠道测试与模型同步，下半部分直接展示当前覆盖模型和仍待补齐的请求缺口。"
      eyebrow="Deployment"
      rows={rows}
      loading={loading}
      onRefresh={load}
      stats={[
        { label: '部署项', value: rows.length, tone: 'blue' },
        { label: '可用', value: active, tone: 'green' },
        { label: '已覆盖模型', value: modelRows.length, tone: 'orange' },
        { label: '缺失模型', value: missingRows.length, tone: missingRows.length > 0 ? 'red' : 'grey' },
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
        {
          title: '模型范围',
          dataIndex: 'metadata',
          render: (_value, record) => {
            const models = readChannelModels(record);

            return models.length > 0 ? (
              <div className="table-primary-cell">
                <strong>{models.length} 个模型</strong>
                <span>{models.slice(0, 3).join(', ')}{models.length > 3 ? ' ...' : ''}</span>
              </div>
            ) : <Tag color="grey">wildcard</Tag>;
          },
        },
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
      extraContent={(
        <div className="settings-grid">
          <Card bordered={false} className="console-table-card" bodyStyle={{ padding: 0 }}>
            <div className="table-toolbar">
              <div>
                <Typography.Text strong>覆盖模型</Typography.Text>
                <Typography.Text type="tertiary" className="table-note">
                  当前活跃部署已经可路由的模型目录，可快速判断权重和活跃渠道分布。
                </Typography.Text>
              </div>
              <Space wrap>
                <Tag color="blue" size="large">{modelRows.length}</Tag>
                {wildcard > 0 ? <Tag color="grey" size="large">Wildcard {wildcard}</Tag> : null}
              </Space>
            </div>
            <Table
              columns={[
                {
                  title: '模型',
                  dataIndex: 'model',
                  render: (value: unknown, record: ModelItem) => (
                    <div className="table-primary-cell">
                      <strong>{String(value)}</strong>
                      <span>{record.providers.join(', ')}</span>
                    </div>
                  ),
                },
                {
                  title: '活跃渠道',
                  dataIndex: 'activeChannels',
                  render: (value: unknown) => <Tag color={Number(value) > 0 ? 'green' : 'red'}>{String(value)}</Tag>,
                },
                { title: '总渠道', dataIndex: 'channels' },
                { title: '总权重', dataIndex: 'weight' },
                {
                  title: '状态',
                  dataIndex: 'enabled',
                  render: (value: unknown) => <Tag color={value ? 'green' : 'red'}>{value ? '在线' : '离线'}</Tag>,
                },
              ]}
              dataSource={modelRows}
              loading={loading}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              rowKey={(record) => String(record?.id ?? record?.model ?? 'deployment-model')}
            />
          </Card>

          <Card bordered={false} className="console-table-card" bodyStyle={{ padding: 0 }}>
            <div className="table-toolbar">
              <div>
                <Typography.Text strong>部署缺口</Typography.Text>
                <Typography.Text type="tertiary" className="table-note">
                  最近真实请求过、但当前没有任何活跃渠道支持的模型。优先补这里，最能直接改善兼容性。
                </Typography.Text>
              </div>
              <Tag color={missingRows.length > 0 ? 'red' : 'green'} size="large">{missingRows.length}</Tag>
            </div>
            <Table
              columns={[
                {
                  title: '模型',
                  dataIndex: 'model',
                  render: (value: unknown, record: ModelItem) => (
                    <div className="table-primary-cell">
                      <strong>{String(value)}</strong>
                      <span>{record.reason ?? '缺少活跃部署'}</span>
                    </div>
                  ),
                },
                {
                  title: '最近供应商',
                  dataIndex: 'provider',
                  render: (value: unknown, record: ModelItem) =>
                    record.providers.length > 0 ? record.providers.join(', ') : (value ? String(value) : '-'),
                },
                {
                  title: '请求次数',
                  dataIndex: 'requests',
                  render: (value: unknown) => typeof value === 'number' ? value : '-',
                },
                {
                  title: '最近请求',
                  dataIndex: 'lastRequestedAt',
                  render: (value: unknown) => formatDateTime(typeof value === 'string' ? value : null),
                },
                {
                  title: '状态',
                  dataIndex: 'enabled',
                  render: () => <Tag color="red">待部署</Tag>,
                },
              ]}
              dataSource={missingRows}
              loading={loading}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              rowKey={(record) => String(record?.id ?? record?.model ?? 'deployment-gap')}
            />
          </Card>
        </div>
      )}
    />
  );
}

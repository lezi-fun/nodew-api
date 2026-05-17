import { Button, Card, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import MissingModelsTable from '../components/models/MissingModelsTable';
import { api, type ModelItem } from '../lib/api';

export default function ModelsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ModelItem[]>([]);
  const [missingRows, setMissingRows] = useState<ModelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [missingTotal, setMissingTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, missingResponse] = await Promise.all([
        api.listModels({ limit: 100 }),
        api.listMissingModels({ limit: 100 }),
      ]);
      setRows(response.items ?? []);
      setTotal(response.total ?? response.items?.length ?? 0);
      setMissingRows(missingResponse.items ?? []);
      setMissingTotal(missingResponse.total ?? missingResponse.items?.length ?? 0);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载模型失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolveModel = (model: ModelItem) => {
    const params = new URLSearchParams({
      action: 'create',
      model: model.model,
    });

    if (model.providers[0]) {
      params.set('provider', model.providers[0]);
    }

    navigate(`/console/channel?${params.toString()}`);
  };

  return (
    <ConsoleTablePage
      title="模型管理"
      description="从后端模型兼容 API 汇总路由覆盖、可用渠道和权重分布。"
      note="模型数据当前由渠道配置与 metadata.models 推导；后续独立倍率/别名表可继续复用本接口。"
      eyebrow="Models"
      rows={rows}
      loading={loading}
      onRefresh={load}
      stats={[
        { label: '模型数', value: total, tone: 'blue' },
        { label: '活跃覆盖', value: rows.filter((row) => row.activeChannels > 0).length, tone: 'green' },
        { label: '缺失模型', value: missingTotal, tone: missingTotal > 0 ? 'red' : 'grey' },
        { label: 'Wildcard', value: rows.filter((row) => row.model === '*').length, tone: 'orange' },
        { label: '渠道覆盖', value: rows.reduce((sum, row) => sum + row.channels, 0), tone: 'grey' },
      ]}
      toolbarExtra={<Button icon={<IconRefresh />} onClick={() => void load()}>重新汇总</Button>}
      searchKeys={['model', 'provider']}
      columns={[
        {
          title: '模型',
          dataIndex: 'model',
          render: (value, record) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>{record.model === '*' ? 'wildcard' : 'explicit'}</span>
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
      extraContent={(
        <Card bordered={false} className="console-table-card" bodyStyle={{ padding: 0 }}>
          <div className="table-toolbar">
            <div>
              <Typography.Text strong>缺失模型</Typography.Text>
              <Typography.Text type="tertiary" className="table-note">
                最近请求过，但当前没有任何活跃渠道支持的模型。这个列表可以直接指导后续补渠道或补映射。
              </Typography.Text>
            </div>
            <Tag color={missingRows.length > 0 ? 'red' : 'green'} size="large">{missingRows.length}</Tag>
          </div>
          <MissingModelsTable rows={missingRows} loading={loading} onResolveModel={resolveModel} />
        </Card>
      )}
    />
  );
}

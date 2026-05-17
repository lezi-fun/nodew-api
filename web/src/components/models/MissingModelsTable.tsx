import { Button, Space, Table, Tag } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';

import type { ModelItem } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

type MissingModelsTableProps = {
  rows: ModelItem[];
  loading?: boolean;
  pageSize?: number;
  showEndpoints?: boolean;
  pendingLabel?: string;
  onResolveModel?: (model: ModelItem) => void;
  resolveLabel?: string;
};

export default function MissingModelsTable({
  rows,
  loading = false,
  pageSize = 8,
  showEndpoints = true,
  pendingLabel = '待补齐',
  onResolveModel,
  resolveLabel = '补渠道',
}: MissingModelsTableProps) {
  return (
    <Table
      columns={[
        {
          title: '模型',
          dataIndex: 'model',
          render: (value: unknown, record: ModelItem) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>{record.reason ?? '未配置可用渠道'}</span>
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
        ...(showEndpoints
          ? [{
              title: '端点',
              dataIndex: 'endpoints',
              render: (value: unknown) =>
                Array.isArray(value) && value.length > 0 ? (
                  <Space wrap>
                    {value.map((endpoint) => <Tag key={String(endpoint)}>{String(endpoint)}</Tag>)}
                  </Space>
                ) : '-',
            }]
          : []),
        {
          title: '最近请求',
          dataIndex: 'lastRequestedAt',
          render: (value: unknown) => formatDateTime(typeof value === 'string' ? value : null),
        },
        {
          title: '状态',
          dataIndex: 'enabled',
          render: () => <Tag color="red">{pendingLabel}</Tag>,
        },
        ...(onResolveModel
          ? [{
              title: '操作',
              dataIndex: 'id',
              render: (_value: unknown, record: ModelItem) => (
                <Button size="small" icon={<IconPlus />} onClick={() => onResolveModel(record)}>
                  {resolveLabel}
                </Button>
              ),
            }]
          : []),
      ]}
      dataSource={rows}
      loading={loading}
      pagination={{ pageSize, showSizeChanger: true }}
      rowKey={(record) => String(record?.id ?? record?.model ?? 'missing-model')}
    />
  );
}

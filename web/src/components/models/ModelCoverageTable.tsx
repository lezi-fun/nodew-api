import { Space, Table, Tag } from '@douyinfe/semi-ui';

import type { ModelItem } from '../../lib/api';

type ModelCoverageTableProps = {
  rows: ModelItem[];
  loading?: boolean;
  pageSize?: number;
};

export default function ModelCoverageTable({
  rows,
  loading = false,
  pageSize = 8,
}: ModelCoverageTableProps) {
  return (
    <Table
      columns={[
        {
          title: '模型',
          dataIndex: 'model',
          render: (value: unknown, record: ModelItem) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>{record.model === '*' ? 'wildcard' : record.providers.join(', ')}</span>
            </div>
          ),
        },
        { title: '供应商', dataIndex: 'provider' },
        { title: '渠道数', dataIndex: 'channels' },
        {
          title: '活跃渠道',
          dataIndex: 'activeChannels',
          render: (value: unknown) => <Tag color={Number(value) > 0 ? 'green' : 'red'}>{String(value)}</Tag>,
        },
        { title: '总权重', dataIndex: 'weight' },
        {
          title: '状态',
          dataIndex: 'enabled',
          render: (value: unknown) => (
            <Space>
              <Tag color={value ? 'green' : 'red'}>{value ? '可路由' : '不可用'}</Tag>
            </Space>
          ),
        },
      ]}
      dataSource={rows}
      loading={loading}
      pagination={{ pageSize, showSizeChanger: true }}
      rowKey={(record) => String(record?.id ?? record?.model ?? 'model-coverage')}
    />
  );
}

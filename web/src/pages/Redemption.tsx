import { Button, Space, Tag } from '@douyinfe/semi-ui';
import { IconGift, IconPlus } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type RedemptionItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

export default function RedemptionPage() {
  const [rows, setRows] = useState<RedemptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.listRedemptions();
        setRows(response.items ?? []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);
  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;
  const redeemedCount = rows.filter((row) => row.status === 'REDEEMED').length;

  return (
    <ConsoleTablePage
      title="兑换码管理"
      description="兑换码列表主视图，集中展示额度、状态、创建人和核销信息。"
      note="用于额度发放、活动运营和人工补偿。建议按批次生成并设置明确有效期。"
      eyebrow="Growth"
      rows={rows}
      loading={loading}
      primaryActionText="生成兑换码"
      onPrimaryAction={() => undefined}
      onRefresh={() => window.location.reload()}
      stats={[
        { label: '总数量', value: rows.length, tone: 'blue' },
        { label: '可用', value: activeCount, tone: 'green' },
        { label: '已核销', value: redeemedCount, tone: 'orange' },
        { label: '失效', value: rows.length - activeCount - redeemedCount, tone: 'grey' },
      ]}
      searchKeys={['maskedCode', 'status', 'quotaAmount']}
      columns={[
        {
          title: '兑换码',
          dataIndex: 'maskedCode',
          render: (value, record) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>prefix: {record.codePrefix}</span>
            </div>
          ),
        },
        { title: '额度', dataIndex: 'quotaAmount', render: (value) => formatQuota(value as string) },
        {
          title: '状态',
          dataIndex: 'status',
          render: (value) => {
            const color = value === 'ACTIVE' ? 'green' : value === 'REDEEMED' ? 'blue' : 'orange';
            return <Tag color={color}>{String(value)}</Tag>;
          },
        },
        { title: '创建人', dataIndex: 'createdBy', render: (value) => (value && typeof value === 'object' && 'email' in value ? String(value.email) : '-') },
        { title: '核销用户', dataIndex: 'redeemedByUser', render: (value) => (value && typeof value === 'object' && 'email' in value ? String(value.email) : '-') },
        { title: '过期时间', dataIndex: 'expiresAt', render: (value) => formatDateTime(value as string | null) },
        { title: '操作', dataIndex: 'id', render: () => <Space><Button size="small" icon={<IconGift />}>发放</Button></Space> },
      ]}
    />
  );
}

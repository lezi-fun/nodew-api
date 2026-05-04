import { Button, Space, Tag } from '@douyinfe/semi-ui';
import { IconEdit, IconRefresh } from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { api, type UserItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

export default function UserPage() {
  const [rows, setRows] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.listUsers();
        setRows(response.items ?? []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);
  const adminCount = rows.filter((row) => row.role === 'ADMIN').length;
  const activeCount = rows.filter((row) => row.status === 'ACTIVE').length;

  return (
    <ConsoleTablePage
      title="用户管理"
      description="用户列表主视图，集中展示账号、角色、状态、分组和额度。"
      note="管理员视角下的账户、角色、分组和额度管理。敏感操作会逐步接入二次验证。"
      eyebrow="Identity"
      rows={rows}
      loading={loading}
      primaryActionText="新增用户"
      onPrimaryAction={() => undefined}
      onRefresh={() => window.location.reload()}
      stats={[
        { label: '总用户', value: rows.length, tone: 'blue' },
        { label: '活跃', value: activeCount, tone: 'green' },
        { label: '管理员', value: adminCount, tone: 'orange' },
        { label: '禁用', value: rows.length - activeCount, tone: 'red' },
      ]}
      searchKeys={['email', 'username', 'displayName', 'role', 'status']}
      columns={[
        {
          title: '账号',
          dataIndex: 'email',
          render: (value, record) => (
            <div className="table-primary-cell">
              <strong>{String(value)}</strong>
              <span>{record.displayName ?? record.username}</span>
            </div>
          ),
        },
        {
          title: '角色',
          dataIndex: 'role',
          render: (value) => <Tag color={value === 'ADMIN' ? 'blue' : 'grey'}>{String(value)}</Tag>,
        },
        {
          title: '状态',
          dataIndex: 'status',
          render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'orange'}>{String(value)}</Tag>,
        },
        { title: '分组', dataIndex: 'group', render: (value) => (value && typeof value === 'object' && 'name' in value ? String(value.name) : '-') },
        { title: '剩余额度', dataIndex: 'quotaRemaining', render: (value) => formatQuota(value as string) },
        { title: '最后登录', dataIndex: 'lastLoginAt', render: (value) => formatDateTime(value as string | null) },
        {
          title: '操作',
          dataIndex: 'id',
          render: () => (
            <Space>
              <Button size="small" icon={<IconEdit />}>编辑</Button>
              <Button size="small" icon={<IconRefresh />}>重置</Button>
            </Space>
          ),
        },
      ]}
    />
  );
}

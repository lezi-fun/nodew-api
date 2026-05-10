import { Tag, Toast } from '@douyinfe/semi-ui';
import { useCallback, useContext, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { UserContext } from '../context/User';
import { api, type TaskItem } from '../lib/api';
import { formatDateTime } from '../lib/format';

export default function MidjourneyPage() {
  const { user } = useContext(UserContext);
  const [rows, setRows] = useState<TaskItem[]>([]);
  const [message, setMessage] = useState('当前图片 Relay 端点可用，独立绘图任务持久化接口已预留。');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = isAdmin ? await api.listImageTasks() : await api.listSelfImageTasks();
      setRows(response.data.items ?? []);
      setMessage(response.data.message ?? message);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载绘图日志失败');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, message]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleTablePage
      title="绘图日志"
      description="预留绘图、多模态和图片生成任务日志入口。"
      note={message}
      eyebrow="Images"
      rows={rows}
      loading={loading}
      onRefresh={load}
      stats={[
        { label: '任务数', value: rows.length, tone: 'blue' },
        { label: '排队中', value: rows.filter((row) => row.status === 'pending').length, tone: 'orange' },
        { label: '完成', value: rows.filter((row) => row.status === 'success').length, tone: 'green' },
        { label: '失败', value: rows.filter((row) => row.status === 'failed').length, tone: 'red' },
      ]}
      searchKeys={['id', 'action', 'prompt', 'status']}
      columns={[
        { title: '任务 ID', dataIndex: 'id' },
        { title: '动作', dataIndex: 'action', render: (value) => value ? String(value) : '-' },
        { title: '提示词', dataIndex: 'prompt', render: (value) => value ? String(value) : '-' },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> },
        { title: '创建时间', dataIndex: 'createdAt', render: (value) => formatDateTime(value as string | null) },
      ]}
    />
  );
}

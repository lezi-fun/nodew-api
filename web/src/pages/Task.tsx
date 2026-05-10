import { Tag, Toast } from '@douyinfe/semi-ui';
import { useCallback, useContext, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { UserContext } from '../context/User';
import { api, type TaskItem } from '../lib/api';
import { formatDateTime } from '../lib/format';

export default function TaskPage() {
  const { user } = useContext(UserContext);
  const [rows, setRows] = useState<TaskItem[]>([]);
  const [message, setMessage] = useState('当前后端尚未启用异步任务持久化；接口已就绪，会返回真实任务表。');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = isAdmin ? await api.listTasks() : await api.listSelfTasks();
      setRows(response.data.items ?? []);
      setMessage(response.data.message ?? message);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载任务失败');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, message]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleTablePage
      title="任务日志"
      description="异步任务、批量操作和后台队列的审计入口。"
      note={message}
      eyebrow="Tasks"
      rows={rows}
      loading={loading}
      onRefresh={load}
      stats={[
        { label: '任务数', value: rows.length, tone: 'blue' },
        { label: '运行中', value: rows.filter((row) => row.status === 'running' || row.status === 'pending').length, tone: 'orange' },
        { label: '成功', value: rows.filter((row) => row.status === 'success').length, tone: 'green' },
        { label: '失败', value: rows.filter((row) => row.status === 'failed').length, tone: 'red' },
      ]}
      searchKeys={['id', 'type', 'status', 'model']}
      columns={[
        { title: '任务 ID', dataIndex: 'id' },
        { title: '类型', dataIndex: 'type', render: (value) => value ? String(value) : '-' },
        { title: '模型', dataIndex: 'model', render: (value) => value ? String(value) : '-' },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> },
        { title: '创建时间', dataIndex: 'createdAt', render: (value) => formatDateTime(value as string | null) },
      ]}
    />
  );
}

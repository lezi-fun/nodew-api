import { Button, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { UserContext } from '../context/User';
import { api, type TaskItem } from '../lib/api';
import { formatDateTime } from '../lib/format';

export default function TaskPage() {
  const { user } = useContext(UserContext);
  const [rows, setRows] = useState<TaskItem[]>([]);
  const [message, setMessage] = useState('当前任务页展示真实 relay / media usage log，可用于追踪图像、视频与异步任务类请求。');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = isAdmin
        ? await api.listTasks({ limit: 30 })
        : await api.listSelfTasks({ limit: 30 });
      setRows(response.data.items ?? []);
      setNextCursor(response.data.nextCursor ?? null);
      setMessage(response.data.message ?? message);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载任务失败');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, message]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = isAdmin
        ? await api.listTasks({ limit: 30, cursor: nextCursor })
        : await api.listSelfTasks({ limit: 30, cursor: nextCursor });
      setRows((current) => [...current, ...(response.data.items ?? [])]);
      setNextCursor(response.data.nextCursor ?? null);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载更多任务失败');
    } finally {
      setLoadingMore(false);
    }
  }, [isAdmin, nextCursor]);

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
      primaryActionText={nextCursor ? '加载更多' : undefined}
      onPrimaryAction={nextCursor ? () => void loadMore() : undefined}
      stats={[
        { label: '任务数', value: rows.length, tone: 'blue' },
        { label: '运行中', value: rows.filter((row) => row.status === 'running' || row.status === 'pending').length, tone: 'orange' },
        { label: '成功', value: rows.filter((row) => row.status === 'success').length, tone: 'green' },
        { label: '失败', value: rows.filter((row) => row.status === 'failed').length, tone: 'red' },
      ]}
      toolbarExtra={nextCursor ? (
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loadingMore} onClick={() => void loadMore()}>
            更多
          </Button>
        </Space>
      ) : undefined}
      searchKeys={['id', 'type', 'status', 'model', 'provider', 'endpoint']}
      columns={[
        { title: '任务 ID', dataIndex: 'id' },
        { title: '类型', dataIndex: 'type', render: (value) => value ? String(value) : '-' },
        { title: '供应商', dataIndex: 'provider', render: (value) => value ? String(value) : '-' },
        { title: '模型', dataIndex: 'model', render: (value) => value ? String(value) : '-' },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> },
        { title: 'Token', dataIndex: 'totalTokens', render: (value) => typeof value === 'number' ? value : '-' },
        { title: '额度', dataIndex: 'quota', render: (value) => typeof value === 'number' ? value : '-' },
        { title: '延迟', dataIndex: 'latencyMs', render: (value) => typeof value === 'number' ? `${value} ms` : '-' },
        { title: '创建时间', dataIndex: 'createdAt', render: (value) => formatDateTime(value as string | null) },
      ]}
    />
  );
}

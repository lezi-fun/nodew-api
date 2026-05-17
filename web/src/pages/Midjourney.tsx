import { Button, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { UserContext } from '../context/User';
import { api, type TaskItem } from '../lib/api';
import { formatDateTime } from '../lib/format';

export default function MidjourneyPage() {
  const { user } = useContext(UserContext);
  const [rows, setRows] = useState<TaskItem[]>([]);
  const [message, setMessage] = useState('当前绘图页展示真实图片与视频 relay usage log，可用于排查生成任务与媒体链路。');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = isAdmin
        ? await api.listImageTasks({ limit: 30 })
        : await api.listSelfImageTasks({ limit: 30 });
      setRows(response.data.items ?? []);
      setNextCursor(response.data.nextCursor ?? null);
      setMessage(response.data.message ?? message);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载绘图日志失败');
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
        ? await api.listImageTasks({ limit: 30, cursor: nextCursor })
        : await api.listSelfImageTasks({ limit: 30, cursor: nextCursor });
      setRows((current) => [...current, ...(response.data.items ?? [])]);
      setNextCursor(response.data.nextCursor ?? null);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载更多绘图日志失败');
    } finally {
      setLoadingMore(false);
    }
  }, [isAdmin, nextCursor]);

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
      primaryActionText={nextCursor ? '加载更多' : undefined}
      onPrimaryAction={nextCursor ? () => void loadMore() : undefined}
      stats={[
        { label: '任务数', value: rows.length, tone: 'blue' },
        { label: '排队中', value: rows.filter((row) => row.status === 'pending').length, tone: 'orange' },
        { label: '完成', value: rows.filter((row) => row.status === 'success').length, tone: 'green' },
        { label: '失败', value: rows.filter((row) => row.status === 'failed').length, tone: 'red' },
      ]}
      toolbarExtra={nextCursor ? (
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loadingMore} onClick={() => void loadMore()}>
            更多
          </Button>
        </Space>
      ) : undefined}
      searchKeys={['id', 'action', 'model', 'provider', 'endpoint', 'status']}
      columns={[
        { title: '任务 ID', dataIndex: 'id' },
        { title: '动作', dataIndex: 'action', render: (value) => value ? String(value) : '-' },
        { title: '模型', dataIndex: 'model', render: (value) => value ? String(value) : '-' },
        { title: '供应商', dataIndex: 'provider', render: (value) => value ? String(value) : '-' },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag>{String(value)}</Tag> },
        { title: '额度', dataIndex: 'quota', render: (value) => typeof value === 'number' ? value : '-' },
        { title: '延迟', dataIndex: 'latencyMs', render: (value) => typeof value === 'number' ? `${value} ms` : '-' },
        { title: '创建时间', dataIndex: 'createdAt', render: (value) => formatDateTime(value as string | null) },
      ]}
    />
  );
}

import { Button, Select, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';

import ConsoleTablePage from '../components/common/ConsoleTablePage';
import { UserContext } from '../context/User';
import { api, type UsageLogItem, type UsageQuery, type UsageSummary } from '../lib/api';
import { formatDateTime, formatLatency, formatQuota } from '../lib/format';

type SuccessFilter = 'all' | 'true' | 'false';

const emptySummary: UsageSummary = {
  requests: 0,
  success: 0,
  failed: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCostCents: 0,
  averageLatencyMs: 0,
  byProvider: [],
};

export default function LogPage() {
  const { user } = useContext(UserContext);
  const [rows, setRows] = useState<UsageLogItem[]>([]);
  const [summary, setSummary] = useState<UsageSummary>(emptySummary);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [successFilter, setSuccessFilter] = useState<SuccessFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const buildQuery = useCallback((cursor?: string): UsageQuery => ({
    limit: 30,
    ...(cursor ? { cursor } : {}),
    ...(successFilter === 'all' ? {} : { success: successFilter }),
  }), [successFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsResponse, summaryResponse] = await Promise.all([
        isAdmin ? api.listUsageLogs(buildQuery()) : api.listSelfUsageLogs(buildQuery()),
        isAdmin ? api.getUsageSummary() : api.getSelfUsageSummary(),
      ]);

      setRows(logsResponse.items ?? []);
      setNextCursor(logsResponse.nextCursor ?? null);
      setSummary(summaryResponse);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载日志失败');
    } finally {
      setLoading(false);
    }
  }, [buildQuery, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = isAdmin
        ? await api.listUsageLogs(buildQuery(nextCursor))
        : await api.listSelfUsageLogs(buildQuery(nextCursor));
      setRows((current) => [...current, ...(response.items ?? [])]);
      setNextCursor(response.nextCursor ?? null);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <ConsoleTablePage
      title="使用日志"
      description={isAdmin ? '全局请求审计、故障定位、用量核算和渠道观测。' : '当前账号的请求记录、模型用量和错误信息。'}
      note="列表按时间倒序分页加载；失败日志会保留错误码和上游错误消息。"
      eyebrow="Observability"
      rows={rows}
      loading={loading}
      onRefresh={load}
      primaryActionText={nextCursor ? '加载更多' : undefined}
      onPrimaryAction={nextCursor ? () => void loadMore() : undefined}
      stats={[
        { label: '请求数', value: formatQuota(summary.requests), tone: 'blue' },
        { label: '成功', value: formatQuota(summary.success), tone: 'green' },
        { label: '失败', value: formatQuota(summary.failed), tone: 'red' },
        { label: 'Tokens', value: formatQuota(summary.totalTokens), tone: 'orange' },
      ]}
      toolbarExtra={
        <Space wrap>
          <Select value={successFilter} onChange={(value) => setSuccessFilter(String(value) as SuccessFilter)} style={{ width: 132 }}>
            <Select.Option value="all">全部结果</Select.Option>
            <Select.Option value="true">仅成功</Select.Option>
            <Select.Option value="false">仅失败</Select.Option>
          </Select>
          {nextCursor ? <Button icon={<IconRefresh />} loading={loadingMore} onClick={() => void loadMore()}>更多</Button> : null}
        </Space>
      }
      searchKeys={['requestId', 'provider', 'model', 'endpoint', 'errorMessage']}
      columns={[
        {
          title: '请求',
          dataIndex: 'requestId',
          render: (value, record) => (
            <div className="table-primary-cell">
              <strong>{value ? String(value).slice(0, 18) : record.id.slice(0, 18)}</strong>
              <span>{formatDateTime(record.createdAt)}</span>
            </div>
          ),
        },
        { title: '提供商', dataIndex: 'provider', render: (value) => <Tag color="cyan">{String(value)}</Tag> },
        { title: '模型', dataIndex: 'model', render: (value) => value ? <Tag>{String(value)}</Tag> : '-' },
        { title: '端点', dataIndex: 'endpoint' },
        { title: '用户', dataIndex: 'user', render: (value) => value && typeof value === 'object' && 'email' in value ? String(value.email) : '-' },
        { title: '渠道', dataIndex: 'channel', render: (value) => value && typeof value === 'object' && 'name' in value ? String(value.name) : '-' },
        { title: '总 Tokens', dataIndex: 'totalTokens', render: (value) => formatQuota(value as number) },
        { title: '延迟', dataIndex: 'latencyMs', render: (value) => formatLatency(value as number | null) },
        {
          title: '结果',
          dataIndex: 'success',
          render: (value, record) => (
            <div className="table-primary-cell">
              <Tag color={value ? 'green' : 'red'}>{value ? 'SUCCESS' : 'FAILED'}</Tag>
              <span>{record.statusCode ?? '-'} {record.errorCode ?? ''}</span>
            </div>
          ),
        },
      ]}
    />
  );
}

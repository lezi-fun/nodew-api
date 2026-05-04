import { Button, Card, Input, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconActivity, IconBell, IconCreditCard, IconHistogram, IconRefresh, IconSearch, IconServer, IconUser } from '@douyinfe/semi-icons';
import { useContext, useEffect, useState } from 'react';

import { UserContext } from '../context/User';
import { StatusContext } from '../context/Status';
import { api, type ChannelItem, type TokenItem, type UsageLogItem, type UserItem } from '../lib/api';
import { formatDateTime, formatQuota } from '../lib/format';

export default function DashboardPage() {
  const { user } = useContext(UserContext);
  const { status } = useContext(StatusContext);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [logs, setLogs] = useState<UsageLogItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [channelResult, tokenResult, logResult] = await Promise.allSettled([
        api.listChannels(),
        api.listTokens(),
        user?.role === 'ADMIN' ? api.listUsageLogs() : api.listSelfUsageLogs(),
      ]);

      if (channelResult.status === 'fulfilled') {
        setChannels(channelResult.value.items ?? []);
      }

      if (tokenResult.status === 'fulfilled') {
        setTokens(tokenResult.value.items ?? []);
      }

      if (logResult.status === 'fulfilled') {
        setLogs(logResult.value.items ?? []);
      }

      if (user?.role === 'ADMIN') {
        const userResult = await Promise.allSettled([api.listUsers()]);
        const first = userResult[0];
        if (first.status === 'fulfilled') {
          setUsers(first.value.items ?? []);
        }
      }
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '刷新看板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Dashboard refreshes when role changes; manual refresh handles later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const activeChannels = channels.filter((channel) => channel.status === 'ACTIVE').length;
  const activeTokens = tokens.filter((token) => token.status === 'ACTIVE').length;
  const successfulLogs = logs.filter((log) => log.success).length;
  const successRate = logs.length > 0 ? Math.round((successfulLogs / logs.length) * 100) : 100;
  const greeting = user?.displayName ?? user?.username ?? 'operator';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main className="console-page dashboard-page">
      <section className="console-hero dashboard-hero">
        <div>
          <div className="console-eyebrow">Overview</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>你好，{greeting}</Typography.Title>
          <Typography.Paragraph className="console-description">
            当前实例的渠道、令牌、用户与请求日志概览。这里优先展示影响网关可用性的指标。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconSearch />} onClick={() => setSearchVisible(true)}>搜索</Button>
          <Button theme="solid" type="primary" icon={<IconRefresh />} loading={loading} onClick={() => void load()}>刷新</Button>
        </Space>
      </section>

      <section className="metric-grid">
        <Card className="metric-card tone-blue" bordered={false}>
          <span><IconServer /> 活跃渠道</span>
          <strong>{activeChannels}/{channels.length}</strong>
        </Card>
        <Card className="metric-card tone-green" bordered={false}>
          <span><IconCreditCard /> 可用令牌</span>
          <strong>{activeTokens}</strong>
        </Card>
        <Card className="metric-card tone-orange" bordered={false}>
          <span><IconHistogram /> 请求成功率</span>
          <strong>{successRate}%</strong>
        </Card>
        <Card className="metric-card tone-grey" bordered={false}>
          <span><IconUser /> 用户数</span>
          <strong>{user?.role === 'ADMIN' ? users.length : 'self'}</strong>
        </Card>
      </section>

      <section className="dashboard-grid dashboard-grid-wide">
        <Card title="服务状态" bordered={false} className="dashboard-card">
          <Space vertical align="start">
            <Tag color={status?.status === 'ok' ? 'green' : 'orange'} size="large">{status?.status ?? 'unknown'}</Tag>
            <Typography.Text type="tertiary">service: {status?.service ?? 'nodew-api'}</Typography.Text>
            <Typography.Text type="tertiary">version: {status?.version ?? 'unknown'}</Typography.Text>
          </Space>
        </Card>
        <Card title="额度概览" bordered={false} className="dashboard-card">
          <Typography.Text type="tertiary">剩余额度</Typography.Text>
          <Typography.Title heading={4}>{formatQuota(user?.quotaRemaining)}</Typography.Title>
          <div className="dashboard-progress">
            <span style={{ width: `${successRate}%` }} />
          </div>
          <Typography.Text type="tertiary">最近请求成功率 {successRate}%</Typography.Text>
        </Card>
        <Card title="Relay 健康度" bordered={false} className="dashboard-card">
          <Space vertical align="start">
            <Tag color={activeChannels > 0 ? 'green' : 'red'} size="large"><IconActivity /> channel pool</Tag>
            <Typography.Text type="tertiary">{activeChannels > 0 ? '至少一个渠道可用' : '暂无可用渠道'}</Typography.Text>
            <Typography.Text type="tertiary">最近日志 {logs.length} 条</Typography.Text>
          </Space>
        </Card>
        <Card title={<span><IconServer /> API 信息</span>} bordered={false} className="dashboard-card">
          <div className="api-info-list">
            {[
              { route: '/v1/chat/completions', url: `${baseUrl}/v1/chat/completions`, desc: 'OpenAI 兼容聊天补全，支持 SSE 流式响应。' },
              { route: '/v1/models', url: `${baseUrl}/v1/models`, desc: '返回当前网关可用模型。' },
              { route: '/api/status', url: `${baseUrl}/api/status`, desc: '实例健康状态与初始化状态。' },
            ].map((item) => (
              <button
                className="api-info-item"
                key={item.route}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(item.url);
                  Toast.success('URL 已复制');
                }}
              >
                <Tag color="blue">{item.route.slice(0, 3)}</Tag>
                <div>
                  <strong>{item.route}</strong>
                  <span>{item.desc}</span>
                  <code>{item.url}</code>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <Card title={<span><IconBell /> 公告</span>} bordered={false} className="dashboard-card">
          <div className="announcement-list">
            <div>
              <strong>nodew-api relay 已启用</strong>
              <span>请先配置至少一个 ACTIVE 渠道和一个令牌。</span>
            </div>
            <div>
              <strong>流式透传</strong>
              <span>客户端可直接使用 OpenAI SDK 指向当前实例。</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="dashboard-bottom-grid">
        <Card title="最近请求" bordered={false} className="dashboard-card">
          <div className="dashboard-timeline">
            {logs.slice(0, 6).map((log) => (
              <div key={log.id} className={`dashboard-timeline-item ${log.success ? 'success' : 'error'}`}>
                <span>{formatDateTime(log.createdAt)}</span>
                <strong>{log.model ?? '-'}</strong>
                <em>{log.endpoint} · {log.statusCode ?? '-'} · {formatQuota(log.totalTokens)} tokens</em>
              </div>
            ))}
            {logs.length === 0 ? <div className="dashboard-timeline-empty">暂无请求日志</div> : null}
          </div>
        </Card>
        <Card title="常见问题" bordered={false} className="dashboard-card">
          <div className="faq-list">
            <details open>
              <summary>如何接入 OpenAI SDK？</summary>
              <p>将 baseURL 指向当前实例，并使用控制台创建的令牌作为 Bearer Token。</p>
            </details>
            <details>
              <summary>渠道不生效时先看哪里？</summary>
              <p>检查渠道状态、模型匹配、权重、Base URL 和最近失败日志。</p>
            </details>
            <details>
              <summary>如何验证流式响应？</summary>
              <p>在操练场或 curl 中设置 stream=true，确认客户端持续收到 SSE 分片。</p>
            </details>
          </div>
        </Card>
      </section>

      <Modal
        title="搜索控制台"
        visible={searchVisible}
        footer={null}
        onCancel={() => setSearchVisible(false)}
      >
        <Input prefix={<IconSearch />} placeholder="搜索渠道、令牌、日志或用户" autoFocus />
        <div className="search-shortcuts">
          {[
            ['渠道管理', '/console/channel'],
            ['令牌管理', '/console/token'],
            ['使用日志', '/console/log'],
            ['用户管理', '/console/user'],
          ].map(([label, path]) => (
            <a key={path} href={path}>{label}</a>
          ))}
        </div>
      </Modal>
    </main>
  );
}

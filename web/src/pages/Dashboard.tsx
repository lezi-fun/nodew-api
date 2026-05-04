import { Card, Col, Progress, Row, Space, Tag, Timeline, Typography } from '@douyinfe/semi-ui';
import { IconActivity, IconCreditCard, IconHistogram, IconServer, IconUser } from '@douyinfe/semi-icons';
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

  useEffect(() => {
    const load = async () => {
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
    };

    void load();
  }, [user?.role]);

  const activeChannels = channels.filter((channel) => channel.status === 'ACTIVE').length;
  const activeTokens = tokens.filter((token) => token.status === 'ACTIVE').length;
  const successfulLogs = logs.filter((log) => log.success).length;
  const successRate = logs.length > 0 ? Math.round((successfulLogs / logs.length) * 100) : 100;

  return (
    <main className="console-page dashboard-page">
      <section className="console-hero dashboard-hero">
        <div>
          <div className="console-eyebrow">Overview</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>控制台</Typography.Title>
          <Typography.Paragraph className="console-description">
            当前实例的渠道、令牌、用户与请求日志概览。这里优先展示影响网关可用性的指标。
          </Typography.Paragraph>
        </div>
        <div className="dashboard-user-card">
          <Tag color={user?.role === 'ADMIN' ? 'blue' : 'green'}>{user?.role ?? 'GUEST'}</Tag>
          <strong>{user ? user.displayName ?? user.username : '未登录'}</strong>
          <span>{user?.email ?? 'No account'}</span>
        </div>
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

      <Row gutter={[20, 20]}>
        <Col xs={24} md={8}>
          <Card title="服务状态" bordered={false} className="dashboard-card">
            <Space vertical align="start">
              <Tag color={status?.status === 'ok' ? 'green' : 'orange'} size="large">{status?.status ?? 'unknown'}</Tag>
              <Typography.Text type="tertiary">service: {status?.service ?? 'nodew-api'}</Typography.Text>
              <Typography.Text type="tertiary">version: {status?.version ?? 'unknown'}</Typography.Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="额度概览" bordered={false} className="dashboard-card">
            <Typography.Text type="tertiary">剩余额度</Typography.Text>
            <Typography.Title heading={4}>{formatQuota(user?.quotaRemaining)}</Typography.Title>
            <Progress percent={successRate} stroke="#10b981" showInfo />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Relay 健康度" bordered={false} className="dashboard-card">
            <Space vertical align="start">
              <Tag color={activeChannels > 0 ? 'green' : 'red'} size="large"><IconActivity /> channel pool</Tag>
              <Typography.Text type="tertiary">{activeChannels > 0 ? '至少一个渠道可用' : '暂无可用渠道'}</Typography.Text>
              <Typography.Text type="tertiary">最近日志 {logs.length} 条</Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="最近请求" bordered={false} className="dashboard-card">
        <Timeline mode="left">
          {logs.slice(0, 6).map((log) => (
            <Timeline.Item
              key={log.id}
              type={log.success ? 'success' : 'error'}
              time={formatDateTime(log.createdAt)}
            >
              <strong>{log.model ?? '-'}</strong>
              <span className="timeline-muted"> {log.endpoint} · {log.statusCode ?? '-'} · {formatQuota(log.totalTokens)} tokens</span>
            </Timeline.Item>
          ))}
          {logs.length === 0 ? <Timeline.Item type="default">暂无请求日志</Timeline.Item> : null}
        </Timeline>
      </Card>
    </main>
  );
}

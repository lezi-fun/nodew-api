import { IconGithubLogo, IconLink, IconRefresh, IconUser } from '@douyinfe/semi-icons';
import { Avatar, Button, Card, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useMemo, useState } from 'react';

import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { api, type OAuthBindingItem } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

const githubProviderName = 'GitHub';

const getProviderBadgeColor = (provider: string) => {
  if (provider === 'github') {
    return 'blue';
  }

  return 'grey';
};

export default function OAuthBindingCard() {
  const { user } = useContext(UserContext);
  const { status } = useContext(StatusContext);
  const [bindings, setBindings] = useState<OAuthBindingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState(false);
  const [unbindingProvider, setUnbindingProvider] = useState<string | null>(null);

  const githubEnabled = status?.oauth?.github?.enabled === true;

  const loadBindings = async () => {
    if (!user) {
      setBindings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.listOAuthBindings();
      setBindings(response.items);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载第三方绑定状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBindings();
  }, [user?.id]);

  const githubBinding = useMemo(
    () => bindings.find((item) => item.provider === 'github') ?? null,
    [bindings],
  );

  const startGitHubBinding = async () => {
    setBinding(true);
    try {
      const response = await api.getOAuthState({
        provider: 'github',
        mode: 'bind',
        redirectTo: '/console/personal',
      });
      window.location.assign(response.data.authorizeUrl);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '发起 GitHub 绑定失败');
    } finally {
      setBinding(false);
    }
  };

  const confirmUnbind = (provider: 'github') => {
    Modal.confirm({
      title: '确认解绑',
      content: `确定要解绑 ${githubProviderName} 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setUnbindingProvider(provider);
        try {
          await api.deleteOAuthBinding(provider);
          setBindings((current) => current.filter((item) => item.provider !== provider));
          Toast.success('解绑成功');
        } catch (error) {
          Toast.error(error instanceof Error ? error.message : '解绑失败');
        } finally {
          setUnbindingProvider(null);
        }
      },
    });
  };

  return (
    <Card title={<span><IconLink /> 第三方账号</span>} bordered={false} className="dashboard-card">
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Text type="tertiary">绑定状态</Typography.Text>
        <div className="oauth-binding-row">
          <div className="oauth-binding-main">
            <Avatar color="indigo" size="small">
              <IconGithubLogo />
            </Avatar>
            <div className="oauth-binding-text">
              <strong>{githubProviderName}</strong>
              <span>
                {loading
                  ? '加载中'
                  : githubEnabled
                    ? githubBinding
                      ? githubBinding.displayName || githubBinding.email || githubBinding.providerUserId
                      : '未绑定'
                    : '未启用'}
              </span>
            </div>
          </div>
          <div className="oauth-binding-actions">
            {githubEnabled ? (
              githubBinding ? (
                <>
                  <Tag color={getProviderBadgeColor(githubBinding.provider)}>已绑定</Tag>
                  <Button
                    type="danger"
                    loading={unbindingProvider === 'github'}
                    onClick={() => confirmUnbind('github')}
                  >
                    解绑
                  </Button>
                </>
              ) : (
                <>
                  <Tag color="grey">未绑定</Tag>
                  <Button theme="solid" type="primary" loading={binding} onClick={() => void startGitHubBinding()}>
                    绑定 GitHub
                  </Button>
                </>
              )
            ) : (
              <Tag color="grey">系统未启用</Tag>
            )}
          </div>
        </div>

        {githubBinding ? (
          <div className="oauth-binding-meta">
            <div>
              <Typography.Text type="tertiary">显示名</Typography.Text>
              <Typography.Paragraph>{githubBinding.displayName || '-'}</Typography.Paragraph>
            </div>
            <div>
              <Typography.Text type="tertiary">绑定邮箱</Typography.Text>
              <Typography.Paragraph>{githubBinding.email || '-'}</Typography.Paragraph>
            </div>
            <div>
              <Typography.Text type="tertiary">Provider ID</Typography.Text>
              <Typography.Paragraph>{githubBinding.providerUserId}</Typography.Paragraph>
            </div>
            <div>
              <Typography.Text type="tertiary">绑定时间</Typography.Text>
              <Typography.Paragraph>{formatDateTime(githubBinding.createdAt)}</Typography.Paragraph>
            </div>
          </div>
        ) : (
          <Typography.Text type="tertiary">
            绑定后可以直接用 GitHub 完成登录，也方便后续补更多第三方登录方式。
          </Typography.Text>
        )}

        <Space>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void loadBindings()}>
            刷新状态
          </Button>
          {!githubEnabled ? (
            <Button icon={<IconUser />} disabled>
              管理员尚未配置 GitHub 登录
            </Button>
          ) : null}
        </Space>
      </Space>
    </Card>
  );
}


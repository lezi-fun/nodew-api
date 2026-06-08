import { IconLink, IconRefresh, IconUser } from '@douyinfe/semi-icons';
import { Avatar, Button, Card, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useMemo, useState } from 'react';

import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { api, type OAuthBindingItem, type OAuthProvider } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { getEnabledOAuthProviders, getOAuthProviderMeta, isOAuthProviderEnabled, oauthProviders } from '../../lib/oauth';

export default function OAuthBindingCard() {
  const { user } = useContext(UserContext);
  const { status } = useContext(StatusContext);
  const [bindings, setBindings] = useState<OAuthBindingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingProvider, setBindingProvider] = useState<OAuthProvider | null>(null);
  const [unbindingProvider, setUnbindingProvider] = useState<OAuthProvider | null>(null);

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

  const bindingsByProvider = useMemo(
    () => new Map(bindings.map((item) => [item.provider, item])),
    [bindings],
  );

  const enabledProviders = getEnabledOAuthProviders(status);
  const visibleProviders = useMemo(() => {
    const providers = new Set<OAuthProvider>(oauthProviders);

    for (const provider of enabledProviders) {
      providers.add(provider);
    }

    for (const binding of bindings) {
      providers.add(binding.provider);
    }

    return Array.from(providers);
  }, [bindings, enabledProviders]);

  const startBinding = async (provider: OAuthProvider) => {
    const providerName = getOAuthProviderMeta(provider, status).label;
    setBindingProvider(provider);
    try {
      const response = await api.getOAuthState({
        provider,
        mode: 'bind',
        redirectTo: '/console/personal',
      });
      window.location.assign(response.data.authorizeUrl);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : `发起 ${providerName} 绑定失败`);
    } finally {
      setBindingProvider(null);
    }
  };

  const confirmUnbind = (provider: OAuthProvider) => {
    const providerName = getOAuthProviderMeta(provider, status).label;
    Modal.confirm({
      title: '确认解绑',
      content: `确定要解绑 ${providerName} 吗？`,
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
        <div className="oauth-binding-stack" style={{ width: '100%' }}>
          {visibleProviders.map((provider) => {
            const providerMeta = getOAuthProviderMeta(provider, status);
            const providerEnabled = isOAuthProviderEnabled(status, provider);
            const binding = bindingsByProvider.get(provider) ?? null;

            return (
              <div key={provider} className="oauth-binding-panel">
                <div className="oauth-binding-row">
                  <div className="oauth-binding-main">
                    <Avatar color={providerMeta.avatarColor} size="small">
                      {providerMeta.avatarContent}
                    </Avatar>
                    <div className="oauth-binding-text">
                      <strong>{providerMeta.label}</strong>
                      <span>
                        {loading
                          ? '加载中'
                          : providerEnabled
                            ? binding
                              ? binding.displayName || binding.email || binding.providerUserId
                              : '未绑定'
                            : '未启用'}
                      </span>
                    </div>
                  </div>
                  <div className="oauth-binding-actions">
                    {providerEnabled ? (
                      binding ? (
                        <>
                          <Tag color={providerMeta.tagColor}>已绑定</Tag>
                          <Button
                            type="danger"
                            loading={unbindingProvider === provider}
                            onClick={() => confirmUnbind(provider)}
                          >
                            解绑
                          </Button>
                        </>
                      ) : (
                        <>
                          <Tag color="grey">未绑定</Tag>
                          <Button
                            theme="solid"
                            type="primary"
                            loading={bindingProvider === provider}
                            onClick={() => void startBinding(provider)}
                          >
                            绑定 {providerMeta.label}
                          </Button>
                        </>
                      )
                    ) : (
                      <Tag color="grey">系统未启用</Tag>
                    )}
                  </div>
                </div>

                {binding ? (
                  <div className="oauth-binding-meta">
                    <div>
                      <Typography.Text type="tertiary">显示名</Typography.Text>
                      <Typography.Paragraph>{binding.displayName || '-'}</Typography.Paragraph>
                    </div>
                    <div>
                      <Typography.Text type="tertiary">绑定邮箱</Typography.Text>
                      <Typography.Paragraph>{binding.email || '-'}</Typography.Paragraph>
                    </div>
                    <div>
                      <Typography.Text type="tertiary">Provider ID</Typography.Text>
                      <Typography.Paragraph>{binding.providerUserId}</Typography.Paragraph>
                    </div>
                    <div>
                      <Typography.Text type="tertiary">绑定时间</Typography.Text>
                      <Typography.Paragraph>{formatDateTime(binding.createdAt)}</Typography.Paragraph>
                    </div>
                  </div>
                ) : (
                  <Typography.Text type="tertiary">
                    {providerEnabled
                      ? `绑定后可以直接用 ${providerMeta.label} 完成登录。`
                      : `${providerMeta.label} 尚未在系统中启用。`}
                  </Typography.Text>
                )}
              </div>
            );
          })}
        </div>

        <Space>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void loadBindings()}>
            刷新状态
          </Button>
          {enabledProviders.length === 0 ? (
            <Button icon={<IconUser />} disabled>
              管理员尚未配置第三方登录
            </Button>
          ) : null}
        </Space>
      </Space>
    </Card>
  );
}

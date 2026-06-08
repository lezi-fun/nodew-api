import { IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import { Avatar, Button, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { useEffect, useState } from 'react';

import { api, type OAuthBindingItem, type OAuthProvider, type UserItem } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { getOAuthProviderMeta, isOAuthProvider } from '../../lib/oauth';

type AdminOAuthBindingModalProps = {
  user: UserItem | null;
  visible: boolean;
  onCancel: () => void;
};

export default function AdminOAuthBindingModal({
  user,
  visible,
  onCancel,
}: AdminOAuthBindingModalProps) {
  const [bindings, setBindings] = useState<OAuthBindingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<OAuthProvider | null>(null);

  const loadBindings = async () => {
    if (!user) {
      setBindings([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.listUserOAuthBindings(user.id);
      setBindings(response.items);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载第三方绑定失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    void loadBindings();
  }, [visible, user?.id]);

  const confirmUnbind = (binding: OAuthBindingItem) => {
    if (!user) {
      return;
    }

    if (!isOAuthProvider(binding.provider)) {
      Toast.error('不支持的第三方类型');
      return;
    }

    const provider = binding.provider;

    Modal.confirm({
      title: '确认解绑',
      content: `确定要解绑 ${user.email} 的 ${binding.providerName} 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setDeletingProvider(provider);
        try {
          await api.deleteUserOAuthBinding(user.id, provider);
          setBindings((current) => current.filter((item) => item.id !== binding.id));
          Toast.success('解绑成功');
        } catch (error) {
          Toast.error(error instanceof Error ? error.message : '解绑失败');
        } finally {
          setDeletingProvider(null);
        }
      },
    });
  };

  return (
    <Modal
      title={user ? `${user.email} 的第三方绑定` : '第三方绑定'}
      visible={visible}
      footer={null}
      onCancel={onCancel}
      width={760}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="tertiary">
            当前支持查看和解绑已绑定的 GitHub、Discord、LinuxDO、OIDC 账号，后续新增 provider 也可沿用同一入口扩展。
          </Typography.Text>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void loadBindings()}>
            刷新
          </Button>
        </Space>

        {loading ? (
          <Typography.Text type="tertiary">正在加载第三方绑定...</Typography.Text>
        ) : bindings.length === 0 ? (
          <Typography.Text type="tertiary">当前没有第三方绑定。</Typography.Text>
        ) : (
          <div className="oauth-binding-stack">
            {bindings.map((binding) => {
              const providerMeta = getOAuthProviderMeta(binding.provider);

              return (
                <div key={binding.id} className="oauth-binding-panel">
                  <div className="oauth-binding-row">
                    <div className="oauth-binding-main">
                      <Avatar color={providerMeta.avatarColor} size="small">
                        {providerMeta.avatarContent}
                      </Avatar>
                      <div className="oauth-binding-text">
                        <strong>{binding.providerName}</strong>
                        <span>{binding.displayName || binding.email || binding.providerUserId}</span>
                      </div>
                    </div>
                    <div className="oauth-binding-actions">
                      <Tag color={providerMeta.tagColor}>已绑定</Tag>
                      <Button
                        type="danger"
                        icon={<IconDelete />}
                        loading={deletingProvider === binding.provider}
                        onClick={() => confirmUnbind(binding)}
                      >
                        解绑
                      </Button>
                    </div>
                  </div>

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
                </div>
              );
            })}
          </div>
        )}
      </Space>
    </Modal>
  );
}

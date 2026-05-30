import { IconKey, IconLock, IconRefresh, IconShield } from '@douyinfe/semi-icons';
import { Button, Card, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useContext, useEffect, useState } from 'react';

import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { api, type PasskeyStatus } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

export default function PasskeySettingCard() {
  const { user } = useContext(UserContext);
  const { status } = useContext(StatusContext);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [supported, setSupported] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<PasskeyStatus | null>(null);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  const passkeyEnabled = status?.passkey?.enabled === true;

  const loadStatus = async () => {
    if (!user || !passkeyEnabled) {
      setPasskeyStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.getPasskeyStatus();
      setPasskeyStatus(response.item);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载 Passkey 状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [user?.id, passkeyEnabled]);

  const registerPasskey = async () => {
    if (!supported) {
      Toast.error('当前浏览器不支持 Passkey');
      return;
    }

    setRunning(true);
    try {
      const beginResponse = await api.passkeyRegisterBegin();
      const response = await startRegistration({
        optionsJSON: beginResponse.item,
      });
      await api.passkeyRegisterFinish({ response });
      Toast.success('Passkey 注册成功');
      await loadStatus();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'Passkey 注册失败');
    } finally {
      setRunning(false);
    }
  };

  const verifyPasskey = async () => {
    if (!supported) {
      Toast.error('当前浏览器不支持 Passkey');
      return;
    }

    setVerifying(true);
    try {
      const beginResponse = await api.passkeyVerifyBegin();
      const response = await startAuthentication({
        optionsJSON: beginResponse.item,
      });
      await api.passkeyVerifyFinish({ response });
      Toast.success('Passkey 验证成功');
      await loadStatus();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'Passkey 验证失败');
    } finally {
      setVerifying(false);
    }
  };

  const deletePasskey = async () => {
    if (!window.confirm('解绑 Passkey 后将无法使用该方式登录，确认继续吗？')) {
      return;
    }

    setDeleting(true);
    try {
      await api.deletePasskey();
      Toast.success('Passkey 已解绑');
      await loadStatus();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'Passkey 解绑失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card title={<span><IconShield /> Passkey</span>} bordered={false} className="dashboard-card">
      <Space vertical align="start">
        <Typography.Text type="tertiary">安全状态</Typography.Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {passkeyEnabled ? <Tag color="blue">系统已启用</Tag> : <Tag color="grey">系统未启用</Tag>}
          {supported ? <Tag color="green">浏览器支持</Tag> : <Tag color="orange">浏览器不支持</Tag>}
          {passkeyStatus?.enabled ? <Tag color="green">已绑定</Tag> : <Tag color="grey">未绑定</Tag>}
        </div>
        <Typography.Title heading={4} style={{ margin: 0 }}>
          {loading ? '加载中' : passkeyStatus?.enabled ? 'Passkey 已启用' : 'Passkey 未启用'}
        </Typography.Title>
        <Typography.Text type="tertiary">
          {passkeyEnabled
            ? passkeyStatus?.enabled
              ? `最近使用：${formatDateTime(passkeyStatus.lastUsedAt)}`
              : '注册后可以用生物识别或安全密钥完成登录。'
            : '管理员未开启 Passkey 登录。'}
        </Typography.Text>
        {passkeyStatus?.enabled ? (
          <Typography.Text type="tertiary">
            创建时间：{formatDateTime(passkeyStatus.createdAt)}
          </Typography.Text>
        ) : null}
        <Space wrap>
          {passkeyStatus?.enabled ? (
            <>
              <Button icon={<IconShield />} loading={verifying} disabled={!passkeyEnabled || !supported} onClick={() => void verifyPasskey()}>
                立即验证
              </Button>
              <Button type="danger" icon={<IconLock />} loading={deleting} disabled={!passkeyEnabled} onClick={() => void deletePasskey()}>
                解绑 Passkey
              </Button>
            </>
          ) : (
            <Button
              theme="solid"
              type="primary"
              icon={<IconKey />}
              loading={running}
              disabled={!passkeyEnabled || !supported}
              onClick={() => void registerPasskey()}
            >
              注册 Passkey
            </Button>
          )}
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void loadStatus()}>
            刷新状态
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

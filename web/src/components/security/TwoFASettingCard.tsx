import { IconCopy, IconLock, IconRefresh, IconShield } from '@douyinfe/semi-icons';
import { Button, Card, Input, Modal, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { useContext, useEffect, useState } from 'react';

import { UserContext } from '../../context/User';
import { api, type TwoFABackupCodesResult, type TwoFASetupResult, type TwoFAStatus } from '../../lib/api';

const copyText = async (value: string, message: string) => {
  await navigator.clipboard.writeText(value);
  Toast.success(message);
};

const renderCodes = (codes: string[]) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {codes.map((code) => (
      <Tag key={code} color="blue">
        {code}
      </Tag>
    ))}
  </div>
);

export default function TwoFASettingCard() {
  const { user } = useContext(UserContext);
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [enableLoading, setEnableLoading] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [setupVisible, setSetupVisible] = useState(false);
  const [disableVisible, setDisableVisible] = useState(false);
  const [regenerateVisible, setRegenerateVisible] = useState(false);
  const [setupResult, setSetupResult] = useState<TwoFASetupResult | null>(null);
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<TwoFABackupCodesResult | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenerateCode, setRegenerateCode] = useState('');

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      if (!user) {
        setStatus(null);
        setLoadingStatus(false);
        return;
      }

      setLoadingStatus(true);
      try {
        const response = await api.getTwoFAStatus();

        if (active) {
          setStatus(response.item);
        }
      } catch (error) {
        if (active) {
          Toast.error(error instanceof Error ? error.message : '加载 2FA 状态失败');
        }
      } finally {
        if (active) {
          setLoadingStatus(false);
        }
      }
    };

    void loadStatus();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const refreshStatus = async () => {
    if (!user) {
      setStatus(null);
      setLoadingStatus(false);
      return;
    }

    setLoadingStatus(true);
    try {
      const response = await api.getTwoFAStatus();
      setStatus(response.item);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载 2FA 状态失败');
    } finally {
      setLoadingStatus(false);
    }
  };

  const closeSetupModal = () => {
    setSetupVisible(false);
    setSetupResult(null);
    setSetupCode('');
  };

  const closeDisableModal = () => {
    setDisableVisible(false);
    setDisableCode('');
  };

  const closeRegenerateModal = () => {
    setRegenerateVisible(false);
    setGeneratedBackupCodes(null);
    setRegenerateCode('');
  };

  const startSetup = async () => {
    setSetupLoading(true);
    try {
      const response = await api.setupTwoFA();
      setSetupResult(response.item);
      setSetupCode('');
      setSetupVisible(true);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '初始化 2FA 失败');
    } finally {
      setSetupLoading(false);
    }
  };

  const enableTwoFA = async () => {
    if (!setupCode.trim()) {
      Toast.error('请输入验证码');
      return;
    }

    setEnableLoading(true);
    try {
      await api.enableTwoFA({ code: setupCode.trim() });
      Toast.success('两步验证已启用');
      closeSetupModal();
      await refreshStatus();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '启用 2FA 失败');
    } finally {
      setEnableLoading(false);
    }
  };

  const openDisableModal = () => {
    setDisableCode('');
    setDisableVisible(true);
  };

  const disableTwoFA = async () => {
    if (!disableCode.trim()) {
      Toast.error('请输入验证码或备用码');
      return;
    }

    setDisableLoading(true);
    try {
      await api.disableTwoFA({ code: disableCode.trim() });
      Toast.success('两步验证已禁用');
      closeDisableModal();
      await refreshStatus();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '禁用 2FA 失败');
    } finally {
      setDisableLoading(false);
    }
  };

  const openRegenerateModal = () => {
    setGeneratedBackupCodes(null);
    setRegenerateCode('');
    setRegenerateVisible(true);
  };

  const regenerateBackupCodes = async () => {
    if (!regenerateCode.trim()) {
      Toast.error('请输入当前验证码');
      return;
    }

    setRegenerateLoading(true);
    try {
      const response = await api.regenerateTwoFABackupCodes({ code: regenerateCode.trim() });
      setGeneratedBackupCodes(response.item);
      setRegenerateCode('');
      Toast.success('备用码已重新生成');
      await refreshStatus();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '重新生成备用码失败');
    } finally {
      setRegenerateLoading(false);
    }
  };

  const statusTag = status?.enabled
    ? <Tag color="green">已启用</Tag>
    : <Tag color="grey">未启用</Tag>;

  return (
    <>
      <Card title={<span><IconShield /> 两步验证</span>} bordered={false} className="dashboard-card">
        <Space vertical align="start">
          <Typography.Text type="tertiary">安全状态</Typography.Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {statusTag}
            {status?.locked ? <Tag color="orange">已锁定</Tag> : null}
          </div>
          <Typography.Title heading={4} style={{ margin: 0 }}>
            {loadingStatus ? '加载中' : status?.enabled ? '两步验证已开启' : '两步验证未开启'}
          </Typography.Title>
          <Typography.Text type="tertiary">
            {status?.enabled
              ? `剩余备用码 ${status.backupCodesRemaining} 个`
              : '开启后可使用验证器验证码或备用码保护账号。'}
          </Typography.Text>
          <Space wrap>
            {status?.enabled ? (
              <>
                <Button icon={<IconRefresh />} onClick={() => void openRegenerateModal()}>
                  重新生成备用码
                </Button>
                <Button type="danger" icon={<IconLock />} loading={disableLoading} onClick={() => void openDisableModal()}>
                  禁用 2FA
                </Button>
              </>
            ) : (
              <Button theme="solid" type="primary" icon={<IconShield />} loading={setupLoading} onClick={() => void startSetup()}>
                开始设置
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      <Modal
        title="初始化两步验证"
        visible={setupVisible}
        onCancel={closeSetupModal}
        onOk={() => void enableTwoFA()}
        confirmLoading={enableLoading}
        okText="启用 2FA"
        width={720}
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Typography.Paragraph type="tertiary" style={{ marginBottom: 0 }}>
            先把下面的密钥或 otpauth 链接录入认证器应用，再输入验证码完成启用。备用码只会显示一次。
          </Typography.Paragraph>
          {setupResult ? (
            <>
              <div style={{ display: 'grid', gap: 10, width: '100%' }}>
                <div>
                  <Typography.Text type="tertiary">TOTP 密钥</Typography.Text>
                  <div className="secret-box">
                    <code>{setupResult.secret}</code>
                    <Button icon={<IconCopy />} onClick={() => void copyText(setupResult.secret, 'TOTP 密钥已复制')}>
                      复制
                    </Button>
                  </div>
                </div>
                <div>
                  <Typography.Text type="tertiary">otpauth 链接</Typography.Text>
                  <div className="secret-box">
                    <code>{setupResult.qrCodeData}</code>
                    <Button icon={<IconCopy />} onClick={() => void copyText(setupResult.qrCodeData, 'otpauth 链接已复制')}>
                      复制
                    </Button>
                  </div>
                </div>
                <div>
                  <Typography.Text type="tertiary">备用码</Typography.Text>
                  {renderCodes(setupResult.backupCodes)}
                  <Button
                    style={{ marginTop: 12 }}
                    icon={<IconCopy />}
                    onClick={() => void copyText(setupResult.backupCodes.join('\n'), '备用码已复制')}
                  >
                    复制全部备用码
                  </Button>
                </div>
                <label className="form-block">
                  <span>验证码</span>
                  <Input value={setupCode} placeholder="123456" onChange={setSetupCode} />
                </label>
              </div>
            </>
          ) : null}
        </Space>
      </Modal>

      <Modal
        title="重新生成备用码"
        visible={regenerateVisible}
        onCancel={closeRegenerateModal}
        onOk={() => (generatedBackupCodes ? closeRegenerateModal() : void regenerateBackupCodes())}
        confirmLoading={regenerateLoading}
        okText={generatedBackupCodes ? '关闭' : '重新生成'}
        width={640}
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Typography.Paragraph type="tertiary" style={{ marginBottom: 0 }}>
            输入当前验证码后会立即替换旧备用码，原来的备用码会失效。
          </Typography.Paragraph>
          {generatedBackupCodes ? (
            <Space vertical align="start" style={{ width: '100%' }}>
              {renderCodes(generatedBackupCodes.backupCodes)}
              <Button
                icon={<IconCopy />}
                onClick={() => void copyText(generatedBackupCodes.backupCodes.join('\n'), '备用码已复制')}
              >
                复制全部备用码
              </Button>
            </Space>
          ) : (
            <label className="form-block" style={{ width: '100%' }}>
              <span>当前验证码</span>
              <Input value={regenerateCode} placeholder="123456" onChange={setRegenerateCode} />
            </label>
          )}
        </Space>
      </Modal>

      <Modal
        title="禁用两步验证"
        visible={disableVisible}
        onCancel={closeDisableModal}
        onOk={() => void disableTwoFA()}
        confirmLoading={disableLoading}
        okText="禁用 2FA"
        width={520}
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Typography.Paragraph type="tertiary" style={{ marginBottom: 0 }}>
            请输入当前验证码或备用码完成禁用。
          </Typography.Paragraph>
          <label className="form-block" style={{ width: '100%' }}>
            <span>验证码 / 备用码</span>
            <Input value={disableCode} placeholder="123456" onChange={setDisableCode} />
          </label>
        </Space>
      </Modal>
    </>
  );
}

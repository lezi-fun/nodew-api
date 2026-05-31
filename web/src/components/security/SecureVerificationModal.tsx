import { Button, Input, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';

type SecureVerificationModalProps = {
  visible: boolean;
  title?: string;
  description?: string;
  onSuccess: () => Promise<void> | void;
  onCancel: () => void;
};

export default function SecureVerificationModal({
  visible,
  title = '安全验证',
  description = '继续之前，请先完成一次额外验证。',
  onSuccess,
  onCancel,
}: SecureVerificationModalProps) {
  const [code, setCode] = useState('');
  const [supported, setSupported] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  useEffect(() => {
    if (!visible) {
      setCode('');
      setVerifyingCode(false);
      setVerifyingPasskey(false);
    }
  }, [visible]);

  const verifyWithCode = async () => {
    if (!code.trim()) {
      Toast.error('请输入验证码或备用码');
      return;
    }

    setVerifyingCode(true);
    try {
      await api.verifySecureAction({
        method: '2fa',
        code: code.trim(),
      });
      await onSuccess();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '安全验证失败');
    } finally {
      setVerifyingCode(false);
    }
  };

  const verifyWithPasskey = async () => {
    if (!supported) {
      Toast.error('当前浏览器不支持 Passkey');
      return;
    }

    setVerifyingPasskey(true);
    try {
      const beginResponse = await api.passkeyVerifyBegin();
      const response = await startAuthentication({
        optionsJSON: beginResponse.item,
      });
      await api.passkeyVerifyFinish({ response });
      await api.verifySecureAction({ method: 'passkey' });
      await onSuccess();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'Passkey 验证失败');
    } finally {
      setVerifyingPasskey(false);
    }
  };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={onCancel}
      onOk={() => void verifyWithCode()}
      confirmLoading={verifyingCode}
      okText="用验证码验证"
      width={560}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Paragraph type="tertiary" style={{ marginBottom: 0 }}>
          {description}
        </Typography.Paragraph>
        <label className="form-block" style={{ width: '100%' }}>
          <span>验证码 / 备用码</span>
          <Input value={code} placeholder="123456 或 ABCD-EFGH" onChange={setCode} />
        </label>
        <Button
          icon={undefined}
          loading={verifyingPasskey}
          disabled={!supported}
          onClick={() => void verifyWithPasskey()}
        >
          使用 Passkey 验证
        </Button>
      </Space>
    </Modal>
  );
}

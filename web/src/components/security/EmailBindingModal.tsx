import { IconKey, IconMail } from '@douyinfe/semi-icons';
import { Button, Input, Modal, Space, Typography } from '@douyinfe/semi-ui';

type EmailBindingModalProps = {
  visible: boolean;
  email: string;
  code: string;
  loadingRequest: boolean;
  loadingVerify: boolean;
  onCancel: () => void;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onRequest: () => void;
  onVerify: () => void;
};

export default function EmailBindingModal({
  visible,
  email,
  code,
  loadingRequest,
  loadingVerify,
  onCancel,
  onEmailChange,
  onCodeChange,
  onRequest,
  onVerify,
}: EmailBindingModalProps) {
  return (
    <Modal
      title="绑定新邮箱"
      visible={visible}
      onCancel={onCancel}
      onOk={onVerify}
      okText="确认绑定"
      confirmLoading={loadingVerify}
      width={520}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Text type="tertiary">
          验证邮件会发送到新的邮箱地址。打开邮件里的链接，或把验证码填到这里，都可以完成绑定。
        </Typography.Text>
        <Input
          value={email}
          onChange={onEmailChange}
          placeholder="新的邮箱地址"
          prefix={<IconMail />}
        />
        <Space style={{ width: '100%' }}>
          <Input
            value={code}
            onChange={onCodeChange}
            placeholder="6 位验证码"
            prefix={<IconKey />}
          />
          <Button loading={loadingRequest} onClick={onRequest}>
            发送验证邮件
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}

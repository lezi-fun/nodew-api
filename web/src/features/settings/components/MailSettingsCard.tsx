import { Button, Card, Input, Select, Space, Switch, Typography } from '@douyinfe/semi-ui';
import { IconSave } from '@douyinfe/semi-icons';

import type { MailConfig, MailProvider, MailStatus } from '../../../lib/api';

type MailSettingsCardProps = {
  visible: boolean;
  config: MailConfig;
  status: MailStatus | null;
  saving: boolean;
  testing: boolean;
  testRecipient: string;
  userEmail?: string;
  onConfigChange: (patch: Partial<MailConfig>) => void;
  onTestRecipientChange: (value: string) => void;
  onSave: () => void;
  onSendTest: () => void;
};

export default function MailSettingsCard({
  visible,
  config,
  status,
  saving,
  testing,
  testRecipient,
  userEmail,
  onConfigChange,
  onTestRecipientChange,
  onSave,
  onSendTest,
}: MailSettingsCardProps) {
  const update = <K extends keyof MailConfig>(key: K, value: MailConfig[K]) => {
    onConfigChange({ [key]: value } as Partial<MailConfig>);
  };

  return (
    <Card
      bordered={false}
      className="dashboard-card settings-card"
      style={{ marginTop: 16, display: visible ? undefined : 'none' }}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <div>
          <Typography.Title heading={5} style={{ marginBottom: 4 }}>邮件配置</Typography.Title>
          <Typography.Paragraph type="tertiary">
            在这里配置邮件发送方式。保存后，注册验证、密码重置、邮箱验证和测试邮件都会立即使用这套配置。
          </Typography.Paragraph>
        </div>
        <div className="settings-grid" style={{ width: '100%' }}>
          <label className="setting-field">
            <span><strong>发送方式</strong><em>关闭后不会发送任何邮件。</em></span>
            <Select value={config.provider} onChange={(value) => update('provider', String(value) as MailProvider)}>
              <Select.Option value="disabled">disabled</Select.Option>
              <Select.Option value="smtp">smtp</Select.Option>
              <Select.Option value="resend">resend</Select.Option>
            </Select>
          </label>
          <label className="setting-field">
            <span><strong>应用地址</strong><em>生成验证链接和重置链接时使用。</em></span>
            <Input value={config.appBaseUrl} placeholder="https://console.example.com" onChange={(value) => update('appBaseUrl', value)} />
          </label>
          <label className="setting-field">
            <span><strong>发件地址</strong><em>用于发件人 From。</em></span>
            <Input value={config.from} placeholder="noreply@example.com" onChange={(value) => update('from', value)} />
          </label>
          {config.provider === 'smtp' ? (
            <>
              <label className="setting-field">
                <span><strong>SMTP Host</strong><em>SMTP 服务器地址。</em></span>
                <Input value={config.smtpHost} placeholder="smtp.example.com" onChange={(value) => update('smtpHost', value)} />
              </label>
              <label className="setting-field">
                <span><strong>SMTP Port</strong><em>例如 465 或 587。</em></span>
                <Input value={config.smtpPort} placeholder="465" onChange={(value) => update('smtpPort', value)} />
              </label>
              <label className="setting-field">
                <span><strong>SMTP User</strong><em>SMTP 登录用户名。</em></span>
                <Input value={config.smtpUser} placeholder="mailer" onChange={(value) => update('smtpUser', value)} />
              </label>
              <label className="setting-field">
                <span><strong>SMTP Password</strong><em>SMTP 登录密码或授权码。</em></span>
                <Input mode="password" value={config.smtpPass} placeholder="secret" onChange={(value) => update('smtpPass', value)} />
              </label>
              <label className="setting-field">
                <span><strong>SMTP Secure</strong><em>通常 465 为开启，587 视服务商而定。</em></span>
                <Switch checked={config.smtpSecure} onChange={(value) => update('smtpSecure', value)} />
              </label>
            </>
          ) : null}
          {config.provider === 'resend' ? (
            <label className="setting-field">
              <span><strong>Resend API Key</strong><em>用于调用 Resend 发信。</em></span>
              <Input mode="password" value={config.resendApiKey} placeholder="re_xxx" onChange={(value) => update('resendApiKey', value)} />
            </label>
          ) : null}
        </div>
        <Space wrap>
          <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={onSave}>保存邮件配置</Button>
          <Typography.Text>当前来源：{status?.source ?? '-'}</Typography.Text>
          <Typography.Text>当前状态：{status?.enabled ? '已启用' : '未启用'}</Typography.Text>
          <Typography.Text>配置校验：{status?.valid ? '通过' : '未通过'}</Typography.Text>
        </Space>
        {status?.errors.length ? (
          <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
            {status.errors.join('；')}
          </Typography.Paragraph>
        ) : null}
        <Input value={testRecipient} placeholder={userEmail ?? '输入测试收件邮箱'} onChange={onTestRecipientChange} />
        <Button theme="solid" loading={testing} disabled={!status?.enabled || !status?.valid} onClick={onSendTest}>
          发送测试邮件
        </Button>
      </Space>
    </Card>
  );
}

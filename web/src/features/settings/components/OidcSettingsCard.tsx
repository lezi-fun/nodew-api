import { Button, Card, Input, Space, Switch, Typography } from '@douyinfe/semi-ui';
import { IconSave } from '@douyinfe/semi-icons';

import type { OAuthConfig, OAuthStatus } from '../../../lib/api';

type OidcSettingsCardProps = {
  visible: boolean;
  config: OAuthConfig['oidc'];
  status: OAuthStatus | null;
  discovering: boolean;
  saving: boolean;
  onConfigChange: (patch: Partial<OAuthConfig['oidc']>) => void;
  onDiscover: () => void;
  onSave: () => void;
};

export default function OidcSettingsCard({
  visible,
  config,
  status,
  discovering,
  saving,
  onConfigChange,
  onDiscover,
  onSave,
}: OidcSettingsCardProps) {
  const update = <K extends keyof OAuthConfig['oidc']>(key: K, value: OAuthConfig['oidc'][K]) => {
    onConfigChange({ [key]: value } as Partial<OAuthConfig['oidc']>);
  };

  return (
    <Card
      bordered={false}
      className="dashboard-card settings-card"
      style={{ marginTop: 16, display: visible ? undefined : 'none' }}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <div>
          <Typography.Title heading={5} style={{ marginBottom: 4 }}>OIDC 登录设置</Typography.Title>
          <Typography.Paragraph type="tertiary">
            配置 OIDC 登录入口。回调地址固定为当前应用地址下的 /oauth/oidc。
          </Typography.Paragraph>
        </div>
        <div className="settings-grid" style={{ width: '100%' }}>
          <label className="setting-field">
            <span><strong>启用 OIDC 登录</strong><em>开启后，配置校验通过且应用地址存在时登录页会显示 OIDC。</em></span>
            <Switch checked={config.enabled} onChange={(value) => update('enabled', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Well-Known URL</strong><em>可选。填写后可自动获取授权、token 与 userinfo 端点。</em></span>
            <Input value={config.wellKnownUrl} placeholder="https://id.example.com/.well-known/openid-configuration" onChange={(value) => update('wellKnownUrl', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Client ID</strong><em>OIDC 应用的客户端 ID。</em></span>
            <Input value={config.clientId} placeholder="oidc-client-id" onChange={(value) => update('clientId', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Client Secret</strong><em>OIDC 应用的客户端密钥。</em></span>
            <Input mode="password" value={config.clientSecret} placeholder="oidc-client-secret" onChange={(value) => update('clientSecret', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Authorization Endpoint</strong><em>用于发起授权跳转。</em></span>
            <Input value={config.authorizationUrl} placeholder="https://id.example.com/oauth2/authorize" onChange={(value) => update('authorizationUrl', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Token Endpoint</strong><em>用于授权码换 access token。</em></span>
            <Input value={config.tokenUrl} placeholder="https://id.example.com/oauth2/token" onChange={(value) => update('tokenUrl', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Userinfo Endpoint</strong><em>必须返回 sub 和 email。</em></span>
            <Input value={config.userInfoUrl} placeholder="https://id.example.com/oauth2/userinfo" onChange={(value) => update('userInfoUrl', value)} />
          </label>
          <label className="setting-field">
            <span><strong>Scope</strong><em>默认使用 openid profile email。</em></span>
            <Input value={config.scope} placeholder="openid profile email" onChange={(value) => update('scope', value)} />
          </label>
        </div>
        <Space wrap>
          <Button loading={discovering} onClick={onDiscover}>获取 OIDC 端点</Button>
          <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={onSave}>保存 OAuth 设置</Button>
          <Typography.Text>当前来源：{status?.source ?? '-'}</Typography.Text>
          <Typography.Text>应用地址：{status?.appBaseUrlConfigured ? '已配置' : '未配置'}</Typography.Text>
          <Typography.Text>OIDC 状态：{status?.oidc.enabled && status?.appBaseUrlConfigured ? '已启用' : '未启用'}</Typography.Text>
          <Typography.Text>配置校验：{status?.valid ? '通过' : '未通过'}</Typography.Text>
        </Space>
        {status?.errors.length ? (
          <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
            {status.errors.join('；')}
          </Typography.Paragraph>
        ) : null}
      </Space>
    </Card>
  );
}

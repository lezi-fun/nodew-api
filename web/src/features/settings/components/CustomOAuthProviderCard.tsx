import { Button, Card, Input, Select, Space, Switch, TextArea, Typography } from '@douyinfe/semi-ui';
import { IconSave } from '@douyinfe/semi-icons';

import type { CustomOAuthProvider, CustomOAuthProviderPayload } from '../../../lib/api';

type CustomOAuthProviderCardProps = {
  visible: boolean;
  providers: CustomOAuthProvider[];
  form: CustomOAuthProviderPayload;
  editingProviderId: string | null;
  saving: boolean;
  discovering: boolean;
  deletingProviderId: string | null;
  onFormChange: (patch: Partial<CustomOAuthProviderPayload>) => void;
  onDiscover: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onEdit: (provider: CustomOAuthProvider) => void;
  onDelete: (id: string) => void;
};

export default function CustomOAuthProviderCard({
  visible,
  providers,
  form,
  editingProviderId,
  saving,
  discovering,
  deletingProviderId,
  onFormChange,
  onDiscover,
  onSave,
  onCancelEdit,
  onEdit,
  onDelete,
}: CustomOAuthProviderCardProps) {
  const update = <K extends keyof CustomOAuthProviderPayload>(key: K, value: CustomOAuthProviderPayload[K]) => {
    onFormChange({ [key]: value } as Partial<CustomOAuthProviderPayload>);
  };

  return (
    <Card
      bordered={false}
      className="dashboard-card settings-card"
      style={{ marginTop: 16, display: visible ? undefined : 'none' }}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <div>
          <Typography.Title heading={5} style={{ marginBottom: 4 }}>自定义 OAuth Provider</Typography.Title>
          <Typography.Paragraph type="tertiary">
            管理自定义 provider 配置。启用后会出现在登录页和个人页绑定入口，并按字段映射与访问策略执行回调。
          </Typography.Paragraph>
        </div>

        <div className="settings-grid" style={{ width: '100%' }}>
          <label className="setting-field">
            <span>
              <strong>启用</strong>
              <em>开启后 provider 会进入登录与绑定入口。</em>
            </span>
            <Switch checked={form.enabled} onChange={(checked) => update('enabled', checked)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>名称</strong>
              <em>展示给用户的 provider 名称。</em>
            </span>
            <Input value={form.name} placeholder="GitLab" onChange={(value) => update('name', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Slug</strong>
              <em>只允许小写字母、数字和连字符。</em>
            </span>
            <Input value={form.slug} placeholder="gitlab" onChange={(value) => update('slug', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>图标名</strong>
              <em>可选，用于后续登录入口展示。</em>
            </span>
            <Input value={form.icon} placeholder="gitlab" onChange={(value) => update('icon', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Client ID</strong>
              <em>OAuth 应用的客户端 ID。</em>
            </span>
            <Input value={form.clientId} placeholder="oauth-client-id" onChange={(value) => update('clientId', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Client Secret</strong>
              <em>{editingProviderId ? '留空则保留原密钥。' : '创建 provider 时必填。'}</em>
            </span>
            <Input mode="password" value={form.clientSecret} placeholder="oauth-client-secret" onChange={(value) => update('clientSecret', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Well-Known URL</strong>
              <em>可选，用于自动获取核心端点。</em>
            </span>
            <Input value={form.wellKnownUrl} placeholder="https://id.example.com/.well-known/openid-configuration" onChange={(value) => update('wellKnownUrl', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Authorization Endpoint</strong>
              <em>发起 OAuth 授权跳转。</em>
            </span>
            <Input value={form.authorizationUrl} placeholder="https://id.example.com/oauth2/authorize" onChange={(value) => update('authorizationUrl', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Token Endpoint</strong>
              <em>授权码换 access token。</em>
            </span>
            <Input value={form.tokenUrl} placeholder="https://id.example.com/oauth2/token" onChange={(value) => update('tokenUrl', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Userinfo Endpoint</strong>
              <em>读取第三方用户资料。</em>
            </span>
            <Input value={form.userInfoUrl} placeholder="https://id.example.com/oauth2/userinfo" onChange={(value) => update('userInfoUrl', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Scopes</strong>
              <em>默认 openid profile email。</em>
            </span>
            <Input value={form.scopes} placeholder="openid profile email" onChange={(value) => update('scopes', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Token Auth Style</strong>
              <em>auto、参数传递或 Basic Auth。</em>
            </span>
            <Select value={form.authStyle} onChange={(value) => update('authStyle', Number(value) as CustomOAuthProviderPayload['authStyle'])}>
              <Select.Option value={0}>auto</Select.Option>
              <Select.Option value={1}>params</Select.Option>
              <Select.Option value={2}>basic</Select.Option>
            </Select>
          </label>
          <label className="setting-field">
            <span>
              <strong>User ID Field</strong>
              <em>用户唯一标识字段路径。</em>
            </span>
            <Input value={form.userIdField} placeholder="sub" onChange={(value) => update('userIdField', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Username Field</strong>
              <em>用户名字段路径。</em>
            </span>
            <Input value={form.usernameField} placeholder="preferred_username" onChange={(value) => update('usernameField', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Display Name Field</strong>
              <em>显示名字段路径。</em>
            </span>
            <Input value={form.displayNameField} placeholder="name" onChange={(value) => update('displayNameField', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>Email Field</strong>
              <em>邮箱字段路径。</em>
            </span>
            <Input value={form.emailField} placeholder="email" onChange={(value) => update('emailField', value)} />
          </label>
          <label className="setting-field">
            <span>
              <strong>访问策略</strong>
              <em>登录或绑定前会按该策略校验 userinfo。</em>
            </span>
            <TextArea
              rows={4}
              value={form.accessPolicy}
              placeholder='{"field":"groups","operator":"contains","value":"admin"}'
              onChange={(value) => update('accessPolicy', value)}
            />
          </label>
          <label className="setting-field">
            <span>
              <strong>拒绝提示</strong>
              <em>访问策略拒绝时展示。</em>
            </span>
            <TextArea
              rows={4}
              value={form.accessDeniedMessage}
              placeholder="当前账号不满足登录条件。"
              onChange={(value) => update('accessDeniedMessage', value)}
            />
          </label>
        </div>

        <Space wrap>
          <Button loading={discovering} onClick={onDiscover}>获取自定义 OAuth 端点</Button>
          <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={onSave}>
            {editingProviderId ? '更新 provider' : '创建 provider'}
          </Button>
          {editingProviderId ? <Button onClick={onCancelEdit}>取消编辑</Button> : null}
        </Space>

        <div className="oauth-binding-stack" style={{ width: '100%' }}>
          {providers.length > 0 ? providers.map((provider) => (
            <div key={provider.id} className="oauth-binding-panel">
              <div className="oauth-binding-row">
                <div className="oauth-binding-main">
                  <div className="oauth-binding-avatar">{provider.icon || provider.name.slice(0, 1).toUpperCase()}</div>
                  <div className="oauth-binding-text">
                    <strong>{provider.name}</strong>
                    <span>{provider.slug} · {provider.enabled ? '已启用' : '已禁用'} · {provider.hasClientSecret ? '已保存密钥' : '未保存密钥'}</span>
                  </div>
                </div>
                <div className="oauth-binding-actions">
                  <Button onClick={() => onEdit(provider)}>编辑</Button>
                  <Button type="danger" loading={deletingProviderId === provider.id} onClick={() => onDelete(provider.id)}>
                    删除
                  </Button>
                </div>
              </div>
              <div className="oauth-binding-meta">
                <span>Authorization: {provider.authorizationUrl}</span>
                <span>Userinfo: {provider.userInfoUrl}</span>
              </div>
            </div>
          )) : (
            <Typography.Text type="tertiary">还没有自定义 OAuth provider。</Typography.Text>
          )}
        </div>
      </Space>
    </Card>
  );
}

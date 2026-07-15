import { Button, Card, Input, InputNumber, Popconfirm, Select, Space, Switch, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconPlus, IconRefresh, IconSave } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { UserContext } from '../context/User';
import {
  api,
  type CustomOAuthProvider,
  type CustomOAuthProviderPayload,
  type MailConfig,
  type MailStatus,
  type OAuthConfig,
  type OAuthStatus,
  type SubscriptionPlanItem,
  type SystemOptionItem,
  type SystemOptionKey,
} from '../lib/api';
import { loadSettingsResources } from '../lib/settings-loader';
import {
  getSettingSection,
  getSettingSectionNavigationProps,
  getSettingSectionPageDescription,
  isSettingSectionActive,
  settingSections,
  type SettingSection,
  updateSettingSectionSearch,
} from '../lib/settings-sections';

const generalOptionMeta: Array<{
  key: SystemOptionKey;
  title: string;
  description: string;
  type: 'text' | 'textarea' | 'boolean';
}> = [
  { key: 'site_name', title: '站点名称', description: '显示在浏览器标题、顶栏和公开页面。', type: 'text' },
  { key: 'site_description', title: '站点描述', description: '公开首页与控制台说明文案。', type: 'text' },
  { key: 'default_model', title: '默认模型', description: '操练场和示例请求的默认模型。', type: 'text' },
  { key: 'notice', title: '站点公告', description: '公开首页、关于页和控制台提示使用。', type: 'textarea' },
  { key: 'home_page_content', title: '首页补充内容', description: '展示在公开首页的补充 Markdown/纯文本内容。', type: 'textarea' },
  { key: 'about', title: '关于内容', description: '关于页面展示的项目或站点介绍。', type: 'textarea' },
  { key: 'user_agreement', title: '用户协议', description: '预留给注册和合规页面使用。', type: 'textarea' },
  { key: 'privacy_policy', title: '隐私政策', description: '预留给注册和合规页面使用。', type: 'textarea' },
  { key: 'registration_enabled', title: '允许注册', description: '关闭后仅管理员可创建用户。', type: 'boolean' },
  { key: 'registration_email_verification_required', title: '注册前验证邮箱', description: '开启后，用户必须先点击验证邮件或输入验证码，才能完成注册。', type: 'boolean' },
  { key: 'self_use_mode_enabled', title: '自用模式', description: '隐藏注册和部分公开入口。', type: 'boolean' },
  { key: 'demo_site_enabled', title: '演示站点', description: '用于标记演示环境。', type: 'boolean' },
];

const checkinOptionMeta: Array<{
  key: SystemOptionKey;
  title: string;
  description: string;
  type: 'text' | 'textarea' | 'boolean' | 'number';
}> = [
  { key: 'checkin_enabled', title: '启用签到功能', description: '关闭后个人页不再显示签到入口。', type: 'boolean' },
  { key: 'checkin_min_quota', title: '签到最小额度', description: '签到奖励的最小额度。', type: 'number' },
  { key: 'checkin_max_quota', title: '签到最大额度', description: '签到奖励的最大额度。', type: 'number' },
];

const passkeyOptionMeta: Array<{
  key: SystemOptionKey;
  title: string;
  description: string;
  type: 'text' | 'textarea' | 'boolean' | 'select';
  options?: Array<{ label: string; value: string }>;
}> = [
  { key: 'passkey_enabled', title: '启用 Passkey 登录', description: '开启后允许使用 Passkey 注册和登录。', type: 'boolean' },
  { key: 'passkey_rp_display_name', title: 'RP 显示名', description: 'WebAuthn 凭证展示给用户的站点名称。', type: 'text' },
  { key: 'passkey_rp_id', title: 'RP ID', description: '一般填主域名，如 example.com，留空则自动推导。', type: 'text' },
  { key: 'passkey_origins', title: '允许 Origins', description: '支持多个，逗号或换行分隔。留空时自动使用当前访问来源。', type: 'textarea' },
  { key: 'passkey_allow_insecure_origin', title: '允许 HTTP Origin', description: '仅开发环境建议开启。', type: 'boolean' },
  {
    key: 'passkey_user_verification',
    title: '用户验证级别',
    description: 'WebAuthn userVerification 配置。',
    type: 'select',
    options: [
      { label: 'preferred', value: 'preferred' },
      { label: 'required', value: 'required' },
      { label: 'discouraged', value: 'discouraged' },
    ],
  },
  {
    key: 'passkey_attachment_preference',
    title: '设备类型偏好',
    description: '可选 platform 或 cross-platform，留空不限制。',
    type: 'select',
    options: [
      { label: '不限制', value: '' },
      { label: 'platform', value: 'platform' },
      { label: 'cross-platform', value: 'cross-platform' },
    ],
  },
];

const editableOptionMeta = generalOptionMeta;

const toMap = (items: SystemOptionItem[]) =>
  Object.fromEntries(items.map((item) => [item.key, item.value])) as Partial<Record<SystemOptionKey, string>>;

const emptyMailConfig: MailConfig = {
  appBaseUrl: '',
  provider: 'disabled',
  from: '',
  smtpHost: '',
  smtpPort: '',
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  resendApiKey: '',
};

const emptyOAuthConfig: OAuthConfig = {
  oidc: {
    enabled: false,
    wellKnownUrl: '',
    clientId: '',
    clientSecret: '',
    authorizationUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    scope: 'openid profile email',
  },
};

const emptyCustomOAuthProviderForm: CustomOAuthProviderPayload = {
  name: '',
  slug: '',
  icon: '',
  enabled: false,
  clientId: '',
  clientSecret: '',
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  scopes: 'openid profile email',
  userIdField: 'sub',
  usernameField: 'preferred_username',
  displayNameField: 'name',
  emailField: 'email',
  wellKnownUrl: '',
  authStyle: 0,
  accessPolicy: '',
  accessDeniedMessage: '',
};

type SubscriptionPlanForm = Omit<SubscriptionPlanItem, 'features'> & {
  featuresText: string;
};

const emptySubscriptionPlanForm: SubscriptionPlanForm = {
  id: '',
  title: '',
  subtitle: '',
  description: '',
  badge: '',
  priceAmount: 0,
  currency: 'CNY',
  quota: '',
  quotaAmount: 0,
  duration: '30 天',
  durationDays: 30,
  featuresText: '',
  enabled: true,
  sortOrder: 0,
};

const toSubscriptionPlanForm = (plan: SubscriptionPlanItem): SubscriptionPlanForm => ({
  ...plan,
  featuresText: plan.features.join('\n'),
});

const toSubscriptionPlanItem = (form: SubscriptionPlanForm): SubscriptionPlanItem => {
  const { featuresText, ...plan } = form;

  return {
    ...plan,
    features: featuresText
      .split(/\r?\n/)
      .map((feature) => feature.trim())
      .filter(Boolean),
  };
};

export default function SettingPage() {
  const { user } = useContext(UserContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = getSettingSection(searchParams.get('section'));
  const [values, setValues] = useState<Partial<Record<SystemOptionKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);
  const [mailConfig, setMailConfig] = useState<MailConfig>(emptyMailConfig);
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus | null>(null);
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig>(emptyOAuthConfig);
  const [customOAuthProviders, setCustomOAuthProviders] = useState<CustomOAuthProvider[]>([]);
  const [customOAuthProviderForm, setCustomOAuthProviderForm] = useState<CustomOAuthProviderPayload>(emptyCustomOAuthProviderForm);
  const [editingCustomOAuthProviderId, setEditingCustomOAuthProviderId] = useState<string | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanItem[]>([]);
  const [subscriptionPlanForm, setSubscriptionPlanForm] = useState<SubscriptionPlanForm>(emptySubscriptionPlanForm);
  const [editingSubscriptionPlanId, setEditingSubscriptionPlanId] = useState<string | null>(null);
  const [savingMail, setSavingMail] = useState(false);
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [discoveringOIDC, setDiscoveringOIDC] = useState(false);
  const [savingCustomOAuthProvider, setSavingCustomOAuthProvider] = useState(false);
  const [discoveringCustomOAuthProvider, setDiscoveringCustomOAuthProvider] = useState(false);
  const [deletingCustomOAuthProviderId, setDeletingCustomOAuthProviderId] = useState<string | null>(null);
  const [savingSubscriptionPlan, setSavingSubscriptionPlan] = useState(false);
  const [deletingSubscriptionPlanId, setDeletingSubscriptionPlanId] = useState<string | null>(null);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [savingPasskey, setSavingPasskey] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [testMailRecipient, setTestMailRecipient] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { resources, errors } = await loadSettingsResources({
        options: api.listOptions,
        mailStatus: api.getMailStatus,
        mailConfig: api.getMailConfig,
        oauthStatus: api.getOAuthStatus,
        oauthConfig: api.getOAuthConfig,
        customOAuthProviders: api.listCustomOAuthProviders,
        subscriptionPlans: api.listAdminSubscriptionPlans,
      });

      if (resources.options) {
        const optionMap = toMap(resources.options.items ?? []);
        const legacyCheckinQuota = optionMap.checkin_reward_quota;
        setValues({
          ...optionMap,
          checkin_enabled: optionMap.checkin_enabled ?? 'true',
          checkin_min_quota: optionMap.checkin_min_quota ?? legacyCheckinQuota ?? '1000',
          checkin_max_quota: optionMap.checkin_max_quota ?? legacyCheckinQuota ?? '10000',
          passkey_enabled: optionMap.passkey_enabled ?? 'false',
          passkey_rp_display_name: optionMap.passkey_rp_display_name ?? '',
          passkey_rp_id: optionMap.passkey_rp_id ?? '',
          passkey_origins: optionMap.passkey_origins ?? '',
          passkey_allow_insecure_origin: optionMap.passkey_allow_insecure_origin ?? 'false',
          passkey_user_verification: optionMap.passkey_user_verification ?? 'preferred',
          passkey_attachment_preference: optionMap.passkey_attachment_preference ?? '',
        });
      }

      if (resources.mailStatus) setMailStatus(resources.mailStatus.item);
      if (resources.mailConfig) setMailConfig(resources.mailConfig.item);
      if (resources.oauthStatus) setOAuthStatus(resources.oauthStatus.item);
      if (resources.oauthConfig) setOAuthConfig(resources.oauthConfig.item);
      if (resources.customOAuthProviders) setCustomOAuthProviders(resources.customOAuthProviders.items ?? []);
      if (resources.subscriptionPlans) setSubscriptionPlans(resources.subscriptionPlans.items ?? []);
      setTestMailRecipient((current) => current || user?.email || '');

      if (errors.length > 0) {
        Toast.error(`部分设置加载失败：${errors.map((error) => error.message).join('；')}`);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all(editableOptionMeta.map((option) => api.updateOption(option.key, values[option.key] ?? '')));
      Toast.success('系统设置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  const saveCheckin = async () => {
    setSavingCheckin(true);
    try {
      await Promise.all(checkinOptionMeta.map((option) => api.updateOption(option.key, values[option.key] ?? '')));
      Toast.success('签到设置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存签到设置失败');
    } finally {
      setSavingCheckin(false);
    }
  };

  const savePasskey = async () => {
    setSavingPasskey(true);
    try {
      await Promise.all(passkeyOptionMeta.map((option) => api.updateOption(option.key, values[option.key] ?? '')));
      Toast.success('Passkey 设置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存 Passkey 设置失败');
    } finally {
      setSavingPasskey(false);
    }
  };

  const resetSubscriptionPlanForm = () => {
    setEditingSubscriptionPlanId(null);
    setSubscriptionPlanForm(emptySubscriptionPlanForm);
  };

  const editSubscriptionPlan = (plan: SubscriptionPlanItem) => {
    setEditingSubscriptionPlanId(plan.id);
    setSubscriptionPlanForm(toSubscriptionPlanForm(plan));
  };

  const saveSubscriptionPlan = async () => {
    const plan = toSubscriptionPlanItem(subscriptionPlanForm);

    if (!plan.id || !plan.title) {
      Toast.error('套餐 ID 和标题不能为空');
      return;
    }

    setSavingSubscriptionPlan(true);
    try {
      if (editingSubscriptionPlanId) {
        await api.updateSubscriptionPlan(editingSubscriptionPlanId, plan);
        Toast.success('订阅套餐已更新');
      } else {
        await api.createSubscriptionPlan(plan);
        Toast.success('订阅套餐已创建');
      }

      resetSubscriptionPlanForm();
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存订阅套餐失败');
    } finally {
      setSavingSubscriptionPlan(false);
    }
  };

  const deleteSubscriptionPlan = async (planId: string) => {
    setDeletingSubscriptionPlanId(planId);
    try {
      await api.deleteSubscriptionPlan(planId);
      if (editingSubscriptionPlanId === planId) {
        resetSubscriptionPlanForm();
      }
      Toast.success('订阅套餐已删除');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除订阅套餐失败');
    } finally {
      setDeletingSubscriptionPlanId(null);
    }
  };

  const saveMailConfig = async () => {
    setSavingMail(true);
    try {
      const response = await api.updateMailConfig(mailConfig);
      setMailConfig(response.item);
      setMailStatus(response.status);
      Toast.success('邮件配置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存邮件配置失败');
    } finally {
      setSavingMail(false);
    }
  };

  const saveOAuthConfig = async () => {
    setSavingOAuth(true);
    try {
      const response = await api.updateOAuthConfig(oauthConfig);
      setOAuthConfig(response.item);
      setOAuthStatus(response.status);
      Toast.success('OAuth 设置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存 OAuth 设置失败');
    } finally {
      setSavingOAuth(false);
    }
  };

  const discoverOIDCConfig = async () => {
    const wellKnownUrl = oauthConfig.oidc.wellKnownUrl.trim();

    if (!wellKnownUrl) {
      Toast.warning('请先填写 Well-Known URL');
      return;
    }

    setDiscoveringOIDC(true);
    try {
      const response = await api.discoverOIDCConfig({ wellKnownUrl });
      setOAuthConfig((current) => ({
        ...current,
        oidc: {
          ...current.oidc,
          authorizationUrl: response.item.authorizationUrl,
          tokenUrl: response.item.tokenUrl,
          userInfoUrl: response.item.userInfoUrl,
        },
      }));
      Toast.success('OIDC 端点已获取');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '获取 OIDC 配置失败');
    } finally {
      setDiscoveringOIDC(false);
    }
  };

  const resetCustomOAuthProviderForm = () => {
    setEditingCustomOAuthProviderId(null);
    setCustomOAuthProviderForm(emptyCustomOAuthProviderForm);
  };

  const editCustomOAuthProvider = (provider: CustomOAuthProvider) => {
    setEditingCustomOAuthProviderId(provider.id);
    setCustomOAuthProviderForm({
      name: provider.name,
      slug: provider.slug,
      icon: provider.icon,
      enabled: provider.enabled,
      clientId: provider.clientId,
      clientSecret: '',
      authorizationUrl: provider.authorizationUrl,
      tokenUrl: provider.tokenUrl,
      userInfoUrl: provider.userInfoUrl,
      scopes: provider.scopes,
      userIdField: provider.userIdField,
      usernameField: provider.usernameField,
      displayNameField: provider.displayNameField,
      emailField: provider.emailField,
      wellKnownUrl: provider.wellKnownUrl,
      authStyle: provider.authStyle,
      accessPolicy: provider.accessPolicy,
      accessDeniedMessage: provider.accessDeniedMessage,
    });
  };

  const saveCustomOAuthProvider = async () => {
    setSavingCustomOAuthProvider(true);
    try {
      if (editingCustomOAuthProviderId) {
        await api.updateCustomOAuthProvider(editingCustomOAuthProviderId, customOAuthProviderForm);
        Toast.success('自定义 OAuth provider 已更新');
      } else {
        await api.createCustomOAuthProvider(customOAuthProviderForm);
        Toast.success('自定义 OAuth provider 已创建');
      }

      resetCustomOAuthProviderForm();
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存自定义 OAuth provider 失败');
    } finally {
      setSavingCustomOAuthProvider(false);
    }
  };

  const deleteCustomOAuthProvider = async (id: string) => {
    setDeletingCustomOAuthProviderId(id);
    try {
      await api.deleteCustomOAuthProvider(id);
      if (editingCustomOAuthProviderId === id) {
        resetCustomOAuthProviderForm();
      }
      Toast.success('自定义 OAuth provider 已删除');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '删除自定义 OAuth provider 失败');
    } finally {
      setDeletingCustomOAuthProviderId(null);
    }
  };

  const discoverCustomOAuthProvider = async () => {
    const wellKnownUrl = customOAuthProviderForm.wellKnownUrl.trim();

    if (!wellKnownUrl) {
      Toast.warning('请先填写 Well-Known URL');
      return;
    }

    setDiscoveringCustomOAuthProvider(true);
    try {
      const response = await api.discoverCustomOAuthProvider({ wellKnownUrl });
      setCustomOAuthProviderForm((current) => ({
        ...current,
        authorizationUrl: response.item.authorizationUrl,
        tokenUrl: response.item.tokenUrl,
        userInfoUrl: response.item.userInfoUrl,
      }));
      Toast.success('自定义 OAuth 端点已获取');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '获取自定义 OAuth 配置失败');
    } finally {
      setDiscoveringCustomOAuthProvider(false);
    }
  };

  const sendTestMail = async () => {
    setTestingMail(true);
    try {
      const response = await api.sendTestMail(testMailRecipient.trim() ? { email: testMailRecipient.trim() } : undefined);
      Toast.success(`测试邮件已发送到 ${response.email}`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '发送测试邮件失败');
    } finally {
      setTestingMail(false);
    }
  };

  const checkinEnabled = values.checkin_enabled !== 'false';
  const passkeyEnabled = values.passkey_enabled === 'true';
  const selectSection = (section: SettingSection) => {
    setSearchParams(updateSettingSectionSearch(searchParams.toString(), section));
  };

  return (
    <main className="console-page settings-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">Settings</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>系统设置</Typography.Title>
          <Typography.Paragraph className="console-description">
            {getSettingSectionPageDescription(activeSection)}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void load()}>刷新</Button>
          {activeSection === 'general' ? (
            <Button theme="solid" type="primary" icon={<IconSave />} loading={saving} onClick={() => void save()}>保存基础设置</Button>
          ) : null}
        </Space>
      </section>

      <nav aria-label="设置业务域">
        <Card bordered={false} className="dashboard-card settings-section-nav">
          <Space wrap>
            {settingSections.map((section) => (
              <Button
                key={section.key}
                theme={activeSection === section.key ? 'solid' : 'light'}
                type={activeSection === section.key ? 'primary' : 'tertiary'}
                {...getSettingSectionNavigationProps(activeSection, section.key)}
                onClick={() => selectSection(section.key)}
              >
                {section.label}
              </Button>
            ))}
          </Space>
        </Card>
      </nav>

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'general') ? undefined : 'none' }}>
          <div className="settings-grid">
          {generalOptionMeta.map((option) => (
            <label className="setting-field" key={option.key}>
              <span>
                <strong>{option.title}</strong>
                <em>{option.description}</em>
              </span>
              {option.type === 'boolean' ? (
                <Switch
                  checked={values[option.key] === 'true'}
                  onChange={(checked) => setValues((current) => ({ ...current, [option.key]: String(checked) }))}
                />
              ) : option.type === 'textarea' ? (
                <TextArea
                  rows={5}
                  value={values[option.key] ?? ''}
                  placeholder={option.key}
                  onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                />
              ) : (
                <Input
                  value={values[option.key] ?? ''}
                  placeholder={option.key}
                  onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                />
              )}
            </label>
          ))}
        </div>
      </Card>

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'general') ? undefined : 'none' }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <div>
            <Typography.Title heading={5} style={{ marginBottom: 4 }}>签到设置</Typography.Title>
            <Typography.Paragraph type="tertiary">
              控制个人页签到入口和每日签到随机奖励范围。
            </Typography.Paragraph>
          </div>
          <div className="settings-grid" style={{ width: '100%' }}>
            {checkinOptionMeta.map((option) => (
              <label className="setting-field" key={option.key}>
                <span>
                  <strong>{option.title}</strong>
                  <em>{option.description}</em>
                </span>
                {option.type === 'boolean' ? (
                  <Switch
                    checked={values[option.key] === 'true'}
                    onChange={(checked) => setValues((current) => ({ ...current, [option.key]: String(checked) }))}
                  />
                ) : option.type === 'number' ? (
                  <InputNumber
                    min={0}
                    value={values[option.key] === undefined || values[option.key] === '' ? undefined : Number(values[option.key])}
                    disabled={!checkinEnabled && option.key !== 'checkin_enabled'}
                    onChange={(value) => setValues((current) => ({ ...current, [option.key]: value === null || value === undefined ? '' : String(value) }))}
                  />
                ) : option.type === 'textarea' ? (
                  <TextArea
                    rows={5}
                    value={values[option.key] ?? ''}
                    placeholder={option.key}
                    onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                  />
                ) : (
                  <Input
                    value={values[option.key] ?? ''}
                    placeholder={option.key}
                    onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                  />
                )}
              </label>
            ))}
          </div>
          <Button theme="solid" type="primary" icon={<IconSave />} loading={savingCheckin} onClick={() => void saveCheckin()}>
            保存签到设置
          </Button>
        </Space>
      </Card>

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'security') ? undefined : 'none' }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <div>
            <Typography.Title heading={5} style={{ marginBottom: 4 }}>Passkey 设置</Typography.Title>
            <Typography.Paragraph type="tertiary">
              配置 Passkey 登录的站点标识、允许来源和验证策略。
            </Typography.Paragraph>
          </div>
          <div className="settings-grid" style={{ width: '100%' }}>
            {passkeyOptionMeta.map((option) => (
              <label className="setting-field" key={option.key}>
                <span>
                  <strong>{option.title}</strong>
                  <em>{option.description}</em>
                </span>
                {option.type === 'boolean' ? (
                  <Switch
                    checked={values[option.key] === 'true'}
                    onChange={(checked) => setValues((current) => ({ ...current, [option.key]: String(checked) }))}
                  />
                ) : option.type === 'textarea' ? (
                  <TextArea
                    rows={4}
                    value={values[option.key] ?? ''}
                    placeholder={option.key}
                    disabled={!passkeyEnabled && option.key !== 'passkey_enabled'}
                    onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                  />
                ) : option.type === 'select' ? (
                  <Select
                    value={values[option.key] ?? ''}
                    disabled={!passkeyEnabled && option.key !== 'passkey_enabled'}
                    onChange={(value) => setValues((current) => ({ ...current, [option.key]: String(value) }))}
                  >
                    {(option.options ?? []).map((item) => (
                      <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={values[option.key] ?? ''}
                    placeholder={option.key}
                    disabled={!passkeyEnabled && option.key !== 'passkey_enabled'}
                    onChange={(value) => setValues((current) => ({ ...current, [option.key]: value }))}
                  />
                )}
              </label>
            ))}
          </div>
          <Button theme="solid" type="primary" icon={<IconSave />} loading={savingPasskey} onClick={() => void savePasskey()}>
            保存 Passkey 设置
          </Button>
        </Space>
      </Card>

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'billing') ? undefined : 'none' }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <Typography.Title heading={5} style={{ marginBottom: 4 }}>订阅套餐管理</Typography.Title>
              <Typography.Paragraph type="tertiary">
                新建、编辑、停用或删除订阅套餐。停用套餐不会出现在用户购买页，但仍保留在管理列表中。
              </Typography.Paragraph>
            </div>
            <Button icon={<IconPlus />} onClick={resetSubscriptionPlanForm}>新建套餐</Button>
          </Space>

          {subscriptionPlans.length > 0 ? (
            <div className="settings-grid" style={{ width: '100%' }}>
              {subscriptionPlans.map((plan) => (
                <Card key={plan.id} bordered className="setting-field">
                  <Space vertical align="start" style={{ width: '100%' }}>
                    <Space wrap>
                      <Typography.Text strong>{plan.title}</Typography.Text>
                      <Tag color={plan.enabled ? 'green' : 'grey'}>{plan.enabled ? '已启用' : '已停用'}</Tag>
                      {plan.badge ? <Tag color="blue">{plan.badge}</Tag> : null}
                    </Space>
                    <Typography.Text type="tertiary">{plan.id}</Typography.Text>
                    <Typography.Text>
                      {plan.priceAmount} {plan.currency} · {plan.duration || `${plan.durationDays} 天`} · {plan.quota || `${plan.quotaAmount} 额度`}
                    </Typography.Text>
                    <Space wrap>
                      <Button icon={<IconEdit />} onClick={() => editSubscriptionPlan(plan)}>编辑</Button>
                      <Popconfirm
                        title={`确认删除套餐“${plan.title}”？`}
                        content="删除后用户将无法继续购买该套餐。"
                        onConfirm={() => void deleteSubscriptionPlan(plan.id)}
                      >
                        <Button
                          type="danger"
                          icon={<IconDelete />}
                          loading={deletingSubscriptionPlanId === plan.id}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Card>
              ))}
            </div>
          ) : (
            <Typography.Text type="tertiary">当前还没有订阅套餐。</Typography.Text>
          )}

          <Typography.Title heading={6} style={{ margin: '8px 0 0' }}>
            {editingSubscriptionPlanId ? `编辑套餐：${editingSubscriptionPlanId}` : '新建套餐'}
          </Typography.Title>
          <div className="settings-grid" style={{ width: '100%' }}>
            <label className="setting-field">
              <span><strong>套餐 ID</strong><em>创建后保持不变，用于支付和订阅记录关联。</em></span>
              <Input
                value={subscriptionPlanForm.id}
                disabled={Boolean(editingSubscriptionPlanId)}
                placeholder="monthly-basic"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, id: value.trim() }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>套餐标题</strong><em>展示在购买页和用户订阅记录中。</em></span>
              <Input
                value={subscriptionPlanForm.title}
                placeholder="基础版"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, title: value }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>副标题</strong><em>用于补充适用场景。</em></span>
              <Input
                value={subscriptionPlanForm.subtitle}
                placeholder="适合轻量使用"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, subtitle: value }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>徽标</strong><em>例如热门、推荐或限时。</em></span>
              <Input
                value={subscriptionPlanForm.badge}
                placeholder="热门"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, badge: value }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>价格</strong><em>Stripe Checkout 使用的单次支付金额。</em></span>
              <InputNumber
                min={0}
                value={subscriptionPlanForm.priceAmount}
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, priceAmount: Number(value ?? 0) }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>币种</strong><em>使用三位币种代码，例如 CNY 或 USD。</em></span>
              <Input
                value={subscriptionPlanForm.currency}
                placeholder="CNY"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, currency: value.toUpperCase() }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>额度说明</strong><em>面向用户展示的额度文案。</em></span>
              <Input
                value={subscriptionPlanForm.quota}
                placeholder="每月 500,000 额度"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, quota: value }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>入账额度</strong><em>订阅激活时实际增加到用户账户的额度。</em></span>
              <InputNumber
                min={0}
                value={subscriptionPlanForm.quotaAmount}
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, quotaAmount: Number(value ?? 0) }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>周期说明</strong><em>面向用户展示，例如 30 天。</em></span>
              <Input
                value={subscriptionPlanForm.duration}
                placeholder="30 天"
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, duration: value }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>有效天数</strong><em>用于计算订阅到期时间。</em></span>
              <InputNumber
                min={0}
                max={3650}
                value={subscriptionPlanForm.durationDays}
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, durationDays: Number(value ?? 0) }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>排序权重</strong><em>数字越大越靠前。</em></span>
              <InputNumber
                min={-9999}
                max={9999}
                value={subscriptionPlanForm.sortOrder}
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, sortOrder: Number(value ?? 0) }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>启用套餐</strong><em>关闭后从用户购买页隐藏。</em></span>
              <Switch
                checked={subscriptionPlanForm.enabled}
                onChange={(checked) => setSubscriptionPlanForm((current) => ({ ...current, enabled: checked }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>套餐说明</strong><em>详细描述套餐用途和限制。</em></span>
              <TextArea
                rows={4}
                value={subscriptionPlanForm.description}
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, description: value }))}
              />
            </label>
            <label className="setting-field">
              <span><strong>套餐特性</strong><em>每行一项，最多 20 项。</em></span>
              <TextArea
                rows={4}
                value={subscriptionPlanForm.featuresText}
                placeholder={'基础模型访问\n标准优先级'}
                onChange={(value) => setSubscriptionPlanForm((current) => ({ ...current, featuresText: value }))}
              />
            </label>
          </div>
          <Space wrap>
            <Button
              theme="solid"
              type="primary"
              icon={<IconSave />}
              loading={savingSubscriptionPlan}
              onClick={() => void saveSubscriptionPlan()}
            >
              {editingSubscriptionPlanId ? '保存套餐修改' : '创建订阅套餐'}
            </Button>
            {editingSubscriptionPlanId ? <Button onClick={resetSubscriptionPlanForm}>取消编辑</Button> : null}
          </Space>
        </Space>
      </Card>

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'oauth') ? undefined : 'none' }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <div>
            <Typography.Title heading={5} style={{ marginBottom: 4 }}>OIDC 登录设置</Typography.Title>
            <Typography.Paragraph type="tertiary">
              配置 OIDC 登录入口。回调地址固定为当前应用地址下的 /oauth/oidc。
            </Typography.Paragraph>
          </div>
          <div className="settings-grid" style={{ width: '100%' }}>
            <label className="setting-field">
              <span>
                <strong>启用 OIDC 登录</strong>
                <em>开启后，配置校验通过且应用地址存在时登录页会显示 OIDC。</em>
              </span>
              <Switch
                checked={oauthConfig.oidc.enabled}
                onChange={(checked) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, enabled: checked },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Well-Known URL</strong>
                <em>可选。填写后可自动获取授权、token 与 userinfo 端点。</em>
              </span>
              <Input
                value={oauthConfig.oidc.wellKnownUrl}
                placeholder="https://id.example.com/.well-known/openid-configuration"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, wellKnownUrl: value },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Client ID</strong>
                <em>OIDC 应用的客户端 ID。</em>
              </span>
              <Input
                value={oauthConfig.oidc.clientId}
                placeholder="oidc-client-id"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, clientId: value },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Client Secret</strong>
                <em>OIDC 应用的客户端密钥。</em>
              </span>
              <Input
                mode="password"
                value={oauthConfig.oidc.clientSecret}
                placeholder="oidc-client-secret"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, clientSecret: value },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Authorization Endpoint</strong>
                <em>用于发起授权跳转。</em>
              </span>
              <Input
                value={oauthConfig.oidc.authorizationUrl}
                placeholder="https://id.example.com/oauth2/authorize"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, authorizationUrl: value },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Token Endpoint</strong>
                <em>用于授权码换 access token。</em>
              </span>
              <Input
                value={oauthConfig.oidc.tokenUrl}
                placeholder="https://id.example.com/oauth2/token"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, tokenUrl: value },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Userinfo Endpoint</strong>
                <em>必须返回 sub 和 email。</em>
              </span>
              <Input
                value={oauthConfig.oidc.userInfoUrl}
                placeholder="https://id.example.com/oauth2/userinfo"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, userInfoUrl: value },
                }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Scope</strong>
                <em>默认使用 openid profile email。</em>
              </span>
              <Input
                value={oauthConfig.oidc.scope}
                placeholder="openid profile email"
                onChange={(value) => setOAuthConfig((current) => ({
                  ...current,
                  oidc: { ...current.oidc, scope: value },
                }))}
              />
            </label>
          </div>
          <Space wrap>
            <Button loading={discoveringOIDC} onClick={() => void discoverOIDCConfig()}>
              获取 OIDC 端点
            </Button>
            <Button theme="solid" type="primary" icon={<IconSave />} loading={savingOAuth} onClick={() => void saveOAuthConfig()}>
              保存 OAuth 设置
            </Button>
            <Typography.Text>当前来源：{oauthStatus?.source ?? '-'}</Typography.Text>
            <Typography.Text>应用地址：{oauthStatus?.appBaseUrlConfigured ? '已配置' : '未配置'}</Typography.Text>
            <Typography.Text>OIDC 状态：{oauthStatus?.oidc.enabled && oauthStatus?.appBaseUrlConfigured ? '已启用' : '未启用'}</Typography.Text>
            <Typography.Text>配置校验：{oauthStatus?.valid ? '通过' : '未通过'}</Typography.Text>
          </Space>
          {oauthStatus?.errors.length ? (
            <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
              {oauthStatus.errors.join('；')}
            </Typography.Paragraph>
          ) : null}
        </Space>
      </Card>

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'oauth') ? undefined : 'none' }}>
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
              <Switch
                checked={customOAuthProviderForm.enabled}
                onChange={(checked) => setCustomOAuthProviderForm((current) => ({ ...current, enabled: checked }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>名称</strong>
                <em>展示给用户的 provider 名称。</em>
              </span>
              <Input
                value={customOAuthProviderForm.name}
                placeholder="GitLab"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, name: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Slug</strong>
                <em>只允许小写字母、数字和连字符。</em>
              </span>
              <Input
                value={customOAuthProviderForm.slug}
                placeholder="gitlab"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, slug: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>图标名</strong>
                <em>可选，用于后续登录入口展示。</em>
              </span>
              <Input
                value={customOAuthProviderForm.icon}
                placeholder="gitlab"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, icon: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Client ID</strong>
                <em>OAuth 应用的客户端 ID。</em>
              </span>
              <Input
                value={customOAuthProviderForm.clientId}
                placeholder="oauth-client-id"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, clientId: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Client Secret</strong>
                <em>{editingCustomOAuthProviderId ? '留空则保留原密钥。' : '创建 provider 时必填。'}</em>
              </span>
              <Input
                mode="password"
                value={customOAuthProviderForm.clientSecret}
                placeholder="oauth-client-secret"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, clientSecret: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Well-Known URL</strong>
                <em>可选，用于自动获取核心端点。</em>
              </span>
              <Input
                value={customOAuthProviderForm.wellKnownUrl}
                placeholder="https://id.example.com/.well-known/openid-configuration"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, wellKnownUrl: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Authorization Endpoint</strong>
                <em>发起 OAuth 授权跳转。</em>
              </span>
              <Input
                value={customOAuthProviderForm.authorizationUrl}
                placeholder="https://id.example.com/oauth2/authorize"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, authorizationUrl: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Token Endpoint</strong>
                <em>授权码换 access token。</em>
              </span>
              <Input
                value={customOAuthProviderForm.tokenUrl}
                placeholder="https://id.example.com/oauth2/token"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, tokenUrl: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Userinfo Endpoint</strong>
                <em>读取第三方用户资料。</em>
              </span>
              <Input
                value={customOAuthProviderForm.userInfoUrl}
                placeholder="https://id.example.com/oauth2/userinfo"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, userInfoUrl: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Scopes</strong>
                <em>默认 openid profile email。</em>
              </span>
              <Input
                value={customOAuthProviderForm.scopes}
                placeholder="openid profile email"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, scopes: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Token Auth Style</strong>
                <em>auto、参数传递或 Basic Auth。</em>
              </span>
              <Select
                value={customOAuthProviderForm.authStyle}
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, authStyle: Number(value) as CustomOAuthProviderPayload['authStyle'] }))}
              >
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
              <Input
                value={customOAuthProviderForm.userIdField}
                placeholder="sub"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, userIdField: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Username Field</strong>
                <em>用户名字段路径。</em>
              </span>
              <Input
                value={customOAuthProviderForm.usernameField}
                placeholder="preferred_username"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, usernameField: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Display Name Field</strong>
                <em>显示名字段路径。</em>
              </span>
              <Input
                value={customOAuthProviderForm.displayNameField}
                placeholder="name"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, displayNameField: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>Email Field</strong>
                <em>邮箱字段路径。</em>
              </span>
              <Input
                value={customOAuthProviderForm.emailField}
                placeholder="email"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, emailField: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>访问策略</strong>
                <em>登录或绑定前会按该策略校验 userinfo。</em>
              </span>
              <TextArea
                rows={4}
                value={customOAuthProviderForm.accessPolicy}
                placeholder='{"field":"groups","operator":"contains","value":"admin"}'
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, accessPolicy: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>拒绝提示</strong>
                <em>访问策略拒绝时展示。</em>
              </span>
              <TextArea
                rows={4}
                value={customOAuthProviderForm.accessDeniedMessage}
                placeholder="当前账号不满足登录条件。"
                onChange={(value) => setCustomOAuthProviderForm((current) => ({ ...current, accessDeniedMessage: value }))}
              />
            </label>
          </div>

          <Space wrap>
            <Button loading={discoveringCustomOAuthProvider} onClick={() => void discoverCustomOAuthProvider()}>
              获取自定义 OAuth 端点
            </Button>
            <Button theme="solid" type="primary" icon={<IconSave />} loading={savingCustomOAuthProvider} onClick={() => void saveCustomOAuthProvider()}>
              {editingCustomOAuthProviderId ? '更新 provider' : '创建 provider'}
            </Button>
            {editingCustomOAuthProviderId ? (
              <Button onClick={resetCustomOAuthProviderForm}>取消编辑</Button>
            ) : null}
          </Space>

          <div className="oauth-binding-stack" style={{ width: '100%' }}>
            {customOAuthProviders.length > 0 ? customOAuthProviders.map((provider) => (
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
                    <Button onClick={() => editCustomOAuthProvider(provider)}>编辑</Button>
                    <Button
                      type="danger"
                      loading={deletingCustomOAuthProviderId === provider.id}
                      onClick={() => void deleteCustomOAuthProvider(provider.id)}
                    >
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

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'security') ? undefined : 'none' }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <div>
            <Typography.Title heading={5} style={{ marginBottom: 4 }}>邮件配置</Typography.Title>
            <Typography.Paragraph type="tertiary">
              在这里配置邮件发送方式。保存后，注册验证、密码重置、邮箱验证和测试邮件都会立即使用这套配置。
            </Typography.Paragraph>
          </div>
          <div className="settings-grid" style={{ width: '100%' }}>
            <label className="setting-field">
              <span>
                <strong>发送方式</strong>
                <em>关闭后不会发送任何邮件。</em>
              </span>
              <Select value={mailConfig.provider} onChange={(value) => setMailConfig((current) => ({ ...current, provider: String(value) as MailConfig['provider'] }))}>
                <Select.Option value="disabled">disabled</Select.Option>
                <Select.Option value="smtp">smtp</Select.Option>
                <Select.Option value="resend">resend</Select.Option>
              </Select>
            </label>
            <label className="setting-field">
              <span>
                <strong>应用地址</strong>
                <em>生成验证链接和重置链接时使用。</em>
              </span>
              <Input
                value={mailConfig.appBaseUrl}
                placeholder="https://console.example.com"
                onChange={(value) => setMailConfig((current) => ({ ...current, appBaseUrl: value }))}
              />
            </label>
            <label className="setting-field">
              <span>
                <strong>发件地址</strong>
                <em>用于发件人 From。</em>
              </span>
              <Input
                value={mailConfig.from}
                placeholder="noreply@example.com"
                onChange={(value) => setMailConfig((current) => ({ ...current, from: value }))}
              />
            </label>
            {mailConfig.provider === 'smtp' ? (
              <>
                <label className="setting-field">
                  <span>
                    <strong>SMTP Host</strong>
                    <em>SMTP 服务器地址。</em>
                  </span>
                  <Input
                    value={mailConfig.smtpHost}
                    placeholder="smtp.example.com"
                    onChange={(value) => setMailConfig((current) => ({ ...current, smtpHost: value }))}
                  />
                </label>
                <label className="setting-field">
                  <span>
                    <strong>SMTP Port</strong>
                    <em>例如 465 或 587。</em>
                  </span>
                  <Input
                    value={mailConfig.smtpPort}
                    placeholder="465"
                    onChange={(value) => setMailConfig((current) => ({ ...current, smtpPort: value }))}
                  />
                </label>
                <label className="setting-field">
                  <span>
                    <strong>SMTP User</strong>
                    <em>SMTP 登录用户名。</em>
                  </span>
                  <Input
                    value={mailConfig.smtpUser}
                    placeholder="mailer"
                    onChange={(value) => setMailConfig((current) => ({ ...current, smtpUser: value }))}
                  />
                </label>
                <label className="setting-field">
                  <span>
                    <strong>SMTP Password</strong>
                    <em>SMTP 登录密码或授权码。</em>
                  </span>
                  <Input
                    mode="password"
                    value={mailConfig.smtpPass}
                    placeholder="secret"
                    onChange={(value) => setMailConfig((current) => ({ ...current, smtpPass: value }))}
                  />
                </label>
                <label className="setting-field">
                  <span>
                    <strong>SMTP Secure</strong>
                    <em>通常 465 为开启，587 视服务商而定。</em>
                  </span>
                  <Switch
                    checked={mailConfig.smtpSecure}
                    onChange={(checked) => setMailConfig((current) => ({ ...current, smtpSecure: checked }))}
                  />
                </label>
              </>
            ) : null}
            {mailConfig.provider === 'resend' ? (
              <label className="setting-field">
                <span>
                  <strong>Resend API Key</strong>
                  <em>用于调用 Resend 发信。</em>
                </span>
                <Input
                  mode="password"
                  value={mailConfig.resendApiKey}
                  placeholder="re_xxx"
                  onChange={(value) => setMailConfig((current) => ({ ...current, resendApiKey: value }))}
                />
              </label>
            ) : null}
          </div>
          <Space wrap>
            <Button theme="solid" type="primary" icon={<IconSave />} loading={savingMail} onClick={() => void saveMailConfig()}>
              保存邮件配置
            </Button>
            <Typography.Text>当前来源：{mailStatus?.source ?? '-'}</Typography.Text>
            <Typography.Text>当前状态：{mailStatus?.enabled ? '已启用' : '未启用'}</Typography.Text>
            <Typography.Text>配置校验：{mailStatus?.valid ? '通过' : '未通过'}</Typography.Text>
          </Space>
          {mailStatus?.errors.length ? (
            <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
              {mailStatus.errors.join('；')}
            </Typography.Paragraph>
          ) : null}
          <Input
            value={testMailRecipient}
            placeholder={user?.email ?? '输入测试收件邮箱'}
            onChange={setTestMailRecipient}
          />
          <Button theme="solid" loading={testingMail} disabled={!mailStatus?.enabled || !mailStatus?.valid} onClick={() => void sendTestMail()}>
            发送测试邮件
          </Button>
        </Space>
      </Card>
    </main>
  );
}

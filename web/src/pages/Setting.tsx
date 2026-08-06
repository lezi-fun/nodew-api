import { Button, Card, Input, InputNumber, Popconfirm, Select, Space, Switch, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconDelete, IconEdit, IconPlus, IconSave } from '@douyinfe/semi-icons';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { UserContext } from '../context/User';
import CustomOAuthProviderCard from '../features/settings/components/CustomOAuthProviderCard';
import MailSettingsCard from '../features/settings/components/MailSettingsCard';
import OidcSettingsCard from '../features/settings/components/OidcSettingsCard';
import SettingsOptionCard from '../features/settings/components/SettingsOptionCard';
import SettingsPageHeader from '../features/settings/components/SettingsPageHeader';
import SettingsOptionGrid from '../features/settings/components/SettingsOptionGrid';
import { checkinOptionMeta, generalOptionMeta, passkeyOptionMeta } from '../features/settings/option-metadata';
import {
  getSettingSection,
  isSettingSectionActive,
  type SettingSection,
  updateSettingSectionSearch,
} from '../features/settings/sections';
import {
  api,
  type CreemTopUpConfig,
  type CustomOAuthProvider,
  type CustomOAuthProviderPayload,
  type MailConfig,
  type MailStatus,
  type OAuthConfig,
  type OAuthStatus,
  type PaymentConfig,
  type StripeTopUpConfig,
  type SubscriptionPlanItem,
  type SystemOptionItem,
  type SystemOptionKey,
  type WaffoTopUpConfig,
} from '../lib/api';
import { loadSettingsResources } from '../lib/settings-loader';

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

const fallbackStripeConfig: StripeTopUpConfig = {
  enabled: false,
  configured: false,
  currency: 'usd',
  quotaPerUnit: 100000,
  unitAmountCents: 100,
  minUnits: 1,
};

const fallbackCreemConfig: CreemTopUpConfig = {
  enabled: false,
  configured: false,
  webhookConfigured: false,
  testMode: false,
  products: [],
};

const fallbackWaffoConfig: WaffoTopUpConfig = {
  enabled: false,
  configured: false,
  webhookConfigured: false,
  testMode: false,
  products: [],
};

const emptyPaymentConfig: PaymentConfig = {
  appBaseUrl: '',
  stripe: {
    enabled: false,
    secretKey: '',
    webhookSecret: '',
    hasSecretKey: false,
    hasWebhookSecret: false,
    currency: 'usd',
    quotaPerUnit: 100000,
    unitAmountCents: 100,
    minUnits: 1,
  },
  creem: {
    enabled: false,
    testMode: false,
    apiKey: '',
    webhookSecret: '',
    hasApiKey: false,
    hasWebhookSecret: false,
    products: [],
  },
  waffo: {
    enabled: false,
    testMode: false,
    apiKey: '',
    privateKey: '',
    publicKey: '',
    hasApiKey: false,
    hasPrivateKey: false,
    hasPublicKey: false,
    products: [],
  },
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

const formatPaymentAmount = (amountCents: number, currency: string) =>
  `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;

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
  const [stripeConfig, setStripeConfig] = useState<StripeTopUpConfig>(fallbackStripeConfig);
  const [creemConfig, setCreemConfig] = useState<CreemTopUpConfig>(fallbackCreemConfig);
  const [waffoConfig, setWaffoConfig] = useState<WaffoTopUpConfig>(fallbackWaffoConfig);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(emptyPaymentConfig);
  const [creemProductsText, setCreemProductsText] = useState('[]');
  const [waffoProductsText, setWaffoProductsText] = useState('[]');
  const [savingMail, setSavingMail] = useState(false);
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [discoveringOIDC, setDiscoveringOIDC] = useState(false);
  const [savingCustomOAuthProvider, setSavingCustomOAuthProvider] = useState(false);
  const [discoveringCustomOAuthProvider, setDiscoveringCustomOAuthProvider] = useState(false);
  const [deletingCustomOAuthProviderId, setDeletingCustomOAuthProviderId] = useState<string | null>(null);
  const [savingSubscriptionPlan, setSavingSubscriptionPlan] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
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
        paymentConfig: api.getPaymentConfig,
        stripeTopUpConfig: api.getStripeTopUpConfig,
        creemTopUpConfig: api.getCreemTopUpConfig,
        waffoTopUpConfig: api.getWaffoTopUpConfig,
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
      if (resources.paymentConfig) {
        setPaymentConfig(resources.paymentConfig.item);
        setCreemProductsText(JSON.stringify(resources.paymentConfig.item.creem.products, null, 2));
        setWaffoProductsText(JSON.stringify(resources.paymentConfig.item.waffo.products, null, 2));
      }
      if (resources.stripeTopUpConfig) setStripeConfig(resources.stripeTopUpConfig.item);
      if (resources.creemTopUpConfig) setCreemConfig(resources.creemTopUpConfig.item);
      if (resources.waffoTopUpConfig) setWaffoConfig(resources.waffoTopUpConfig.item);
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

  const savePaymentConfig = async () => {
    setSavingPayment(true);
    try {
      const creemProducts = JSON.parse(creemProductsText) as PaymentConfig['creem']['products'];
      const waffoProducts = JSON.parse(waffoProductsText) as PaymentConfig['waffo']['products'];

      if (!Array.isArray(creemProducts) || !Array.isArray(waffoProducts)) {
        throw new Error('产品目录必须是 JSON 数组');
      }

      const response = await api.updatePaymentConfig({
        ...paymentConfig,
        creem: { ...paymentConfig.creem, products: creemProducts },
        waffo: { ...paymentConfig.waffo, products: waffoProducts },
      });
      setPaymentConfig(response.item);
      Toast.success('支付设置已保存');
      await load();
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '保存支付设置失败');
    } finally {
      setSavingPayment(false);
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
      <SettingsPageHeader
        activeSection={activeSection}
        loading={loading}
        saving={saving}
        onRefresh={() => void load()}
        onSaveGeneral={() => void save()}
        onSectionChange={selectSection}
      />

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'general') ? undefined : 'none' }}>
        <SettingsOptionGrid
          options={generalOptionMeta}
          values={values}
          onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        />
      </Card>

      <SettingsOptionCard
        visible={isSettingSectionActive(activeSection, 'general')}
        title="签到设置"
        description="控制个人页签到入口和每日签到随机奖励范围。"
        options={checkinOptionMeta}
        values={values}
        saving={savingCheckin}
        saveLabel="保存签到设置"
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSave={() => void saveCheckin()}
        isNonBooleanDisabled={(option) => !checkinEnabled && option.key !== 'checkin_enabled'}
      />

      <SettingsOptionCard
        visible={isSettingSectionActive(activeSection, 'security')}
        title="Passkey 设置"
        description="配置 Passkey 登录的站点标识、允许来源和验证策略。"
        options={passkeyOptionMeta}
        values={values}
        saving={savingPasskey}
        saveLabel="保存 Passkey 设置"
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        onSave={() => void savePasskey()}
        isNonBooleanDisabled={(option) => !passkeyEnabled && option.key !== 'passkey_enabled'}
      />

      <Card bordered={false} className="dashboard-card settings-card" style={{ marginTop: 16, display: isSettingSectionActive(activeSection, 'billing') ? undefined : 'none' }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Card bordered style={{ width: '100%' }}>
            <Space vertical align="start" style={{ width: '100%' }}>
              <Typography.Title heading={5} style={{ marginBottom: 4 }}>支付基础与 Stripe</Typography.Title>
              <label className="setting-field">
                <span><strong>应用回调地址</strong><em>支付成功、取消和 webhook 回调使用的公开站点地址。</em></span>
                <Input
                  value={paymentConfig.appBaseUrl}
                  placeholder="https://example.com"
                  onChange={(value) => setPaymentConfig((current) => ({ ...current, appBaseUrl: value }))}
                />
              </label>
              <div className="settings-grid" style={{ width: '100%' }}>
                <label className="setting-field">
                  <span><strong>启用 Stripe</strong><em>密钥和回调地址完整时才会对用户开放。</em></span>
                  <Switch checked={paymentConfig.stripe.enabled} onChange={(enabled) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, enabled } }))} />
                </label>
                <label className="setting-field">
                  <span><strong>Stripe Secret Key</strong><em>{paymentConfig.stripe.hasSecretKey ? '已配置，留空保持不变。' : '尚未配置。'}</em></span>
                  <Input value={paymentConfig.stripe.secretKey} placeholder="留空保持原密钥" onChange={(secretKey) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, secretKey } }))} />
                </label>
                <label className="setting-field">
                  <span><strong>Stripe Webhook Secret</strong><em>{paymentConfig.stripe.hasWebhookSecret ? '已配置，留空保持不变。' : '尚未配置。'}</em></span>
                  <Input value={paymentConfig.stripe.webhookSecret} placeholder="留空保持原密钥" onChange={(webhookSecret) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, webhookSecret } }))} />
                </label>
                <label className="setting-field">
                  <span><strong>币种</strong><em>三位币种代码。</em></span>
                  <Input value={paymentConfig.stripe.currency} onChange={(currency) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, currency } }))} />
                </label>
                <label className="setting-field">
                  <span><strong>每份额度</strong><em>每购买一份增加的额度。</em></span>
                  <InputNumber min={1} value={paymentConfig.stripe.quotaPerUnit} onChange={(value) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, quotaPerUnit: Number(value ?? 1) } }))} />
                </label>
                <label className="setting-field">
                  <span><strong>每份价格（分）</strong><em>Stripe Checkout 的最小计价单位。</em></span>
                  <InputNumber min={1} value={paymentConfig.stripe.unitAmountCents} onChange={(value) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, unitAmountCents: Number(value ?? 1) } }))} />
                </label>
                <label className="setting-field">
                  <span><strong>最少份数</strong><em>单次充值允许购买的最小份数。</em></span>
                  <InputNumber min={1} value={paymentConfig.stripe.minUnits} onChange={(value) => setPaymentConfig((current) => ({ ...current, stripe: { ...current.stripe, minUnits: Number(value ?? 1) } }))} />
                </label>
              </div>
            </Space>
          </Card>

          <div>
            <Typography.Title heading={5} style={{ marginBottom: 4 }}>支付通道状态</Typography.Title>
            <Typography.Paragraph type="tertiary">
              聚合 Stripe、Creem 和 Waffo 的启用与配置状态，便于先确认环境变量和 webhook 是否生效。
            </Typography.Paragraph>
          </div>

          <div className="settings-grid" style={{ width: '100%' }}>
            <Card bordered>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Space wrap>
                  <Typography.Text strong>Stripe</Typography.Text>
                  <Tag color={stripeConfig.enabled ? 'green' : 'grey'}>{stripeConfig.enabled ? '已启用' : '未启用'}</Tag>
                  <Tag color={stripeConfig.configured ? 'blue' : 'orange'}>{stripeConfig.configured ? '配置完整' : '待配置'}</Tag>
                </Space>
                <Typography.Text type="tertiary">国际卡与 Stripe Checkout 单次充值。</Typography.Text>
                <Typography.Text>单价：{formatPaymentAmount(stripeConfig.unitAmountCents, stripeConfig.currency)}</Typography.Text>
                <Typography.Text>最少购买份数：{stripeConfig.minUnits}</Typography.Text>
                <Typography.Text>每份入账额度：{stripeConfig.quotaPerUnit.toLocaleString('zh-CN')}</Typography.Text>
              </Space>
            </Card>

            <Card bordered>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Space wrap>
                  <Typography.Text strong>Creem</Typography.Text>
                  <Tag color={creemConfig.enabled ? 'green' : 'grey'}>{creemConfig.enabled ? '已启用' : '未启用'}</Tag>
                  <Tag color={creemConfig.configured ? 'blue' : 'orange'}>{creemConfig.configured ? '配置完整' : '待配置'}</Tag>
                  <Tag color={creemConfig.webhookConfigured ? 'cyan' : 'red'}>{creemConfig.webhookConfigured ? 'Webhook 就绪' : 'Webhook 缺失'}</Tag>
                  {creemConfig.testMode ? <Tag color="purple">测试模式</Tag> : null}
                </Space>
                <Typography.Text type="tertiary">托管支付产品目录，适合预设档位充值。</Typography.Text>
                <Typography.Text>可售产品数：{creemConfig.products.length}</Typography.Text>
                {creemConfig.products.length > 0 ? (
                  <Space vertical align="start" spacing="tight" style={{ width: '100%' }}>
                    {creemConfig.products.slice(0, 3).map((product) => (
                      <Typography.Text key={product.productId}>
                        {product.name} · {formatPaymentAmount(product.amountCents, product.currency)} · {product.quotaAmount.toLocaleString('zh-CN')} 额度
                      </Typography.Text>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="tertiary">当前还没有可售产品。</Typography.Text>
                )}
              </Space>
            </Card>

            <Card bordered>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Space wrap>
                  <Typography.Text strong>Waffo</Typography.Text>
                  <Tag color={waffoConfig.enabled ? 'green' : 'grey'}>{waffoConfig.enabled ? '已启用' : '未启用'}</Tag>
                  <Tag color={waffoConfig.configured ? 'blue' : 'orange'}>{waffoConfig.configured ? '配置完整' : '待配置'}</Tag>
                  <Tag color={waffoConfig.webhookConfigured ? 'cyan' : 'red'}>{waffoConfig.webhookConfigured ? 'Webhook 就绪' : 'Webhook 缺失'}</Tag>
                  {waffoConfig.testMode ? <Tag color="purple">测试模式</Tag> : null}
                </Space>
                <Typography.Text type="tertiary">本地化支付方式目录，按后台产品配置跳转支付。</Typography.Text>
                <Typography.Text>可售产品数：{waffoConfig.products.length}</Typography.Text>
                {waffoConfig.products.length > 0 ? (
                  <Space vertical align="start" spacing="tight" style={{ width: '100%' }}>
                    {waffoConfig.products.slice(0, 3).map((product) => (
                      <Typography.Text key={product.productId}>
                        {product.name} · {formatPaymentAmount(product.amountCents, product.currency)} · {product.quotaAmount.toLocaleString('zh-CN')} 额度
                      </Typography.Text>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="tertiary">当前还没有可售产品。</Typography.Text>
                )}
              </Space>
            </Card>
          </div>

          <div className="settings-grid" style={{ width: '100%' }}>
            <Card bordered>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Typography.Title heading={5} style={{ marginBottom: 4 }}>Creem 设置</Typography.Title>
                <Space wrap>
                  <Switch checked={paymentConfig.creem.enabled} onChange={(enabled) => setPaymentConfig((current) => ({ ...current, creem: { ...current.creem, enabled } }))} />
                  <span>启用 Creem</span>
                  <Switch checked={paymentConfig.creem.testMode} onChange={(testMode) => setPaymentConfig((current) => ({ ...current, creem: { ...current.creem, testMode } }))} />
                  <span>测试模式</span>
                </Space>
                <Input value={paymentConfig.creem.apiKey} placeholder={paymentConfig.creem.hasApiKey ? 'API Key 已配置，留空保持不变' : 'Creem API Key'} onChange={(apiKey) => setPaymentConfig((current) => ({ ...current, creem: { ...current.creem, apiKey } }))} />
                <Input value={paymentConfig.creem.webhookSecret} placeholder={paymentConfig.creem.hasWebhookSecret ? 'Webhook Secret 已配置，留空保持不变' : 'Creem Webhook Secret'} onChange={(webhookSecret) => setPaymentConfig((current) => ({ ...current, creem: { ...current.creem, webhookSecret } }))} />
                <TextArea rows={10} value={creemProductsText} onChange={setCreemProductsText} placeholder="Creem 产品 JSON 数组" />
              </Space>
            </Card>

            <Card bordered>
              <Space vertical align="start" style={{ width: '100%' }}>
                <Typography.Title heading={5} style={{ marginBottom: 4 }}>Waffo 设置</Typography.Title>
                <Space wrap>
                  <Switch checked={paymentConfig.waffo.enabled} onChange={(enabled) => setPaymentConfig((current) => ({ ...current, waffo: { ...current.waffo, enabled } }))} />
                  <span>启用 Waffo</span>
                  <Switch checked={paymentConfig.waffo.testMode} onChange={(testMode) => setPaymentConfig((current) => ({ ...current, waffo: { ...current.waffo, testMode } }))} />
                  <span>测试模式</span>
                </Space>
                <Input value={paymentConfig.waffo.apiKey} placeholder={paymentConfig.waffo.hasApiKey ? 'API Key 已配置，留空保持不变' : 'Waffo API Key'} onChange={(apiKey) => setPaymentConfig((current) => ({ ...current, waffo: { ...current.waffo, apiKey } }))} />
                <TextArea rows={4} value={paymentConfig.waffo.privateKey} placeholder={paymentConfig.waffo.hasPrivateKey ? '私钥已配置，留空保持不变' : 'Waffo Private Key'} onChange={(privateKey) => setPaymentConfig((current) => ({ ...current, waffo: { ...current.waffo, privateKey } }))} />
                <TextArea rows={4} value={paymentConfig.waffo.publicKey} placeholder={paymentConfig.waffo.hasPublicKey ? '公钥已配置，留空保持不变' : 'Waffo Public Key'} onChange={(publicKey) => setPaymentConfig((current) => ({ ...current, waffo: { ...current.waffo, publicKey } }))} />
                <TextArea rows={10} value={waffoProductsText} onChange={setWaffoProductsText} placeholder="Waffo 产品 JSON 数组" />
              </Space>
            </Card>
          </div>

          <Button theme="solid" type="primary" icon={<IconSave />} loading={savingPayment} onClick={() => void savePaymentConfig()}>
            保存支付设置
          </Button>

          <Card bordered style={{ width: '100%' }}>
            <Space vertical align="start" style={{ width: '100%' }}>
              <Typography.Title heading={5} style={{ marginBottom: 4 }}>模型与分组倍率</Typography.Title>
              <Typography.Paragraph type="tertiary">配置实际扣费倍率，格式为 JSON 对象。model_ratios 按模型名设置倍率，group_ratios 按用户组名设置倍率，最终扣费 = 原始额度 × group_ratio × model_ratio。</Typography.Paragraph>
              <label className="setting-field">
                <span><strong>模型倍率 (model_ratios)</strong><em>JSON 格式，键为模型名，值为倍率。</em></span>
                <TextArea
                  rows={6}
                  value={values.model_ratios ?? ''}
                  placeholder='{"gpt-4": 1.5}'
                  onChange={(value) => setValues((current) => ({ ...current, model_ratios: value }))}
                />
              </label>
              <label className="setting-field">
                <span><strong>分组倍率 (group_ratios)</strong><em>JSON 格式，键为用户组名，值为倍率。</em></span>
                <TextArea
                  rows={6}
                  value={values.group_ratios ?? ''}
                  placeholder='{"default": 1}'
                  onChange={(value) => setValues((current) => ({ ...current, group_ratios: value }))}
                />
              </label>
              <Button theme="solid" type="primary" icon={<IconSave />} onClick={() => void save()}>
                保存设置
              </Button>
            </Space>
          </Card>

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

      <OidcSettingsCard
        visible={isSettingSectionActive(activeSection, 'oauth')}
        config={oauthConfig.oidc}
        status={oauthStatus}
        discovering={discoveringOIDC}
        saving={savingOAuth}
        onConfigChange={(patch) => setOAuthConfig((current) => ({ ...current, oidc: { ...current.oidc, ...patch } }))}
        onDiscover={() => void discoverOIDCConfig()}
        onSave={() => void saveOAuthConfig()}
      />

      <CustomOAuthProviderCard
        visible={isSettingSectionActive(activeSection, 'oauth')}
        providers={customOAuthProviders}
        form={customOAuthProviderForm}
        editingProviderId={editingCustomOAuthProviderId}
        saving={savingCustomOAuthProvider}
        discovering={discoveringCustomOAuthProvider}
        deletingProviderId={deletingCustomOAuthProviderId}
        onFormChange={(patch) => setCustomOAuthProviderForm((current) => ({ ...current, ...patch }))}
        onDiscover={() => void discoverCustomOAuthProvider()}
        onSave={() => void saveCustomOAuthProvider()}
        onCancelEdit={resetCustomOAuthProviderForm}
        onEdit={editCustomOAuthProvider}
        onDelete={(id) => void deleteCustomOAuthProvider(id)}
      />

      <MailSettingsCard
        visible={isSettingSectionActive(activeSection, 'security')}
        config={mailConfig}
        status={mailStatus}
        saving={savingMail}
        testing={testingMail}
        testRecipient={testMailRecipient}
        userEmail={user?.email}
        onConfigChange={(patch) => setMailConfig((current) => ({ ...current, ...patch }))}
        onTestRecipientChange={setTestMailRecipient}
        onSave={() => void saveMailConfig()}
        onSendTest={() => void sendTestMail()}
      />
    </main>
  );
}

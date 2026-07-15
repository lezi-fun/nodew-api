export const settingSections = [
  {
    key: 'general',
    label: '基础与运营',
    description: '站点信息、注册开关、默认模型和签到奖励。',
  },
  {
    key: 'security',
    label: '认证与邮件',
    description: 'Passkey 登录策略、邮件发送和测试邮件。',
  },
  {
    key: 'oauth',
    label: 'OAuth 登录',
    description: 'OIDC 登录和自定义 OAuth provider。',
  },
  {
    key: 'billing',
    label: '订阅与计费',
    description: '订阅套餐的展示、价格、额度和有效期。',
  },
] as const;

export type SettingSection = (typeof settingSections)[number]['key'];

export const defaultSettingSection: SettingSection = 'general';

const settingSectionKeys = new Set<string>(settingSections.map((section) => section.key));

export const getSettingSection = (value: string | null | undefined): SettingSection =>
  value && settingSectionKeys.has(value) ? value as SettingSection : defaultSettingSection;

export const getSettingSectionMeta = (section: SettingSection) =>
  settingSections.find((item) => item.key === section) ?? settingSections[0];

export const getSettingSectionPageDescription = (section: SettingSection) =>
  getSettingSectionMeta(section).description;

export const getSettingSectionNavigationProps = (
  activeSection: SettingSection,
  section: SettingSection,
) => ({
  'aria-current': activeSection === section ? 'page' as const : undefined,
  'aria-pressed': activeSection === section,
});

export const isSettingSectionActive = (
  activeSection: SettingSection,
  section: SettingSection,
) => activeSection === section;

export const updateSettingSectionSearch = (search: string, section: SettingSection) => {
  const params = new URLSearchParams(search);
  params.set('section', section);
  return params.toString();
};

import type { SystemOptionKey } from '../../lib/api';

export type SettingsOptionMeta = {
  key: SystemOptionKey;
  title: string;
  description: string;
  type: 'text' | 'textarea' | 'boolean' | 'number' | 'select';
  rows?: number;
  min?: number;
  options?: ReadonlyArray<{ label: string; value: string }>;
};

export const generalOptionMeta = [
  { key: 'site_name', title: '站点名称', description: '显示在浏览器标题、顶栏和公开页面。', type: 'text' },
  { key: 'site_description', title: '站点描述', description: '公开首页与控制台说明文案。', type: 'text' },
  { key: 'default_model', title: '默认模型', description: '操练场和示例请求的默认模型。', type: 'text' },
  { key: 'notice', title: '站点公告', description: '公开首页、关于页和控制台提示使用。', type: 'textarea', rows: 5 },
  { key: 'home_page_content', title: '首页补充内容', description: '展示在公开首页的补充 Markdown/纯文本内容。', type: 'textarea', rows: 5 },
  { key: 'about', title: '关于内容', description: '关于页面展示的项目或站点介绍。', type: 'textarea', rows: 5 },
  { key: 'user_agreement', title: '用户协议', description: '预留给注册和合规页面使用。', type: 'textarea', rows: 5 },
  { key: 'privacy_policy', title: '隐私政策', description: '预留给注册和合规页面使用。', type: 'textarea', rows: 5 },
  { key: 'registration_enabled', title: '允许注册', description: '关闭后仅管理员可创建用户。', type: 'boolean' },
  { key: 'registration_email_verification_required', title: '注册前验证邮箱', description: '开启后，用户必须先点击验证邮件或输入验证码，才能完成注册。', type: 'boolean' },
  { key: 'self_use_mode_enabled', title: '自用模式', description: '隐藏注册和部分公开入口。', type: 'boolean' },
  { key: 'demo_site_enabled', title: '演示站点', description: '用于标记演示环境。', type: 'boolean' },
  { key: 'operation_new_user_quota', title: '新用户初始额度', description: '注册时默认分配给新用户的额度，0 表示不赠送。', type: 'text' },
  { key: 'operation_max_user_api_keys', title: '用户最大令牌数', description: '每个用户最多可创建的令牌数。', type: 'text' },
  { key: 'operation_relay_retry_times', title: 'Relay 重试次数', description: '上游失败后最多重试次数。', type: 'text' },
  { key: 'operation_usage_log_enabled', title: '启用额度消费日志', description: '关闭后不再记录用量日志。', type: 'boolean' },
  { key: 'monitor_auto_disable_channel', title: '失败自动禁用渠道', description: '开启后连续失败达到阈值时自动禁用渠道。', type: 'boolean' },
  { key: 'monitor_channel_disable_threshold', title: '渠道禁用失败阈值', description: '连续失败多少次后自动禁用。', type: 'text' },
  { key: 'monitor_auto_disable_status_codes', title: '计入失败的状态码', description: '逗号分隔或范围，如 401,403,500-599。', type: 'text' },
  { key: 'monitor_auto_disable_keywords', title: '禁用关键词', description: '错误消息包含这些关键词时禁用渠道，每行一个。', type: 'textarea', rows: 5 },
  { key: 'monitor_auto_retry_status_codes', title: '可重试的状态码', description: '上游返回这些码时自动重试，逗号分隔或范围。', type: 'text' },
  { key: 'monitor_auto_enable_channel', title: '成功后自动启用', description: '开启后渠道成功后自动恢复启用状态。', type: 'boolean' },
] as const satisfies ReadonlyArray<SettingsOptionMeta>;

export const checkinOptionMeta = [
  { key: 'checkin_enabled', title: '启用签到功能', description: '关闭后个人页不再显示签到入口。', type: 'boolean' },
  { key: 'checkin_min_quota', title: '签到最小额度', description: '签到奖励的最小额度。', type: 'number', min: 0 },
  { key: 'checkin_max_quota', title: '签到最大额度', description: '签到奖励的最大额度。', type: 'number', min: 0 },
] as const satisfies ReadonlyArray<SettingsOptionMeta>;

export const passkeyOptionMeta = [
  { key: 'passkey_enabled', title: '启用 Passkey 登录', description: '开启后允许使用 Passkey 注册和登录。', type: 'boolean' },
  { key: 'passkey_rp_display_name', title: 'RP 显示名', description: 'WebAuthn 凭证展示给用户的站点名称。', type: 'text' },
  { key: 'passkey_rp_id', title: 'RP ID', description: '一般填主域名，如 example.com，留空则自动推导。', type: 'text' },
  { key: 'passkey_origins', title: '允许 Origins', description: '支持多个，逗号或换行分隔。留空时自动使用当前访问来源。', type: 'textarea', rows: 4 },
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
] as const satisfies ReadonlyArray<SettingsOptionMeta>;

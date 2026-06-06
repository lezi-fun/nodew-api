import axios from 'axios';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

export type SetupStatus = {
  isInitialized: boolean;
  hasAdmin: boolean;
  config?: {
    registrationEnabled?: boolean;
    registrationEmailVerificationRequired?: boolean;
    selfUseModeEnabled?: boolean;
    demoSiteEnabled?: boolean;
    passkeyEnabled?: boolean;
    checkinEnabled?: boolean;
    siteName?: string | null;
    siteDescription?: string | null;
    defaultModel?: string | null;
  };
};

export type EmailVerificationRequestResult = {
  success: boolean;
  verificationToken?: string;
};

export type EmailBindingRequestResult = {
  success: boolean;
  verificationToken?: string;
  verificationCode?: string;
};

export type EmailBindingVerifyResult = {
  success: boolean;
  user: CurrentUser;
};

export type RegistrationVerificationRequestResult = {
  success: boolean;
  verificationToken?: string;
  verificationCode?: string;
};

export type RegistrationVerificationResult = {
  success: boolean;
  email: string;
  username: string;
  displayName: string | null;
};

export type MailProvider = 'disabled' | 'smtp' | 'resend';

export type ServiceStatus = {
  status: string;
  service: string;
  version: string;
};

export type AppStatus = ServiceStatus & {
  setup?: {
    isInitialized: boolean;
    initializedAt: string | null;
  };
  counts?: {
    users: number;
    admins: number;
    apiKeys: number;
    activeApiKeys: number;
    channels: number;
  };
  passkey?: {
    enabled: boolean;
  };
  oauth?: {
    github?: {
      enabled: boolean;
    };
  };
};

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  emailVerifiedAt: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  quotaRemaining: string;
  quotaUsed: string;
  lastLoginAt: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
};

export type LoginResult =
  | {
      success: true;
      user: CurrentUser;
      requiresTwoFA?: false;
    }
  | {
      success: true;
      requiresTwoFA: true;
    };

export type TwoFAStatus = {
  enabled: boolean;
  locked: boolean;
  backupCodesRemaining: number;
};

export type TwoFASetupResult = {
  secret: string;
  qrCodeData: string;
  backupCodes: string[];
};

export type TwoFABackupCodesResult = {
  backupCodes: string[];
};

export type SecureVerificationResult = {
  success: boolean;
  verifiedUntil: string;
};

export type OAuthProvider = 'github';

export type OAuthStateResult = {
  success: true;
  data: {
    state: string;
    authorizeUrl: string;
  };
};

export type OAuthCallbackResult =
  | {
      success: true;
      action: 'login';
      user: Pick<CurrentUser, 'id' | 'email' | 'username' | 'displayName' | 'emailVerifiedAt' | 'role' | 'status' | 'lastLoginAt'>;
      redirectTo: string | null;
    }
  | {
      success: true;
      action: 'bind';
      redirectTo: string | null;
    }
  | {
      success: true;
      requiresTwoFA: true;
      email: string | null;
      redirectTo: string | null;
    };

export type OAuthBindingItem = {
  id: string;
  provider: string;
  providerName: string;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelItem = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  model: string | null;
  status: 'ACTIVE' | 'DISABLED';
  priority: number;
  weight: number;
  rateLimitPerMin: number | null;
  metadata: Record<string, unknown> | null;
  keyPreview: string;
  createdAt: string;
  updatedAt: string;
};

export type TokenItem = {
  id: string;
  name: string;
  keyPrefix: string;
  maskedKey: string;
  status: 'ACTIVE' | 'REVOKED';
  quotaRemaining: string | null;
  metadata: Record<string, unknown> | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type UserItem = CurrentUser & {
  group?: { id: string; name: string } | null;
  twoFA?: { isEnabled: boolean; lastUsedAt: string | null } | null;
  passkeyCredential?: { createdAt: string; lastUsedAt: string | null } | null;
  updatedAt?: string;
};

export type RedemptionItem = {
  id: string;
  codePrefix: string;
  quotaAmount: string;
  status: 'ACTIVE' | 'REDEEMED' | 'REVOKED';
  expiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
  updatedAt: string;
  maskedCode: string;
  createdBy: { id: string; email: string; username: string };
  redeemedByUser: { id: string; email: string; username: string } | null;
};

export type CreatedRedemptionItem = RedemptionItem & {
  code: string;
};

export type GroupItem = {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SystemOptionKey =
  | 'registration_enabled'
  | 'registration_email_verification_required'
  | 'self_use_mode_enabled'
  | 'demo_site_enabled'
  | 'checkin_enabled'
  | 'checkin_min_quota'
  | 'checkin_max_quota'
  | 'checkin_reward_quota'
  | 'passkey_enabled'
  | 'passkey_rp_display_name'
  | 'passkey_rp_id'
  | 'passkey_origins'
  | 'passkey_allow_insecure_origin'
  | 'passkey_user_verification'
  | 'passkey_attachment_preference'
  | 'site_name'
  | 'site_description'
  | 'default_model'
  | 'notice'
  | 'user_agreement'
  | 'privacy_policy'
  | 'about'
  | 'home_page_content';

export type SystemOptionItem = {
  key: SystemOptionKey;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type UsageLogItem = {
  id: string;
  requestId: string | null;
  provider: string;
  model: string | null;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents: number | null;
  statusCode: number | null;
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
  apiKey: { id: string; name: string; keyPrefix: string } | null;
  channel: { id: string; name: string; provider: string; model: string | null } | null;
  user: { id: string; email: string; username: string };
};

export type ModelItem = {
  id: string;
  model: string;
  provider: string;
  providers: string[];
  channels: number;
  activeChannels: number;
  weight: number;
  channelIds: string[];
  enabled: boolean;
  requests?: number;
  lastRequestedAt?: string | null;
  endpoints?: string[];
  reason?: string;
};

export type PricingInfo = {
  currency: string;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    quota: string;
    features: string[];
    current?: boolean;
  }>;
  stats: {
    channels: number;
    activeChannels: number;
    models: number;
  };
  note: string;
};

export type SiteInfo = {
  siteName: string;
  siteDescription: string;
  defaultModel: string;
  registrationEnabled: boolean;
  registrationEmailVerificationRequired: boolean;
  notice: string;
  userAgreement: string;
  privacyPolicy: string;
  about: string;
  homePageContent: string;
  links: {
    github: string;
    preview: string;
    upstream: string;
  };
  stats: {
    users: number;
    activeApiKeys: number;
    channels: number;
    activeChannels: number;
  };
};

export type TaskItem = {
  id: string;
  logId?: string;
  type?: string;
  action?: string;
  prompt?: string;
  status: string;
  model?: string | null;
  provider?: string;
  endpoint?: string;
  statusCode?: number | null;
  totalTokens?: number;
  quota?: number;
  latencyMs?: number | null;
  createdAt: string;
};

export type MailStatus = {
  appBaseUrl: string | null;
  provider: MailProvider;
  from: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  resendApiKey: string | null;
  enabled: boolean;
  valid: boolean;
  errors: string[];
  source: 'environment' | 'settings' | 'mixed';
};

export type MailConfig = {
  appBaseUrl: string;
  provider: MailProvider;
  from: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  resendApiKey: string;
};

export type CheckinStatus = {
  enabled: boolean;
  checkedInToday: boolean;
  today: string;
  minQuota: string;
  maxQuota: string;
  lastCheckinAt: string | null;
  lastCheckinDate: string | null;
  lastRewardQuota: string | null;
  month: string;
  monthCheckins: number;
  monthQuota: string;
  totalCheckins: number;
  totalQuota: string;
  currentStreak: number;
  longestStreak: number;
  records: Array<{
    checkinDate: string;
    rewardQuota: string;
    createdAt: string;
  }>;
};

export type CheckinResult = {
  success: boolean;
  rewardQuota: string;
  record: {
    checkinDate: string;
    rewardQuota: string;
    createdAt: string;
  };
};

export type PasskeyStatus = {
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  attachment: string | null;
  signCount: number;
  userVerified: boolean;
  backupEligible: boolean;
  backupState: boolean;
};

export type TaskListData = {
  items: TaskItem[];
  total: number;
  nextCursor?: string | null;
  type?: string;
  message?: string;
};

export type LegacyDataResponse<T> = {
  success?: boolean;
  message?: string;
  data: T;
  items?: T extends Array<infer U> ? U[] : never;
  item?: T;
  total?: number;
  nextCursor?: string | null;
};

export type ListResponse<T> = {
  success?: boolean;
  items?: T[];
  item?: T;
  total?: number;
  page?: number;
  pageSize?: number;
  nextCursor?: string | null;
  message?: string;
};

export type ChannelPayload = {
  name: string;
  provider: string;
  baseUrl?: string | null;
  model?: string | null;
  apiKey?: string;
  status?: 'ACTIVE' | 'DISABLED';
  priority?: number;
  weight?: number;
  rateLimitPerMin?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type ChannelTestResult = {
  channelId: string;
  channelName: string;
  provider: string;
  model: string | null;
  statusCode: number;
  success: boolean;
  errorMessage: string | null;
};

export type UpstreamModelItem = {
  id: string;
  ownedBy: string | null;
};

export type ChannelModelsResult = {
  statusCode: number;
  success: boolean;
  errorMessage: string | null;
  items: UpstreamModelItem[];
  total: number;
};

export type TokenCreatePayload = {
  name: string;
  expiresAt?: string;
  quotaRemaining?: string;
  metadata?: Record<string, unknown>;
};

export type TokenUpdatePayload = {
  name?: string;
  status?: 'ACTIVE' | 'REVOKED';
  expiresAt?: string | null;
  quotaRemaining?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UserCreatePayload = {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  role?: 'USER' | 'ADMIN';
  status?: 'ACTIVE' | 'DISABLED';
  groupId?: string | null;
  quotaRemaining?: string;
};

export type UserUpdatePayload = {
  email?: string;
  username?: string;
  displayName?: string | null;
  role?: 'USER' | 'ADMIN';
  status?: 'ACTIVE' | 'DISABLED';
  groupId?: string | null;
  quotaRemaining?: string;
};

export type RedemptionCreatePayload = {
  quotaAmount: string;
  expiresAt?: string;
};

export type RedemptionUpdatePayload = {
  quotaAmount?: string;
  status?: 'ACTIVE' | 'REDEEMED' | 'REVOKED';
  expiresAt?: string | null;
};

export type CreatedTokenItem = TokenItem & {
  key: string;
};

export type UsageQuery = {
  limit?: number;
  cursor?: string;
  success?: 'true' | 'false';
};

export type UsageSummary = {
  requests: number;
  success: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents: number;
  averageLatencyMs: number;
  byProvider: Array<{
    provider: string;
    requests: number;
    totalTokens: number;
    estimatedCostCents: number;
  }>;
};

const client = axios.create({
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      throw new Error(typeof message === 'string' ? message : error.message);
    }

    throw error;
  },
);

export const api = {
  getSetupStatus: async () => (await client.get<SetupStatus>('/api/setup')).data,
  initialize: async (payload: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) => (await client.post<{ user: CurrentUser; isInitialized: boolean }>('/api/setup', payload)).data,
  login: async (payload: { email: string; password: string }) =>
    (await client.post<LoginResult>('/api/user/login', payload)).data,
  verifyTwoFactorLogin: async (payload: { code: string }) =>
    (await client.post<{ success: true; user: CurrentUser }>('/api/user/login/2fa', payload)).data,
  passkeyLoginBegin: async () =>
    (await client.post<{ item: PublicKeyCredentialRequestOptionsJSON }>('/api/user/passkey/login/begin')).data,
  passkeyLoginFinish: async (payload: { response: AuthenticationResponseJSON }) =>
    (await client.post<{ success: true; user: CurrentUser }>('/api/user/passkey/login/finish', payload)).data,
  getTwoFAStatus: async () => (await client.get<{ item: TwoFAStatus }>('/api/user/2fa/status')).data,
  setupTwoFA: async () => (await client.post<{ item: TwoFASetupResult }>('/api/user/2fa/setup')).data,
  enableTwoFA: async (payload: { code: string }) => (await client.post<{ success: boolean }>('/api/user/2fa/enable', payload)).data,
  disableTwoFA: async () => (await client.post<{ success: boolean }>('/api/user/2fa/disable')).data,
  regenerateTwoFABackupCodes: async () =>
    (await client.post<{ item: TwoFABackupCodesResult }>('/api/user/2fa/backup-codes')).data,
  register: async (payload: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
    verificationToken?: string;
    verificationCode?: string;
  }) => (await client.post('/api/user/register', payload)).data,
  requestRegistrationVerification: async (payload: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) => {
    const response = await client.post<RegistrationVerificationRequestResult>('/api/user/register/verification', payload);
    const verificationToken = response.headers['x-registration-verification-token'];
    const verificationCode = response.headers['x-registration-verification-code'];

    return {
      ...response.data,
      verificationToken: typeof verificationToken === 'string' ? verificationToken : undefined,
      verificationCode: typeof verificationCode === 'string' ? verificationCode : undefined,
    };
  },
  verifyRegistration: async (payload: { email?: string; token?: string; code?: string }) =>
    (await client.post<RegistrationVerificationResult>('/api/user/register/verify', payload)).data,
  forgotPassword: async (payload: { email: string }) =>
    (await client.post('/api/user/password/forgot', payload)).data,
  resetPassword: async (payload: { token: string; password: string }) =>
    (await client.post('/api/user/password/reset', payload)).data,
  requestEmailVerification: async () => {
    const response = await client.post<EmailVerificationRequestResult>('/api/user/email/verification');
    const verificationToken = response.headers['x-email-verification-token'];

    return {
      ...response.data,
      verificationToken: typeof verificationToken === 'string' ? verificationToken : undefined,
    };
  },
  requestEmailBinding: async (payload: { email: string }) => {
    const response = await client.post<EmailBindingRequestResult>('/api/user/email/bind/request', payload);
    const verificationToken = response.headers['x-email-binding-token'];
    const verificationCode = response.headers['x-email-binding-code'];

    return {
      ...response.data,
      verificationToken: typeof verificationToken === 'string' ? verificationToken : undefined,
      verificationCode: typeof verificationCode === 'string' ? verificationCode : undefined,
    };
  },
  verifyEmail: async (payload: { token: string }) =>
    (await client.post<{ success: boolean }>('/api/user/email/verify', payload)).data,
  verifyEmailBinding: async (payload: { email?: string; token?: string; code?: string }) =>
    (await client.post<EmailBindingVerifyResult>('/api/user/email/bind/verify', payload)).data,
  logout: async () => (await client.post<{ success: boolean }>('/api/user/logout')).data,
  getCurrentUser: async () => (await client.get<{ user: CurrentUser }>('/api/user/self')).data,
  getStatus: async () => (await client.get<AppStatus>('/api/status')).data,
  updateCurrentUser: async (payload: { displayName?: string; settings?: Record<string, unknown> }) =>
    (await client.patch<{ user: CurrentUser }>('/api/user/self', payload)).data,
  changeCurrentUserPassword: async (payload: { currentPassword: string; newPassword: string }) =>
    (await client.post<{ success: boolean }>('/api/user/self/password', payload)).data,
  getPasskeyStatus: async () => (await client.get<{ item: PasskeyStatus }>('/api/user/passkey')).data,
  passkeyRegisterBegin: async () =>
    (await client.post<{ item: PublicKeyCredentialCreationOptionsJSON }>('/api/user/passkey/register/begin')).data,
  passkeyRegisterFinish: async (payload: { response: RegistrationResponseJSON }) =>
    (await client.post<{ success: boolean }>('/api/user/passkey/register/finish', payload)).data,
  passkeyVerifyBegin: async () =>
    (await client.post<{ item: PublicKeyCredentialRequestOptionsJSON }>('/api/user/passkey/verify/begin')).data,
  passkeyVerifyFinish: async (payload: { response: AuthenticationResponseJSON }) =>
    (await client.post<{ success: boolean; verifiedUntil: string }>('/api/user/passkey/verify/finish', payload)).data,
  verifySecureAction: async (payload: { method: '2fa'; code: string } | { method: 'passkey' }) =>
    (await client.post<SecureVerificationResult>('/api/verify', payload)).data,
  getOAuthState: async (payload: { provider: OAuthProvider; mode?: 'login' | 'bind'; redirectTo?: string }) =>
    (await client.get<OAuthStateResult>('/api/oauth/state', { params: payload })).data,
  oauthCallback: async (provider: OAuthProvider, params: { code?: string; state?: string; error?: string; error_description?: string }) =>
    (await client.get<OAuthCallbackResult>(`/api/oauth/${provider}`, { params })).data,
  listOAuthBindings: async () => (await client.get<{ items: OAuthBindingItem[] }>('/api/user/oauth/bindings')).data,
  deleteOAuthBinding: async (provider: OAuthProvider) =>
    (await client.delete<{ success: boolean }>(`/api/user/oauth/bindings/${provider}`)).data,
  listUserOAuthBindings: async (id: string) =>
    (await client.get<{ items: OAuthBindingItem[] }>(`/api/users/${id}/oauth/bindings`)).data,
  deleteUserOAuthBinding: async (id: string, provider: OAuthProvider) =>
    (await client.delete<{ success: boolean }>(`/api/users/${id}/oauth/bindings/${provider}`)).data,
  deletePasskey: async () => (await client.delete<{ success: boolean }>('/api/user/passkey')).data,
  listChannels: async () => (await client.get<ListResponse<ChannelItem>>('/api/channels')).data,
  createChannel: async (payload: ChannelPayload & { apiKey: string }) =>
    (await client.post<{ item: ChannelItem }>('/api/channels', payload)).data,
  updateChannel: async (id: string, payload: ChannelPayload) =>
    (await client.patch<{ item: ChannelItem }>(`/api/channels/${id}`, payload)).data,
  deleteChannel: async (id: string) => (await client.delete<{ success: boolean }>(`/api/channels/${id}`)).data,
  copyChannel: async (id: string, payload?: { name?: string; suffix?: string }) =>
    (await client.post<{ item: ChannelItem }>(`/api/channels/${id}/copy`, payload ?? {})).data,
  testChannel: async (id: string, payload?: { model?: string }) =>
    (await client.post<{ item: ChannelTestResult }>(`/api/channels/${id}/test`, payload ?? {})).data,
  fetchChannelModels: async (id: string, model?: string) =>
    (await client.get<{ item: ChannelModelsResult }>(`/api/channels/${id}/models`, { params: model ? { model } : undefined })).data,
  fetchUpstreamModels: async (payload: {
    provider: string;
    baseUrl?: string | null;
    apiKey: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<{ item: ChannelModelsResult }> => {
    const response = await client.post<{
      data?: string[];
      items?: string[];
      total?: number;
      statusCode?: number;
      success?: boolean;
      message?: string;
    }>('/api/channel/fetch_models', payload);
    const rawModels = response.data.items ?? response.data.data ?? [];
    const items = rawModels
      .map((model) => String(model ?? '').trim())
      .filter(Boolean)
      .map((id) => ({ id, ownedBy: null }));
    const statusCode = response.data.statusCode ?? 200;

    return {
      ...response.data,
      item: {
        statusCode,
        success: statusCode >= 200 && statusCode < 300,
        errorMessage: statusCode >= 200 && statusCode < 300 ? null : '获取模型失败',
        items,
        total: response.data.total ?? items.length,
      },
    };
  },
  syncChannelModels: async (id: string, model?: string) =>
    (await client.post<{ item: ChannelModelsResult }>(`/api/channels/${id}/models/sync`, undefined, { params: model ? { model } : undefined })).data,
  listTokens: async () => (await client.get<ListResponse<TokenItem>>('/api/token')).data,
  createToken: async (payload: TokenCreatePayload) =>
    (await client.post<{ item: CreatedTokenItem }>('/api/token', payload)).data,
  updateToken: async (id: string, payload: TokenUpdatePayload) =>
    (await client.put<{ item: TokenItem }>(`/api/token/${id}`, payload)).data,
  deleteToken: async (id: string) => (await client.delete<{ success: boolean }>(`/api/token/${id}`)).data,
  listRedemptions: async (params?: { limit?: number; cursor?: string; status?: RedemptionItem['status'] }) =>
    (await client.get<ListResponse<RedemptionItem>>('/api/redemptions', { params })).data,
  createRedemption: async (payload: RedemptionCreatePayload) =>
    (await client.post<{ item: CreatedRedemptionItem }>('/api/redemptions', payload)).data,
  redeemCode: async (payload: { code: string }) =>
    (await client.post<{ user: CurrentUser }>('/api/user/redemption/redeem', payload)).data,
  updateRedemption: async (id: string, payload: RedemptionUpdatePayload) =>
    (await client.patch<{ item: RedemptionItem }>(`/api/redemptions/${id}`, payload)).data,
  deleteRedemption: async (id: string) => (await client.delete<{ success: boolean }>(`/api/redemptions/${id}`)).data,
  listUsers: async (params?: { limit?: number; cursor?: string; role?: UserItem['role']; status?: UserItem['status']; keyword?: string }) =>
    (await client.get<ListResponse<UserItem>>('/api/users', { params })).data,
  createUser: async (payload: UserCreatePayload) =>
    (await client.post<{ user: UserItem }>('/api/users', payload)).data,
  updateUser: async (id: string, payload: UserUpdatePayload) =>
    (await client.patch<{ user: UserItem }>(`/api/users/${id}`, payload)).data,
  deleteUser: async (id: string) => (await client.delete<{ success: boolean }>(`/api/users/${id}`)).data,
  resetUserPassword: async (id: string, payload: { password: string; revokeSession?: boolean }) =>
    (await client.post<{ success: boolean }>(`/api/users/${id}/password`, payload)).data,
  resetUserTwoFA: async (id: string) => (await client.delete<{ success: boolean }>(`/api/users/${id}/2fa`)).data,
  resetUserPasskey: async (id: string) => (await client.delete<{ success: boolean }>(`/api/users/${id}/passkey`)).data,
  revokeUserSession: async (id: string) =>
    (await client.post<{ success: boolean }>(`/api/users/${id}/session/revoke`)).data,
  generateUserAccessToken: async (id: string) =>
    (await client.post<{ accessToken: string }>(`/api/users/${id}/access-token`)).data,
  listGroups: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<ListResponse<GroupItem>>('/api/groups', { params })).data,
  listOptions: async () => (await client.get<ListResponse<SystemOptionItem>>('/api/options')).data,
  updateOption: async (key: SystemOptionKey, value: string | boolean | number) =>
    (await client.put<{ item: SystemOptionItem }>(`/api/options/${key}`, { value })).data,
  getMailStatus: async () => (await client.get<{ item: MailStatus }>('/api/options/mail/status')).data,
  getMailConfig: async () => (await client.get<{ item: MailConfig }>('/api/options/mail/config')).data,
  updateMailConfig: async (payload: MailConfig) =>
    (await client.put<{ item: MailConfig; status: MailStatus }>('/api/options/mail/config', payload)).data,
  sendTestMail: async (payload?: { email?: string }) =>
    (await client.post<{ success: boolean; email: string }>('/api/options/mail/test', payload ?? {})).data,
  getCheckinStatus: async (params?: { month?: string }) => (await client.get<{ status: CheckinStatus }>('/api/checkin/status', { params })).data,
  checkIn: async () => (await client.post<CheckinResult>('/api/checkin')).data,
  listUsageLogs: async (params?: UsageQuery) => (await client.get<ListResponse<UsageLogItem>>('/api/usage', { params })).data,
  listSelfUsageLogs: async (params?: UsageQuery) => (await client.get<ListResponse<UsageLogItem>>('/api/usage/self', { params })).data,
  getUsageSummary: async () => (await client.get<UsageSummary>('/api/usage/summary')).data,
  getSelfUsageSummary: async () => (await client.get<UsageSummary>('/api/usage/self/summary')).data,
  getSiteInfo: async () => (await client.get<LegacyDataResponse<SiteInfo>>('/api/site')).data,
  getAboutContent: async () => (await client.get<LegacyDataResponse<string>>('/api/about')).data,
  getNoticeContent: async () => (await client.get<LegacyDataResponse<string>>('/api/notice')).data,
  getPricing: async () => (await client.get<LegacyDataResponse<PricingInfo>>('/api/pricing')).data,
  listModels: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<ListResponse<ModelItem>>('/api/models', { params })).data,
  listMissingModels: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<ListResponse<ModelItem>>('/api/models/missing', { params })).data,
  listTasks: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<LegacyDataResponse<TaskListData>>('/api/task', { params })).data,
  listSelfTasks: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<LegacyDataResponse<TaskListData>>('/api/task/self', { params })).data,
  listImageTasks: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<LegacyDataResponse<TaskListData>>('/api/mj', { params })).data,
  listSelfImageTasks: async (params?: { limit?: number; cursor?: string; keyword?: string }) =>
    (await client.get<LegacyDataResponse<TaskListData>>('/api/mj/self', { params })).data,
};

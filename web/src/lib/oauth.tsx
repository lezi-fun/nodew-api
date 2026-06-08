import { IconGithubLogo } from '@douyinfe/semi-icons';
import type { ReactNode } from 'react';

import type { AppStatus, BuiltinOAuthProvider, OAuthProvider } from './api';

type OAuthProviderMeta = {
  label: string;
  tagColor: 'grey' | 'blue' | 'cyan' | 'green';
  avatarColor: 'grey' | 'indigo' | 'cyan' | 'green';
  avatarContent: ReactNode;
};

const oauthProviderMeta: Record<BuiltinOAuthProvider, OAuthProviderMeta> = {
  github: {
    label: 'GitHub',
    tagColor: 'blue',
    avatarColor: 'indigo',
    avatarContent: <IconGithubLogo />,
  },
  discord: {
    label: 'Discord',
    tagColor: 'cyan',
    avatarColor: 'cyan',
    avatarContent: 'D',
  },
  linuxdo: {
    label: 'LinuxDO',
    tagColor: 'green',
    avatarColor: 'green',
    avatarContent: 'L',
  },
  oidc: {
    label: 'OIDC',
    tagColor: 'grey',
    avatarColor: 'grey',
    avatarContent: 'O',
  },
};

const fallbackOAuthProviderMeta: OAuthProviderMeta = {
  label: '第三方账号',
  tagColor: 'grey',
  avatarColor: 'grey',
  avatarContent: '?',
};

export const oauthProviders: OAuthProvider[] = ['github', 'discord', 'linuxdo', 'oidc'];

export const isBuiltinOAuthProvider = (value: string | undefined): value is BuiltinOAuthProvider =>
  value === 'github' || value === 'discord' || value === 'linuxdo' || value === 'oidc';

export const isOAuthProviderSlug = (value: string | undefined): value is OAuthProvider =>
  typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value);

export const getOAuthProviderMeta = (provider: string, status?: AppStatus | null) => {
  if (isBuiltinOAuthProvider(provider)) {
    return oauthProviderMeta[provider];
  }

  const customProvider = status?.oauth?.customProviders?.find((item) => item.slug === provider);

  if (!customProvider) {
    return fallbackOAuthProviderMeta;
  }

  return {
    ...fallbackOAuthProviderMeta,
    label: customProvider.name,
    avatarContent: customProvider.icon || customProvider.name.slice(0, 1).toUpperCase(),
  };
};

export const isOAuthProviderEnabled = (
  status: AppStatus | null | undefined,
  provider: OAuthProvider,
) => (
  isBuiltinOAuthProvider(provider)
    ? status?.oauth?.[provider]?.enabled === true
    : status?.oauth?.customProviders?.some((item) => item.enabled && item.slug === provider) === true
);

export const getEnabledOAuthProviders = (status: AppStatus | null | undefined): OAuthProvider[] => [
  ...oauthProviders.filter((provider) => isOAuthProviderEnabled(status, provider)),
  ...(status?.oauth?.customProviders ?? [])
    .filter((provider) => provider.enabled)
    .map((provider) => provider.slug),
];

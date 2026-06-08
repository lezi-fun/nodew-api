import { IconGithubLogo } from '@douyinfe/semi-icons';
import type { ReactNode } from 'react';

import type { AppStatus, OAuthProvider } from './api';

type OAuthProviderMeta = {
  label: string;
  tagColor: 'grey' | 'blue' | 'cyan' | 'green';
  avatarColor: 'grey' | 'indigo' | 'cyan' | 'green';
  avatarContent: ReactNode;
};

const oauthProviderMeta: Record<OAuthProvider, OAuthProviderMeta> = {
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

export const isOAuthProvider = (value: string | undefined): value is OAuthProvider =>
  value === 'github' || value === 'discord' || value === 'linuxdo' || value === 'oidc';

export const getOAuthProviderMeta = (provider: string) =>
  isOAuthProvider(provider) ? oauthProviderMeta[provider] : fallbackOAuthProviderMeta;

export const isOAuthProviderEnabled = (
  status: AppStatus | null | undefined,
  provider: OAuthProvider,
) => status?.oauth?.[provider]?.enabled === true;

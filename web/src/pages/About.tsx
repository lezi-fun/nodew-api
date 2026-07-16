import { Button, Card, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconGithubLogo, IconRefresh } from '@douyinfe/semi-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, type SiteInfo } from '../lib/api';

const createFallbackSite = (description: string): SiteInfo => ({
  siteName: 'NodEW-api',
  siteDescription: description,
  defaultModel: 'gpt-4o-mini',
  registrationEnabled: false,
  registrationEmailVerificationRequired: false,
  notice: '',
  userAgreement: '',
  privacyPolicy: '',
  about: description,
  homePageContent: '',
  links: {
    github: 'https://github.com/lezi-fun/nodew-api',
    preview: 'https://nodew.lezi.chat',
    upstream: 'https://github.com/songquanpeng/one-api',
  },
  stats: {
    users: 0,
    activeApiKeys: 0,
    channels: 0,
    activeChannels: 0,
  },
});

export default function AboutPage() {
  const { t } = useTranslation();
  const [site, setSite] = useState<SiteInfo>(() => createFallbackSite(t('NodEW-api 是 One API 的 Node.js / TypeScript 版本。')));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getSiteInfo();
      setSite(response.data);
    } catch (error) {
      setSite(createFallbackSite(t('NodEW-api 是 One API 的 Node.js / TypeScript 版本。')));
      Toast.error(error instanceof Error ? error.message : t('加载关于信息失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page-shell about-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">{t('关于')}</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>{site.siteName}</Typography.Title>
          <Typography.Paragraph className="console-description">{site.siteDescription}</Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<IconRefresh />} loading={loading} onClick={() => void load()}>{t('刷新')}</Button>
          <Button icon={<IconGithubLogo />} as="a" href={site.links.github} target="_blank" rel="noreferrer">GitHub</Button>
        </Space>
      </section>

      <section className="metric-grid">
        <Card className="metric-card tone-blue" bordered={false}><span>{t('用户')}</span><strong>{site.stats.users}</strong></Card>
        <Card className="metric-card tone-green" bordered={false}><span>{t('活跃令牌')}</span><strong>{site.stats.activeApiKeys}</strong></Card>
        <Card className="metric-card tone-orange" bordered={false}><span>{t('活跃渠道')}</span><strong>{site.stats.activeChannels}</strong></Card>
        <Card className="metric-card tone-grey" bordered={false}><span>{t('默认模型')}</span><strong>{site.defaultModel}</strong></Card>
      </section>

      <Card bordered={false} className="dashboard-card content-card">
        <Typography.Title heading={4}>{t('项目说明')}</Typography.Title>
        <Typography.Paragraph>{site.about || t('NodEW-api 是 One API 的 Node.js / TypeScript 版本。')}</Typography.Paragraph>
        <Typography.Paragraph type="tertiary">
          {t('NodEW-api 是 One API 的 Node.js / TypeScript 版本，当前仍处于初步开发阶段，不建议直接用于生产环境。')}
        </Typography.Paragraph>
        <Space wrap>
          <Button as="a" href={site.links.upstream} target="_blank" rel="noreferrer">One API</Button>
          <Button as="a" href={site.links.preview} target="_blank" rel="noreferrer">{t('测试预览')}</Button>
        </Space>
      </Card>
    </main>
  );
}

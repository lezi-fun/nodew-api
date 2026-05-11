import { Button, Card, Col, Row, Toast, Typography } from '@douyinfe/semi-ui';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, type SiteInfo } from '../lib/api';

const fallbackSite: SiteInfo = {
  siteName: 'nodew-api',
  siteDescription: '管理渠道、令牌、用户与使用日志，并通过统一控制台完成系统初始化和日常运维。',
  defaultModel: 'gpt-4o-mini',
  notice: '',
  userAgreement: '',
  privacyPolicy: '',
  about: '',
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
};

export default function HomePage() {
  const [site, setSite] = useState<SiteInfo>(fallbackSite);

  const load = useCallback(async () => {
    try {
      const response = await api.getSiteInfo();
      setSite(response.data);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '加载站点信息失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page-shell home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="hero-badge">{site.siteName}</span>
          <Typography.Title heading={1}>统一 AI 网关控制台</Typography.Title>
          <Typography.Paragraph>
            {site.siteDescription}
          </Typography.Paragraph>
          <div className="hero-actions">
            <Button theme="solid" size="large" as={Link} to="/console">进入控制台</Button>
            <Button theme="light" size="large" as={Link} to="/login">登录</Button>
            <Button theme="borderless" size="large" as="a" href={site.links.github} target="_blank" rel="noreferrer">GitHub</Button>
          </div>
        </div>
        <Card className="hero-card-panel" bordered={false}>
          <Typography.Title heading={4}>实例状态</Typography.Title>
          <ul className="hero-list">
            <li>默认模型：{site.defaultModel}</li>
            <li>活跃渠道：{site.stats.activeChannels} / {site.stats.channels}</li>
            <li>活跃令牌：{site.stats.activeApiKeys}</li>
          </ul>
        </Card>
      </section>

      {site.notice ? (
        <Card className="dashboard-card site-notice-card" bordered={false}>
          <strong>公告</strong>
          <span>{site.notice}</span>
        </Card>
      ) : null}

      {site.homePageContent ? (
        <Card className="dashboard-card content-card" bordered={false}>
          <Typography.Title heading={4}>站点说明</Typography.Title>
          <Typography.Paragraph>{site.homePageContent}</Typography.Paragraph>
        </Card>
      ) : null}

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card className="feature-card" title="控制台">
            集中处理渠道、令牌、日志、用户等核心管理工作。
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="feature-card" title="认证流">
            支持登录、注册、忘记密码和重置密码等基础认证路径。
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="feature-card" title="管理体验">
            继续完善列表操作、表单交互和数据联动，提升整体使用体验。
          </Card>
        </Col>
      </Row>
    </main>
  );
}

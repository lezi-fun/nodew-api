import { Button, Card, Col, Row, Typography } from '@douyinfe/semi-ui';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="page-shell home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="hero-badge">nodew-api</span>
          <Typography.Title heading={1}>统一 AI 网关控制台</Typography.Title>
          <Typography.Paragraph>
            管理渠道、令牌、用户与使用日志，并通过统一控制台完成系统初始化和日常运维。
          </Typography.Paragraph>
          <div className="hero-actions">
            <Button theme="solid" size="large" as={Link} to="/console">进入控制台</Button>
            <Button theme="light" size="large" as={Link} to="/login">登录</Button>
          </div>
        </div>
        <Card className="hero-card-panel" bordered={false}>
          <Typography.Title heading={4}>核心能力</Typography.Title>
          <ul className="hero-list">
            <li>统一管理渠道与模型接入配置</li>
            <li>集中查看令牌、用户与兑换码数据</li>
            <li>快速进入控制台完成初始化与日常运维</li>
          </ul>
        </Card>
      </section>

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

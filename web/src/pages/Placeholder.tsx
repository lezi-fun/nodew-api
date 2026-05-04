import { Button, Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconActivity, IconArrowRight, IconGridRectangle } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';

type PlaceholderPageProps = {
  title: string;
  description: string;
  module: 'chat' | 'console' | 'personal' | 'admin';
  state?: 'planned' | 'wired' | 'disabled';
};

const moduleCopy = {
  chat: '聊天与调试',
  console: '控制台',
  personal: '个人中心',
  admin: '管理员',
};

const stateColor = {
  planned: 'orange',
  wired: 'green',
  disabled: 'grey',
} as const;

export default function PlaceholderPage({
  title,
  description,
  module,
  state = 'planned',
}: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <main className="console-page placeholder-page">
      <section className="console-hero">
        <div>
          <div className="console-eyebrow">{moduleCopy[module]}</div>
          <Typography.Title heading={2} style={{ margin: '6px 0 8px' }}>{title}</Typography.Title>
          <Typography.Paragraph className="console-description">{description}</Typography.Paragraph>
        </div>
        <Tag color={stateColor[state]} size="large">{state}</Tag>
      </section>

      <Card bordered={false} className="dashboard-card placeholder-card">
        <div className="placeholder-illustration">
          <IconGridRectangle size="extra-large" />
        </div>
        <Typography.Title heading={4}>前端入口已对齐，后端能力按模块接入</Typography.Title>
        <Typography.Paragraph type="tertiary">
          这个页面用于保持与原版控制台信息架构一致。当前 nodew-api 后端尚未提供该模块的完整 API，
          因此先提供可导航、可扩展的前端壳，后续接入真实数据时不会再调整路由。
        </Typography.Paragraph>
        <Space wrap>
          <Button theme="solid" type="primary" icon={<IconArrowRight />} onClick={() => navigate('/console')}>
            返回数据看板
          </Button>
          <Button icon={<IconActivity />} onClick={() => navigate('/console/log')}>
            查看使用日志
          </Button>
        </Space>
      </Card>
    </main>
  );
}

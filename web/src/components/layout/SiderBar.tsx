import { Button, Divider, Nav } from '@douyinfe/semi-ui';
import {
  IconActivity,
  IconApps,
  IconCreditCard,
  IconGift,
  IconGridRectangle,
  IconHistogram,
  IconKey,
  IconLayers,
  IconPriceTag,
  IconSetting,
  IconShrink,
  IconTerminal,
  IconUser,
} from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const sections = [
  {
    title: '聊天',
    key: 'chat',
    items: [
      { key: 'playground', to: '/console/playground', textKey: '操练场', icon: <IconTerminal /> },
      { key: 'chat-session', to: '/console/chat', textKey: '聊天', icon: <IconApps /> },
    ],
  },
  {
    title: '控制台',
    key: 'console',
    items: [
      { key: 'detail', to: '/console', textKey: '数据看板', icon: <IconGridRectangle /> },
      { key: 'token', to: '/console/token', textKey: '令牌管理', icon: <IconCreditCard /> },
      { key: 'log', to: '/console/log', textKey: '使用日志', icon: <IconHistogram /> },
      { key: 'midjourney', to: '/console/midjourney', textKey: '绘图日志', icon: <IconLayers /> },
      { key: 'task', to: '/console/task', textKey: '任务日志', icon: <IconActivity /> },
    ],
  },
  {
    title: '个人中心',
    key: 'personal',
    items: [
      { key: 'topup', to: '/console/topup', textKey: '钱包管理', icon: <IconPriceTag /> },
      { key: 'subscription', to: '/console/subscription', textKey: '订阅管理', icon: <IconKey /> },
      { key: 'personal', to: '/console/personal', textKey: '个人设置', icon: <IconUser /> },
    ],
  },
  {
    title: '管理员',
    key: 'admin',
    items: [
      { key: 'channel', to: '/console/channel', textKey: '渠道管理', icon: <IconActivity /> },
      { key: 'models', to: '/console/models', textKey: '模型管理', icon: <IconApps /> },
      { key: 'deployment', to: '/console/deployment', textKey: '模型部署', icon: <IconLayers /> },
      { key: 'redemption', to: '/console/redemption', textKey: '兑换码管理', icon: <IconGift /> },
      { key: 'user', to: '/console/user', textKey: '用户管理', icon: <IconUser /> },
      { key: 'setting', to: '/console/setting', textKey: '系统设置', icon: <IconSetting /> },
    ],
  },
];

const items = sections.flatMap((section) => section.items);

export default function SiderBar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nodew-sidebar-collapsed') === 'true');
  const selected = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const openedKeys = useMemo(() => sections.map((section) => section.key), []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('nodew-sidebar-collapsed', String(collapsed));

    return () => {
      document.body.classList.remove('sidebar-collapsed');
    };
  }, [collapsed]);

  return (
    <div className="sidebar-container">
      <div className="sidebar-status-card">
        <div className="sidebar-status-icon"><IconApps /></div>
        <div>
          <strong>{t('网关')}</strong>
          <span>{t('路由服务在线')}</span>
        </div>
      </div>
      <Nav
        className="sidebar-nav"
        isCollapsed={collapsed}
        defaultOpenKeys={openedKeys}
        openKeys={collapsed ? [] : openedKeys}
        selectedKeys={selected ? [selected.key] : []}
        renderWrapper={({ itemElement, props }) => {
          const item = items.find((entry) => entry.key === props.itemKey);
          if (!item) {
            return itemElement;
          }

          return (
            <Link to={item.to} onClick={onNavigate} style={{ textDecoration: 'none' }}>
              {itemElement}
            </Link>
          );
        }}
      >
        {sections.map((section) => (
          <div className="sidebar-section" key={section.key}>
            <Divider className="sidebar-divider" />
            {!collapsed ? <div className="sidebar-group-label">{t(section.title)}</div> : null}
            {section.items.map((item) => (
              <Nav.Item key={item.key} itemKey={item.key} text={t(item.textKey)} icon={item.icon} />
            ))}
          </div>
        ))}
      </Nav>
      <div className="sidebar-collapse-button">
        <Button
          block={!collapsed}
          size="small"
          theme="outline"
          type="tertiary"
          icon={<IconShrink rotate={collapsed ? 180 : 0} />}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? null : t('收起侧边栏')}
        </Button>
      </div>
    </div>
  );
}

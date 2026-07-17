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
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { UserContext } from '../../context/User';

type NavRole = 'all' | 'admin';

type NavItem = {
  key: string;
  to: string;
  textKey: string;
  icon: React.ReactNode;
  role?: NavRole;
};

type NavSection = {
  title: string;
  key: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    title: '工作台',
    key: 'workspace',
    items: [
      { key: 'detail', to: '/console', textKey: '数据看板', icon: <IconGridRectangle /> },
      { key: 'playground', to: '/console/playground', textKey: '操练场', icon: <IconTerminal /> },
      { key: 'chat-session', to: '/console/chat', textKey: '聊天', icon: <IconApps /> },
    ],
  },
  {
    title: '用量与资产',
    key: 'usage',
    items: [
      { key: 'token', to: '/console/token', textKey: '令牌管理', icon: <IconCreditCard /> },
      { key: 'log', to: '/console/log', textKey: '使用日志', icon: <IconHistogram /> },
      { key: 'midjourney', to: '/console/midjourney', textKey: '绘图日志', icon: <IconLayers /> },
      { key: 'task', to: '/console/task', textKey: '任务日志', icon: <IconActivity /> },
    ],
  },
  {
    title: '账户',
    key: 'account',
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
      { key: 'channel', to: '/console/channel', textKey: '渠道管理', icon: <IconActivity />, role: 'admin' },
      { key: 'models', to: '/console/models', textKey: '模型管理', icon: <IconApps />, role: 'admin' },
      { key: 'deployment', to: '/console/deployment', textKey: '模型部署', icon: <IconLayers />, role: 'admin' },
      { key: 'redemption', to: '/console/redemption', textKey: '兑换码管理', icon: <IconGift />, role: 'admin' },
      { key: 'user', to: '/console/user', textKey: '用户管理', icon: <IconUser />, role: 'admin' },
      { key: 'setting', to: '/console/setting', textKey: '系统设置', icon: <IconSetting />, role: 'admin' },
    ],
  },
];

export default function SiderBar({
  forceExpanded = false,
  onNavigate,
}: {
  forceExpanded?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useContext(UserContext);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nodew-sidebar-collapsed') === 'true');
  const effectiveCollapsed = forceExpanded ? false : collapsed;
  const visibleSections = useMemo(
    () => sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.role !== 'admin' || user?.role === 'ADMIN'),
      }))
      .filter((section) => section.items.length > 0),
    [user?.role],
  );
  const items = useMemo(() => visibleSections.flatMap((section) => section.items), [visibleSections]);
  const selected = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const openedKeys = useMemo(() => visibleSections.map((section) => section.key), [visibleSections]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', effectiveCollapsed);
    localStorage.setItem('nodew-sidebar-collapsed', String(collapsed));

    return () => document.body.classList.remove('sidebar-collapsed');
  }, [collapsed, effectiveCollapsed]);

  return (
    <nav id="console-sidebar" className="sidebar-container" aria-label={t('控制台导航')}>
      <div className="sidebar-status-card">
        <div className="sidebar-status-icon"><IconApps /></div>
        <div>
          <strong>{t('网关工作区')}</strong>
          <span>{t('服务运行正常')}</span>
        </div>
      </div>
      <Nav
        className="sidebar-nav"
        isCollapsed={effectiveCollapsed}
        defaultOpenKeys={openedKeys}
        openKeys={effectiveCollapsed ? [] : openedKeys}
        selectedKeys={selected ? [selected.key] : []}
        renderWrapper={({ itemElement, props }) => {
          const item = items.find((entry) => entry.key === props.itemKey);
          if (!item) return itemElement;

          return (
            <Link to={item.to} onClick={onNavigate} style={{ textDecoration: 'none' }}>
              {itemElement}
            </Link>
          );
        }}
      >
        {visibleSections.map((section) => (
          <div className="sidebar-section" key={section.key}>
            <Divider className="sidebar-divider" />
            {!effectiveCollapsed ? <div className="sidebar-group-label">{t(section.title)}</div> : null}
            {section.items.map((item) => (
              <Nav.Item key={item.key} itemKey={item.key} text={t(item.textKey)} icon={item.icon} />
            ))}
          </div>
        ))}
      </Nav>
      {!forceExpanded ? (
        <div className="sidebar-collapse-button">
          <Button
            block={!effectiveCollapsed}
            size="small"
            theme="outline"
            type="tertiary"
            icon={<IconShrink rotate={effectiveCollapsed ? 180 : 0} />}
            aria-label={effectiveCollapsed ? t('展开侧边栏') : t('收起侧边栏')}
            onClick={() => setCollapsed((value) => !value)}
          >
            {effectiveCollapsed ? null : t('收起侧边栏')}
          </Button>
        </div>
      ) : null}
    </nav>
  );
}

import { Nav } from '@douyinfe/semi-ui';
import {
  IconActivity,
  IconApps,
  IconCreditCard,
  IconGift,
  IconGridRectangle,
  IconHistogram,
  IconSetting,
  IconUser,
} from '@douyinfe/semi-icons';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const sections = [
  {
    title: '工作台',
    items: [
      { key: 'console', to: '/console', textKey: '控制台', icon: <IconGridRectangle /> },
      { key: 'channel', to: '/console/channel', textKey: '渠道管理', icon: <IconActivity /> },
      { key: 'token', to: '/console/token', textKey: '令牌管理', icon: <IconCreditCard /> },
    ],
  },
  {
    title: '运营',
    items: [
      { key: 'redemption', to: '/console/redemption', textKey: '兑换码管理', icon: <IconGift /> },
      { key: 'user', to: '/console/user', textKey: '用户管理', icon: <IconUser /> },
      { key: 'log', to: '/console/log', textKey: '使用日志', icon: <IconHistogram /> },
    ],
  },
];

const items = sections.flatMap((section) => section.items);

export default function SiderBar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { t } = useTranslation();
  const selected = items.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  return (
    <div className="sidebar-container">
      <div className="sidebar-status-card">
        <div className="sidebar-status-icon"><IconApps /></div>
        <div>
          <strong>Gateway</strong>
          <span>routing online</span>
        </div>
      </div>
      <Nav
        className="sidebar-nav"
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
          <Nav.Sub key={section.title} itemKey={section.title} text={section.title} icon={<IconSetting />}>
            {section.items.map((item) => (
              <Nav.Item key={item.key} itemKey={item.key} text={t(item.textKey)} icon={item.icon} />
            ))}
          </Nav.Sub>
        ))}
      </Nav>
    </div>
  );
}

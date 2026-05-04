import { Avatar, Button, Dropdown, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconChevronDown, IconMenu, IconMoon, IconSun } from '@douyinfe/semi-icons';
import { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ThemeContext } from '../../context/Theme';
import { UserContext } from '../../context/User';

export default function HeaderBar({
  onMobileMenuToggle,
  drawerOpen,
}: {
  onMobileMenuToggle: () => void;
  drawerOpen: boolean;
}) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user, logout } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isConsoleRoute = location.pathname.startsWith('/console');

  return (
    <header className="headerbar-shell">
      <div className="headerbar-inner">
        <div className="headerbar-left">
          {isConsoleRoute ? (
            <Button
              theme="borderless"
              icon={<IconMenu />}
              aria-label={drawerOpen ? 'close menu' : 'open menu'}
              onClick={onMobileMenuToggle}
              className="headerbar-mobile-toggle"
            />
          ) : null}
          <Link to={user ? '/console' : '/'} className="headerbar-brand">
            <span className="headerbar-brand-mark">N</span>
            <div>
              <Typography.Title heading={6} style={{ margin: 0 }}>nodew-api</Typography.Title>
              <Typography.Text type="tertiary">LLM Gateway Console</Typography.Text>
            </div>
          </Link>
        </div>
        <Space className="headerbar-actions">
          {!isConsoleRoute ? <Link to="/pricing" className="headerbar-link">Pricing</Link> : null}
          {!isConsoleRoute ? <Link to="/about" className="headerbar-link">About</Link> : null}
          <Button theme="borderless" icon={theme === 'dark' ? <IconSun /> : <IconMoon />} onClick={toggleTheme} />
          {user ? (
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => navigate('/console')}>控制台</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item
                    type="danger"
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                  >
                    退出登录
                  </Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <button className="user-trigger" type="button">
                <Avatar size="small" color={user.role === 'ADMIN' ? 'blue' : 'green'}>
                  {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
                </Avatar>
                <span className="user-trigger-main">
                  <strong>{user.displayName ?? user.username}</strong>
                  <Tag size="small" color={user.role === 'ADMIN' ? 'blue' : 'green'}>{user.role}</Tag>
                </span>
                <IconChevronDown />
              </button>
            </Dropdown>
          ) : (
            <Button onClick={() => navigate('/login')}>{t('登录')}</Button>
          )}
        </Space>
      </div>
    </header>
  );
}

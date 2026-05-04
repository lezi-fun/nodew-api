import { Avatar, Button, Dropdown, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconBell, IconChevronDown, IconMenu, IconMoon, IconSun } from '@douyinfe/semi-icons';
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
  const { i18n, t } = useTranslation();
  const isConsoleRoute = location.pathname.startsWith('/console');
  const navLinks = [
    { to: '/', label: '首页' },
    { to: user ? '/console' : '/login', label: '控制台' },
    { to: '/pricing', label: '模型广场' },
    { to: '/about', label: '关于' },
  ];

  const switchLanguage = async () => {
    const next = i18n.language.startsWith('zh') ? 'en' : 'zh-CN';
    await i18n.changeLanguage(next);
    localStorage.setItem('i18nextLng', next);
  };

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
        <nav className="headerbar-nav" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={location.pathname === link.to ? 'headerbar-link active' : 'headerbar-link'}
            >
              {t(link.label)}
            </Link>
          ))}
          <a className="headerbar-link" href="/v1/models" target="_blank" rel="noreferrer">
            API
          </a>
        </nav>
        <Space className="headerbar-actions">
          <Button theme="borderless" icon={<IconBell />} onClick={() => navigate('/console/log')} />
          <Button theme="borderless" onClick={() => void switchLanguage()}>{i18n.language.startsWith('zh') ? '中' : 'EN'}</Button>
          <Button theme="borderless" icon={theme === 'dark' ? <IconSun /> : <IconMoon />} onClick={toggleTheme} />
          {user ? (
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => navigate('/console')}>控制台</Dropdown.Item>
                  <Dropdown.Item onClick={() => navigate('/console/personal')}>个人设置</Dropdown.Item>
                  <Dropdown.Item onClick={() => navigate('/console/token')}>令牌管理</Dropdown.Item>
                  <Dropdown.Item onClick={() => navigate('/console/topup')}>钱包管理</Dropdown.Item>
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

import { Avatar, Button, Dropdown, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBell, IconChevronDown, IconMenu, IconMoon, IconSun } from '@douyinfe/semi-icons';
import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ThemeContext } from '../../context/Theme';
import { UserContext } from '../../context/User';
import { api } from '../../lib/api';

export default function HeaderBar({
  onMobileMenuToggle,
  drawerOpen,
}: {
  onMobileMenuToggle: () => void;
  drawerOpen: boolean;
}) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user, logout, setUser } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [savingLanguage, setSavingLanguage] = useState(false);
  const isConsoleRoute = location.pathname.startsWith('/console');
  const navLinks = [
    { to: '/', label: '首页' },
    { to: user ? '/console' : '/login', label: '控制台' },
    { to: '/pricing', label: '模型广场' },
    { to: '/about', label: '关于' },
  ];

  const switchLanguage = async () => {
    if (savingLanguage) {
      return;
    }

    const next = i18n.language.startsWith('zh') ? 'en' : 'zh-CN';

    if (!user) {
      await i18n.changeLanguage(next);
      localStorage.setItem('i18nextLng', next);
      return;
    }

    setSavingLanguage(true);
    try {
      const response = await api.updateCurrentUser({
        language: next,
      });
      setUser(response.user);
      await i18n.changeLanguage(next);
      localStorage.setItem('i18nextLng', next);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : t('保存语言偏好失败'));
    } finally {
      setSavingLanguage(false);
    }
  };

  return (
    <header className="headerbar-shell">
      <div className="headerbar-inner">
        <div className="headerbar-left">
          {isConsoleRoute ? (
            <Button
              theme="borderless"
              icon={<IconMenu />}
              aria-label={drawerOpen ? t('关闭菜单') : t('打开菜单')}
              onClick={onMobileMenuToggle}
              className="headerbar-mobile-toggle"
            />
          ) : null}
          <Link to={user ? '/console' : '/'} className="headerbar-brand">
            <span className="headerbar-brand-mark">N</span>
            <div>
              <Typography.Title heading={6} style={{ margin: 0 }}>NodEW-api</Typography.Title>
              <Typography.Text type="tertiary">LLM Gateway Console</Typography.Text>
            </div>
          </Link>
        </div>
        <nav className="headerbar-nav" aria-label={t('主导航')}>
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
          <Button theme="borderless" icon={<IconBell />} aria-label={t('查看日志')} onClick={() => navigate('/console/log')} />
          <Button
            theme="borderless"
            aria-label={t('切换语言')}
            loading={savingLanguage}
            disabled={savingLanguage}
            onClick={() => void switchLanguage()}
          >
            {i18n.language.startsWith('zh') ? '中' : 'EN'}
          </Button>
          <Button theme="borderless" icon={theme === 'dark' ? <IconSun /> : <IconMoon />} aria-label={t('切换主题')} onClick={toggleTheme} />
          {user ? (
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => navigate('/console')}>{t('控制台')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => navigate('/console/personal')}>{t('个人设置')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => navigate('/console/token')}>{t('令牌管理')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => navigate('/console/topup')}>{t('钱包管理')}</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item
                    type="danger"
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                  >
                    {t('退出登录')}
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

import { Layout } from '@douyinfe/semi-ui';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import App from '../../App';
import ErrorBoundary from '../common/ErrorBoundary';
import FooterBar from './Footer';
import HeaderBar from './headerbar';
import SiderBar from './SiderBar';

const { Header, Sider, Content } = Layout;
const mobileQuery = '(max-width: 767px)';

export default function PageLayout() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(mobileQuery).matches : false,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isConsoleRoute = location.pathname.startsWith('/console');
  const showSider = isConsoleRoute && (!isMobile || drawerOpen);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
      if (!event.matches) setDrawerOpen(false);
    };

    update(media);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };

    document.body.classList.toggle('mobile-nav-open', isMobile && drawerOpen);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('mobile-nav-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen, isMobile]);

  return (
    <Layout className={isConsoleRoute ? 'app-layout console-shell' : 'app-layout public-shell'}>
      <a className="skip-to-content" href="#main-content">{t('跳到主要内容')}</a>
      <Header className="app-header">
        <HeaderBar onMobileMenuToggle={() => setDrawerOpen((open) => !open)} drawerOpen={drawerOpen} />
      </Header>
      <Layout className="app-body-layout">
        {isMobile && drawerOpen ? (
          <button
            className="app-mobile-overlay"
            type="button"
            aria-label={t('关闭菜单')}
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}
        {showSider ? (
          <Sider className="app-sider" aria-label="控制台导航">
            <SiderBar forceExpanded={isMobile} onNavigate={() => setDrawerOpen(false)} />
          </Sider>
        ) : null}
        <Layout className={`app-content-layout ${!isMobile && showSider ? 'with-sider' : ''}`}>
          <Content className="app-content">
            <div id="main-content" className="app-main" tabIndex={-1}>
              <ErrorBoundary pathname={`${location.pathname}${location.search}${location.hash}`}>
                <App />
              </ErrorBoundary>
            </div>
          </Content>
          {!isConsoleRoute ? <FooterBar /> : null}
        </Layout>
      </Layout>
    </Layout>
  );
}

import { Layout } from '@douyinfe/semi-ui';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import App from '../../App';
import ErrorBoundary from '../common/ErrorBoundary';
import FooterBar from './Footer';
import HeaderBar from './headerbar';
import SiderBar from './SiderBar';

const { Header, Sider, Content } = Layout;

export default function PageLayout() {
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isConsoleRoute = location.pathname.startsWith('/console');
  const showSider = isConsoleRoute && (!isMobile || drawerOpen);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <HeaderBar onMobileMenuToggle={() => setDrawerOpen((prev) => !prev)} drawerOpen={drawerOpen} />
      </Header>
      <Layout className="app-body-layout">
        {showSider ? (
          <Sider className="app-sider">
            <SiderBar onNavigate={() => setDrawerOpen(false)} />
          </Sider>
        ) : null}
        <Layout className={`app-content-layout ${!isMobile && showSider ? 'with-sider' : ''}`}>
          <Content className="app-content">
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </Content>
          {!isConsoleRoute ? <FooterBar /> : null}
        </Layout>
      </Layout>
    </Layout>
  );
}

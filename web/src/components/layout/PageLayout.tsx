import { Layout } from '@douyinfe/semi-ui';
import { ToastContainer } from 'react-toastify';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import App from '../../App';
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
        <Layout className="app-content-layout" style={{ marginLeft: !isMobile && showSider ? '232px' : '0' }}>
          <Content className="app-content">
            <App />
          </Content>
          {!isConsoleRoute ? <FooterBar /> : null}
        </Layout>
      </Layout>
      <ToastContainer position="top-right" theme="colored" />
    </Layout>
  );
}

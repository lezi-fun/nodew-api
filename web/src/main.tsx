import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '@douyinfe/semi-ui';
import zhCN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import enGB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';
import { useTranslation } from 'react-i18next';

import '@douyinfe/semi-ui/dist/css/semi.css';
import 'react-toastify/dist/ReactToastify.css';
import './i18n/i18n';
import './styles.css';
import { StatusProvider } from './context/Status';
import { ThemeProvider } from './context/Theme';
import { UserProvider } from './context/User';
import PageLayout from './components/layout/PageLayout';

function SemiLocaleWrapper({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? enGB : zhCN;
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StatusProvider>
      <UserProvider>
        <BrowserRouter>
          <ThemeProvider>
            <SemiLocaleWrapper>
              <PageLayout />
            </SemiLocaleWrapper>
          </ThemeProvider>
        </BrowserRouter>
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>,
);

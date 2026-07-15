import React, { useContext, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@douyinfe/semi-ui/react19-adapter';
import { LocaleProvider } from '@douyinfe/semi-ui';
import zhCN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import enGB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';
import { useTranslation } from 'react-i18next';

import '@douyinfe/semi-ui/dist/css/semi.css';
import './i18n/i18n';
import './styles.css';
import { StatusProvider } from './context/Status';
import { ThemeProvider } from './context/Theme';
import { UserContext, UserProvider } from './context/User';
import PageLayout from './components/layout/PageLayout';
import { getPreferredLanguage, readUserLanguage } from './i18n/language';

function LanguagePreferenceSync() {
  const { user } = useContext(UserContext);
  const { i18n } = useTranslation();

  useEffect(() => {
    const nextLanguage = getPreferredLanguage({
      userLanguage: readUserLanguage(user?.language, user?.settings),
      storedLanguage: localStorage.getItem('i18nextLng'),
      detectedLanguage: i18n.resolvedLanguage ?? i18n.language,
    });

    if (i18n.resolvedLanguage !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [i18n, user?.language, user?.settings]);

  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';
  }, [i18n.language]);

  return null;
}

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
            <LanguagePreferenceSync />
            <SemiLocaleWrapper>
              <PageLayout />
            </SemiLocaleWrapper>
          </ThemeProvider>
        </BrowserRouter>
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>,
);

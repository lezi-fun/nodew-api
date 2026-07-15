import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

void i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zhCN },
    'zh-CN': { translation: zhCN },
  },
  supportedLngs: ['zh-CN', 'en'],
  fallbackLng: 'zh-CN',
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

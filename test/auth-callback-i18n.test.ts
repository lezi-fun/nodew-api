import { readFileSync } from 'node:fs';

import en from '../web/src/i18n/locales/en.json';
import zhCN from '../web/src/i18n/locales/zh-CN.json';

const pages = [
  'web/src/pages/VerifyEmail.tsx',
  'web/src/pages/OAuthCallback.tsx',
];

const translationKeys = () => {
  const keys = new Set<string>();
  const pattern = /\bt\(\s*['"]([^'"]+)['"]/g;

  for (const path of pages) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(pattern)) {
      keys.add(match[1]!);
    }
  }

  return [...keys];
};

describe('email verification and OAuth callback i18n', () => {
  it('connects both callback pages to react-i18next', () => {
    for (const path of pages) {
      expect(readFileSync(path, 'utf8')).toContain('useTranslation');
    }
  });

  it('provides aligned Chinese and English translations for every used key', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhCN).sort());

    for (const key of translationKeys()) {
      expect(zhCN).toHaveProperty(key);
      expect(en).toHaveProperty(key);
      if (/[\u3400-\u9fff]/.test(key)) {
        expect(en[key as keyof typeof en]).not.toBe(key);
      }
    }
  });
});

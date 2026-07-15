import { readFileSync } from 'node:fs';

import en from '../web/src/i18n/locales/en.json';
import zhCN from '../web/src/i18n/locales/zh-CN.json';
import { getPreferredLanguage, normalizeLanguage, readUserLanguage } from '../web/src/i18n/language.js';

const sourceFiles = [
  'web/src/components/layout/headerbar.tsx',
  'web/src/components/layout/SiderBar.tsx',
  'web/src/components/layout/Footer.tsx',
  'web/src/pages/Home.tsx',
  'web/src/pages/Login.tsx',
  'web/src/pages/Register.tsx',
  'web/src/pages/NotFound.tsx',
  'web/src/pages/Personal.tsx',
];

const readTranslationKeys = () => {
  const keys = new Set<string>();
  const directTranslationPattern = /\bt\(\s*['"]([^'"]+)['"]/g;
  const dynamicTranslationKeyPattern = /\b(?:label|textKey|title):\s*['"]([^'"]+)['"]/g;

  for (const path of sourceFiles) {
    const source = readFileSync(path, 'utf8');

    for (const pattern of [directTranslationPattern, dynamicTranslationKeyPattern]) {
      for (const match of source.matchAll(pattern)) {
        keys.add(match[1]!);
      }
    }
  }

  return [...keys].sort();
};

describe('i18n resources', () => {
  it('keeps English and Chinese resource keys aligned', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhCN).sort());
  });

  it('contains translations for every key used by the localized shell and auth pages', () => {
    const usedKeys = readTranslationKeys();
    const resourceKeys = new Set(Object.keys(en));

    expect(usedKeys.filter((key) => !resourceKeys.has(key))).toEqual([]);
  });

  it('provides meaningful English values instead of falling back to Chinese keys', () => {
    const unchanged = Object.entries(en)
      .filter(([key, value]) => key === value && /[\u3400-\u9fff]/.test(key))
      .map(([key]) => key);

    expect(unchanged).toEqual([]);
  });
});

describe('language preference', () => {
  it('normalizes supported browser and saved language variants', () => {
    expect(normalizeLanguage('zh')).toBe('zh-CN');
    expect(normalizeLanguage('zh-TW')).toBe('zh-CN');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('fr')).toBeNull();
  });

  it('prefers the signed-in user setting over local and detected language', () => {
    expect(getPreferredLanguage({
      userLanguage: 'en-US',
      storedLanguage: 'zh-CN',
      detectedLanguage: 'zh-CN',
    })).toBe('en');
  });

  it('falls back from invalid user settings to local storage and detector values', () => {
    expect(getPreferredLanguage({
      userLanguage: 'invalid',
      storedLanguage: 'en',
      detectedLanguage: 'zh-CN',
    })).toBe('en');
    expect(getPreferredLanguage({
      userLanguage: undefined,
      storedLanguage: undefined,
      detectedLanguage: 'en-GB',
    })).toBe('en');
  });

  it('prefers the dedicated user field and supports legacy settings during migration', () => {
    expect(readUserLanguage('en', { language: 'zh-CN' })).toBe('en');
    expect(readUserLanguage(null, { language: 'en-US' })).toBe('en');
  });
});

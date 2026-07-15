export type SupportedLanguage = 'zh-CN' | 'en';

export const normalizeLanguage = (value: unknown): SupportedLanguage | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh-CN';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }

  return null;
};

export const getPreferredLanguage = ({
  userLanguage,
  storedLanguage,
  detectedLanguage,
}: {
  userLanguage?: unknown;
  storedLanguage?: unknown;
  detectedLanguage?: unknown;
}): SupportedLanguage =>
  normalizeLanguage(userLanguage)
  ?? normalizeLanguage(storedLanguage)
  ?? normalizeLanguage(detectedLanguage)
  ?? 'zh-CN';

export const readUserLanguage = (
  language: unknown,
  settings?: Record<string, unknown> | null,
) => normalizeLanguage(language) ?? normalizeLanguage(settings?.language);

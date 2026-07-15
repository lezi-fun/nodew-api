import {
  defaultSettingSection,
  getSettingSection,
  settingSections,
  updateSettingSectionSearch,
} from '../web/src/lib/settings-sections.js';

describe('settings section navigation', () => {
  it('defines the four business domains in their display order', () => {
    expect(settingSections.map((section) => section.key)).toEqual([
      'general',
      'security',
      'oauth',
      'billing',
    ]);
    expect(new Set(settingSections.map((section) => section.key)).size).toBe(settingSections.length);
  });

  it('uses the general section by default and rejects unknown query values', () => {
    expect(defaultSettingSection).toBe('general');
    expect(getSettingSection(null)).toBe('general');
    expect(getSettingSection('unknown')).toBe('general');
    expect(getSettingSection('oauth')).toBe('oauth');
  });

  it('preserves unrelated query parameters when changing sections', () => {
    expect(updateSettingSectionSearch('tab=advanced&section=oauth', 'billing')).toBe('tab=advanced&section=billing');
    expect(updateSettingSectionSearch('', 'general')).toBe('section=general');
  });

  it('provides user-facing labels and descriptions for every section', () => {
    for (const section of settingSections) {
      expect(section.label.trim()).not.toBe('');
      expect(section.description.trim()).not.toBe('');
    }
  });
});

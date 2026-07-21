import { readFileSync } from 'node:fs';

const dashboardPage = readFileSync('web/src/pages/Dashboard.tsx', 'utf8');

describe('dashboard page', () => {
  it('uses a stable role-aware loader for its initial refresh effect', () => {
    expect(dashboardPage).toMatch(/const load = useCallback\(async \(\) => \{[\s\S]*?\}, \[user\?\.role\]\);/);
    expect(dashboardPage).toMatch(/useEffect\(\(\) => \{\s*void load\(\);\s*\}, \[load\]\);/);
    expect(dashboardPage).not.toContain('react-hooks/exhaustive-deps');
  });
});

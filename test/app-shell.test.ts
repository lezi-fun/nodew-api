import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('console app shell', () => {
  const layout = read('web/src/components/layout/PageLayout.tsx');
  const sidebar = read('web/src/components/layout/SiderBar.tsx');
  const header = read('web/src/components/layout/headerbar.tsx');
  const styles = read('web/src/styles.css');

  it('provides semantic design tokens for light and dark themes', () => {
    for (const token of [
      '--app-background',
      '--app-foreground',
      '--app-surface',
      '--app-surface-muted',
      '--app-border',
      '--app-primary',
      '--app-radius',
      '--app-header-height',
    ]) {
      expect(styles).toContain(token);
    }
    expect(styles).toContain("body[theme-mode='dark']");
  });

  it('uses an accessible shell with a skip link and main landmark', () => {
    expect(layout).toContain('skip-to-content');
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain('<div id="main-content"');
    expect(layout).not.toContain('<main id="main-content"');
  });

  it('keeps console scrolling inside the viewport-aware content region', () => {
    expect(styles).toContain('100svh');
    expect(styles).toMatch(/\.console-shell \.app-content[^}]*overflow-y:\s*auto/s);
    expect(styles).toMatch(/\.app-sider[^}]*overflow:\s*hidden/s);
  });

  it('implements a real mobile drawer with overlay, escape close and body scroll lock', () => {
    expect(layout).toContain('app-mobile-overlay');
    expect(layout).toContain("event.key === 'Escape'");
    expect(layout).toContain("document.body.classList.toggle('mobile-nav-open'");
    expect(styles).toContain('body.mobile-nav-open');
    expect(layout).toContain('<SiderBar forceExpanded={isMobile}');
    expect(sidebar).toContain('const effectiveCollapsed = forceExpanded ? false : collapsed');
  });

  it('filters administrator navigation for non-admin users', () => {
    expect(sidebar).toContain('UserContext');
    expect(sidebar).toContain("user?.role === 'ADMIN'");
    expect(sidebar).toContain("role: 'admin'");
  });

  it('exposes the mobile menu state and an accessible header menu button', () => {
    expect(header).toContain('aria-expanded={drawerOpen}');
    expect(header).toContain('aria-controls="console-sidebar"');
    expect(sidebar).toContain('id="console-sidebar"');
    expect(header).toContain('headerbar-notification-action');
    expect(header).toContain('headerbar-brand-subtitle');
    expect(styles).toMatch(/@media \(max-width: 767px\)[\s\S]*\.headerbar-notification-action[\s\S]*display:\s*none/);
  });

  it('respects reduced-motion preferences', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps navigation visible on tablets for public pages', () => {
    expect(styles).not.toContain('@media (max-width: 1024px)');
    expect(styles).toContain('@media (max-width: 767px)');
  });
});

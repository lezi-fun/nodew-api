import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const slugs = [
  'architecture',
  'backend-structure',
  'frontend-structure',
  'code-map',
  'testing-guide',
  'i18n-guide',
];

const config = readFileSync('docs/.vitepress/config.ts', 'utf8');

const walkCodeFiles = (root: string, extensions: Set<string>) => {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if ([...extensions].some((extension) => entry.name.endsWith(extension))) {
        files.push(relative('.', path));
      }
    }
  };

  walk(root);
  return files.sort();
};

describe('development documentation', () => {
  it('provides complete English and Chinese development sections', () => {
    for (const slug of slugs) {
      const english = `docs/development/${slug}.md`;
      const chinese = `docs/zh/development/${slug}.md`;

      expect(existsSync(english), english).toBe(true);
      expect(existsSync(chinese), chinese).toBe(true);
      expect(config).toContain(`/development/${slug}`);
      expect(config).toContain(`/zh/development/${slug}`);
    }
  });

  it('documents concrete code paths and verification commands on every page', () => {
    for (const locale of ['development', 'zh/development']) {
      for (const slug of slugs) {
        const content = readFileSync(`docs/${locale}/${slug}.md`, 'utf8');

        expect(content).toMatch(/`(?:src|web\/src|test|prisma|docs)\//);
        expect(content).toMatch(/npm (?:run|test)|bun run/);
      }
    }
  });

  it('uses repository-root paths in both code maps', () => {
    for (const path of ['docs/development/code-map.md', 'docs/zh/development/code-map.md']) {
      const content = readFileSync(path, 'utf8');
      const codeReferences = [...content.matchAll(/`([^`]+\.(?:ts|tsx)|[^`]+\/(?:\*\*\/)?\*)`/g)]
        .map((match) => match[1]!);
      const shortened = codeReferences.filter((reference) =>
        !reference.startsWith('src/') &&
        !reference.startsWith('web/src/') &&
        !reference.startsWith('test/') &&
        !reference.startsWith('docs/') &&
        !reference.startsWith('prisma/'));
      const missing = codeReferences.filter((reference) => {
        if (reference.includes('*')) return false;
        if (!existsSync(reference)) return true;
        return reference.endsWith('/') && !statSync(reference).isDirectory();
      });

      expect(shortened, path).toEqual([]);
      expect(missing, path).toEqual([]);
    }
  });

  it('renders automatic file dates in the document footer', () => {
    const theme = readFileSync('docs/.vitepress/theme/index.ts', 'utf8');
    const component = readFileSync('docs/.vitepress/theme/components/FileDates.vue', 'utf8');

    expect(theme).toContain("'doc-after'");
    expect(theme).not.toContain("'doc-footer-before'");
    expect(config).toContain('lastUpdated: false');
    expect(component).toContain('fileDates');
    expect(component).toContain('File created');
    expect(component).toContain('文件创建日期');
  });

  it('keeps generated VitePress artifacts out of git', () => {
    const ignore = readFileSync('docs/.gitignore', 'utf8');

    expect(ignore).toContain('node_modules/');
    expect(ignore).toContain('.vitepress/dist/');
    expect(ignore).toContain('.vitepress/.temp/');
  });

  it('explains every backend, frontend, and test source file', () => {
    const backendDocs = [
      readFileSync('docs/development/backend-structure.md', 'utf8'),
      readFileSync('docs/zh/development/backend-structure.md', 'utf8'),
    ];
    const frontendDocs = [
      readFileSync('docs/development/frontend-structure.md', 'utf8'),
      readFileSync('docs/zh/development/frontend-structure.md', 'utf8'),
    ];
    const testingDocs = [
      readFileSync('docs/development/testing-guide.md', 'utf8'),
      readFileSync('docs/zh/development/testing-guide.md', 'utf8'),
    ];

    for (const path of walkCodeFiles('src', new Set(['.ts']))) {
      for (const content of backendDocs) expect(content, path).toContain(`\`${path}\``);
    }
    for (const path of walkCodeFiles('web/src', new Set(['.ts', '.tsx']))) {
      for (const content of frontendDocs) expect(content, path).toContain(`\`${path}\``);
    }
    for (const path of walkCodeFiles('test', new Set(['.ts']))) {
      for (const content of testingDocs) expect(content, path).toContain(`\`${path}\``);
    }
  });
});

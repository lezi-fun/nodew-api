import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  getFileDates,
  getFilesystemCreatedAt,
  getPageFileDates,
} from '../docs/.vitepress/file-dates.js';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const commitAt = (cwd: string, message: string, iso: string) => {
  execFileSync('git', ['commit', '-m', message], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: iso,
      GIT_COMMITTER_DATE: iso,
    },
    stdio: 'ignore',
  });
};

describe('documentation file dates', () => {
  it('falls back to mtime when the filesystem does not expose a birth time', () => {
    const mtime = new Date('2025-01-02T03:04:05Z');

    expect(getFilesystemCreatedAt(new Date(0), mtime)).toBe(mtime.toISOString());
  });

  it('reads creation and latest update dates from git history', () => {
    const root = mkdtempSync(join(tmpdir(), 'nodew-doc-dates-'));
    mkdirSync(join(root, 'docs', 'guide'), { recursive: true });
    const file = join(root, 'docs', 'guide', 'example.md');

    git(root, 'init');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test User');
    writeFileSync(file, '# First\n');
    git(root, 'add', '.');
    commitAt(root, 'create doc', '2025-01-02T03:04:05Z');
    writeFileSync(file, '# Updated\n');
    git(root, 'add', '.');
    commitAt(root, 'update doc', '2025-03-04T05:06:07Z');

    const dates = getFileDates(file, root);
    expect(new Date(dates.created).toISOString()).toBe('2025-01-02T03:04:05.000Z');
    expect(new Date(dates.updated).toISOString()).toBe('2025-03-04T05:06:07.000Z');
  });

  it('keeps the original creation date after a document is renamed', () => {
    const root = mkdtempSync(join(tmpdir(), 'nodew-doc-dates-'));
    mkdirSync(join(root, 'docs'), { recursive: true });
    const original = join(root, 'docs', 'original.md');
    const renamed = join(root, 'docs', 'renamed.md');

    git(root, 'init');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test User');
    writeFileSync(original, '# Original\n');
    git(root, 'add', '.');
    commitAt(root, 'create original doc', '2025-01-02T03:04:05Z');
    git(root, 'mv', 'docs/original.md', 'docs/renamed.md');
    commitAt(root, 'rename doc', '2025-02-03T04:05:06Z');

    const dates = getFileDates(renamed, root);
    expect(new Date(dates.created).toISOString()).toBe('2025-01-02T03:04:05.000Z');
    expect(new Date(dates.updated).toISOString()).toBe('2025-02-03T04:05:06.000Z');
  });

  it('falls back to filesystem dates for an untracked article', () => {
    const root = mkdtempSync(join(tmpdir(), 'nodew-doc-dates-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
    const file = join(root, 'docs', 'development', 'new.md');
    const date = new Date('2025-06-07T08:09:10Z');

    writeFileSync(file, '# New article\n');
    utimesSync(file, date, date);

    const dates = getFileDates(file, root);
    expect(new Date(dates.created).getTime()).toBeLessThanOrEqual(date.getTime());
    expect(dates.updated).toBe(date.toISOString());
  });

  it('resolves page paths containing spaces and non-ASCII characters', () => {
    const root = mkdtempSync(join(tmpdir(), 'nodew-doc-dates-'));
    const docsRoot = join(root, 'docs');
    mkdirSync(join(docsRoot, '开发 文档'), { recursive: true });
    const file = join(docsRoot, '开发 文档', '代码 地图.md');
    const date = new Date('2025-08-09T10:11:12Z');

    writeFileSync(file, '# 代码地图\n');
    utimesSync(file, date, date);

    const dates = getPageFileDates('开发 文档/代码 地图.md', docsRoot, root);
    expect(new Date(dates.created).getTime()).toBeLessThanOrEqual(date.getTime());
    expect(dates.updated).toBe(date.toISOString());
  });

  it('uses the working-tree modification time when it is newer than git history', () => {
    const root = mkdtempSync(join(tmpdir(), 'nodew-doc-dates-'));
    mkdirSync(join(root, 'docs'), { recursive: true });
    const file = join(root, 'docs', 'tracked.md');
    const workingTreeDate = new Date('2025-09-10T11:12:13Z');

    git(root, 'init');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test User');
    writeFileSync(file, '# Tracked\n');
    git(root, 'add', '.');
    commitAt(root, 'create tracked doc', '2025-01-02T03:04:05Z');
    writeFileSync(file, '# Working tree update\n');
    utimesSync(file, workingTreeDate, workingTreeDate);

    const dates = getFileDates(file, root);
    expect(new Date(dates.created).toISOString()).toBe('2025-01-02T03:04:05.000Z');
    expect(dates.updated).toBe(workingTreeDate.toISOString());
  });
});

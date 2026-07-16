import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export type FileDates = {
  created: string;
  updated: string;
};

export const getFilesystemCreatedAt = (birthtime: Date, mtime: Date) =>
  birthtime.getTime() > 0 ? birthtime.toISOString() : mtime.toISOString();

const gitDate = (root: string, file: string, args: string[]) => {
  try {
    const output = execFileSync(
      'git',
      ['log', ...args, '--format=%aI', '--', relative(root, file)],
      { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
    );

    return output.split('\n').find(Boolean)?.trim() ?? '';
  } catch {
    return '';
  }
};

const hasWorkingTreeChanges = (root: string, file: string) => {
  try {
    const output = execFileSync(
      'git',
      ['status', '--porcelain', '--', relative(root, file)],
      { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
    );

    return output.trim().length > 0;
  } catch {
    return true;
  }
};

export const getFileDates = (file: string, repositoryRoot: string): FileDates => {
  const stats = statSync(file);
  const filesystemCreated = getFilesystemCreatedAt(stats.birthtime, stats.mtime);
  const filesystemUpdated = stats.mtime.toISOString();
  const created = gitDate(repositoryRoot, file, ['--follow', '--diff-filter=A', '--reverse']);
  const gitUpdated = gitDate(repositoryRoot, file, ['-1']);
  const updated = hasWorkingTreeChanges(repositoryRoot, file)
    ? filesystemUpdated
    : gitUpdated || filesystemUpdated;

  return {
    created: created || filesystemCreated,
    updated,
  };
};

export const getPageFileDates = (
  relativePath: string,
  docsRoot: string,
  repositoryRoot: string,
) => getFileDates(resolve(docsRoot, relativePath), repositoryRoot);
